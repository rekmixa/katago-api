import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { createInterface, Interface } from 'readline'
import { KatagoTurnResponse } from './katago.types'

type PendingQuery = {
  expectedTurns: Set<number>
  results: Map<number, KatagoTurnResponse>
  resolve: (results: KatagoTurnResponse[]) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

@Injectable()
export class KatagoClientService implements OnModuleDestroy {
  private readonly logger = new Logger(KatagoClientService.name)
  private process: ChildProcessWithoutNullStreams | null = null
  private readline: Interface | null = null
  private starting: Promise<void> | null = null
  private readonly pending = new Map<string, PendingQuery>()

  constructor(private readonly configService: ConfigService) {}

  async onModuleDestroy(): Promise<void> {
    await this.stop()
  }

  async analyze(
    query: Record<string, unknown> & {
      id: string
      analyzeTurns: number[]
    },
  ): Promise<KatagoTurnResponse[]> {
    await this.ensureStarted()

    const timeoutMs = Number(
      this.configService.get('KATAGO_QUERY_TIMEOUT_MS') ?? 1_800_000,
    )

    return new Promise<KatagoTurnResponse[]>((resolve, reject) => {
      if (this.pending.has(query.id)) {
        reject(new Error(`Duplicate KataGo query id: ${query.id}`))
        return
      }

      const timer = setTimeout(() => {
        this.pending.delete(query.id)
        reject(
          new Error(
            `KataGo query ${query.id} timed out after ${timeoutMs}ms`,
          ),
        )
      }, timeoutMs)

      this.pending.set(query.id, {
        expectedTurns: new Set(query.analyzeTurns),
        results: new Map(),
        resolve,
        reject,
        timer,
      })

      const line = `${JSON.stringify(query)}\n`
      const stdin = this.process?.stdin
      if (!stdin) {
        clearTimeout(timer)
        this.pending.delete(query.id)
        reject(new Error('KataGo stdin is not available'))
        return
      }

      stdin.write(line, error => {
        if (error) {
          clearTimeout(timer)
          this.pending.delete(query.id)
          reject(error)
        }
      })
    })
  }

  private async ensureStarted(): Promise<void> {
    if (this.process && !this.process.killed) {
      return
    }

    if (this.starting) {
      await this.starting
      return
    }

    this.starting = this.start()
    try {
      await this.starting
    } finally {
      this.starting = null
    }
  }

  private async start(): Promise<void> {
    const bin = this.configService.get<string>('KATAGO_BIN') ?? '/opt/katago/katago'
    const config =
      this.configService.get<string>('KATAGO_CONFIG') ??
      '/home/node/app/katago/analysis.cfg'
    const model =
      this.configService.get<string>('KATAGO_MODEL') ??
      '/home/node/app/katago/models/default.bin.gz'

    this.logger.log(`Starting KataGo: ${bin} analysis -config ${config} -model ${model}`)

    const child = spawn(bin, ['analysis', '-config', config, '-model', model], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    this.process = child
    this.readline = createInterface({ input: child.stdout })

    this.readline.on('line', line => this.onStdoutLine(line))

    child.stderr.on('data', chunk => {
      const text = chunk.toString().trim()
      if (text) {
        this.logger.warn(`KataGo stderr: ${text}`)
      }
    })

    child.on('exit', (code, signal) => {
      this.logger.error(`KataGo exited (code=${code}, signal=${signal})`)
      this.process = null
      this.readline?.close()
      this.readline = null

      for (const [id, pending] of this.pending) {
        clearTimeout(pending.timer)
        pending.reject(
          new Error(`KataGo process exited while query ${id} was pending`),
        )
      }
      this.pending.clear()
    })

    // Даем движку время на загрузку модели; готовность ловим по отсутствию мгновенного exit
    await new Promise<void>((resolve, reject) => {
      const onEarlyExit = (code: number | null) => {
        reject(new Error(`KataGo failed to start (exit code ${code})`))
      }
      child.once('exit', onEarlyExit)
      setTimeout(() => {
        child.off('exit', onEarlyExit)
        if (child.killed || child.exitCode !== null) {
          reject(new Error('KataGo failed to start'))
          return
        }
        resolve()
      }, 2000)
    })

    this.logger.log('KataGo analysis engine started')
  }

  private onStdoutLine(line: string): void {
    const trimmed = line.trim()
    if (!trimmed) {
      return
    }

    let message: Record<string, unknown>
    try {
      message = JSON.parse(trimmed)
    } catch {
      this.logger.warn(`Non-JSON KataGo stdout: ${trimmed}`)
      return
    }

    if (typeof message.error === 'string') {
      const id = typeof message.id === 'string' ? message.id : null
      if (id && this.pending.has(id)) {
        const pending = this.pending.get(id)!
        clearTimeout(pending.timer)
        this.pending.delete(id)
        pending.reject(new Error(message.error))
        return
      }

      this.logger.error(`KataGo error: ${message.error}`)
      return
    }

    if (typeof message.warning === 'string') {
      this.logger.warn(
        `KataGo warning (${message.field ?? '?'}): ${message.warning}`,
      )
      return
    }

    if (message.isDuringSearch === true) {
      return
    }

    const id = message.id
    const turnNumber = message.turnNumber
    if (typeof id !== 'string' || typeof turnNumber !== 'number') {
      return
    }

    const pending = this.pending.get(id)
    if (!pending) {
      return
    }

    pending.results.set(turnNumber, message as KatagoTurnResponse)
    pending.expectedTurns.delete(turnNumber)

    if (pending.expectedTurns.size === 0) {
      clearTimeout(pending.timer)
      this.pending.delete(id)
      const ordered = [...pending.results.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, value]) => value)
      pending.resolve(ordered)
    }
  }

  private async stop(): Promise<void> {
    if (!this.process) {
      return
    }

    const child = this.process
    this.process = null
    this.readline?.close()
    this.readline = null

    child.stdin.end()
    await new Promise<void>(resolve => {
      const force = setTimeout(() => {
        child.kill('SIGKILL')
        resolve()
      }, 5000)

      child.once('exit', () => {
        clearTimeout(force)
        resolve()
      })
    })
  }
}
