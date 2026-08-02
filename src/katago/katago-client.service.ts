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

const READY_MARKER = 'ready to begin handling requests'

@Injectable()
export class KatagoClientService implements OnModuleDestroy {
  private readonly logger = new Logger(KatagoClientService.name)
  private process: ChildProcessWithoutNullStreams | null = null
  private readline: Interface | null = null
  private starting: Promise<void> | null = null
  private stopping: Promise<void> | null = null
  private idleStopTimer: NodeJS.Timeout | null = null
  private readonly pending = new Map<string, PendingQuery>()

  constructor(private readonly configService: ConfigService) {}

  async onModuleDestroy(): Promise<void> {
    this.clearIdleStop()
    await this.stop()
  }

  async analyze(
    query: Record<string, unknown> & {
      id: string
      analyzeTurns: number[]
    },
  ): Promise<KatagoTurnResponse[]> {
    this.clearIdleStop()
    await this.ensureStarted()

    try {
      return await this.runQuery(query)
    } finally {
      this.scheduleIdleStop()
    }
  }

  private runQuery(
    query: Record<string, unknown> & {
      id: string
      analyzeTurns: number[]
    },
  ): Promise<KatagoTurnResponse[]> {
    const timeoutMs = Number(
      this.configService.get('KATAGO_QUERY_TIMEOUT_MS') ?? 1_800_000,
    )

    return new Promise((resolve, reject) => {
      if (this.pending.has(query.id)) {
        reject(new Error(`Duplicate KataGo query id: ${query.id}`))
        return
      }

      const stdin = this.process?.stdin
      if (!stdin) {
        reject(new Error('KataGo stdin is not available'))
        return
      }

      const timer = setTimeout(() => {
        this.pending.delete(query.id)
        reject(
          new Error(`KataGo query ${query.id} timed out after ${timeoutMs}ms`),
        )
      }, timeoutMs)

      this.pending.set(query.id, {
        expectedTurns: new Set(query.analyzeTurns),
        results: new Map(),
        resolve,
        reject,
        timer,
      })

      stdin.write(`${JSON.stringify(query)}\n`, error => {
        if (!error) {
          return
        }
        clearTimeout(timer)
        this.pending.delete(query.id)
        reject(error)
      })
    })
  }

  private async ensureStarted(): Promise<void> {
    if (this.stopping) {
      await this.stopping
    }
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
    const bin =
      this.configService.get<string>('KATAGO_BIN') ?? '/opt/katago/katago'
    const config =
      this.configService.get<string>('KATAGO_CONFIG') ??
      '/home/node/app/katago/analysis.cfg'
    const model =
      this.configService.get<string>('KATAGO_MODEL') ??
      '/home/node/app/katago/models/default.bin.gz'
    const readyTimeoutMs = Number(
      this.configService.get('KATAGO_READY_TIMEOUT_MS') ?? 180_000,
    )

    this.logger.log(
      `Starting KataGo: ${bin} analysis -config ${config} -model ${model}`,
    )

    const child = spawn(bin, ['analysis', '-config', config, '-model', model], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    this.process = child
    this.readline = createInterface({ input: child.stdout })
    this.readline.on('line', line => this.onStdoutLine(line))
    child.stderr.on('data', chunk => this.onStderr(chunk))
    child.on('exit', (code, signal) => this.onProcessExit(code, signal))

    await this.waitUntilReady(child, readyTimeoutMs)
    this.logger.log('KataGo analysis engine started')
  }

  private onStderr(chunk: Buffer): void {
    const text = chunk.toString().trim()
    if (text) {
      this.logger.warn(`KataGo stderr: ${text}`)
    }
  }

  private onProcessExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.logger.warn(`KataGo exited (code=${code}, signal=${signal})`)
    this.clearIdleStop()
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
  }

  private waitUntilReady(
    child: ChildProcessWithoutNullStreams,
    readyTimeoutMs: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false
      let timeout: NodeJS.Timeout | null = null

      const settle = (error?: Error) => {
        if (settled) {
          return
        }
        settled = true
        if (timeout !== null) {
          clearTimeout(timeout)
        }
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      }

      const onReadyStderr = (chunk: Buffer) => {
        if (chunk.toString().includes(READY_MARKER)) {
          settle()
        }
      }

      const onEarlyExit = (code: number | null) => {
        settle(new Error(`KataGo failed to start (exit code ${code})`))
      }

      timeout = setTimeout(() => {
        settle(
          new Error(`KataGo did not become ready within ${readyTimeoutMs}ms`),
        )
      }, readyTimeoutMs)

      child.stderr.on('data', onReadyStderr)
      child.once('exit', onEarlyExit)
    })
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
      this.rejectPending(message.id, new Error(message.error))
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

    if (typeof message.id !== 'string' || typeof message.turnNumber !== 'number') {
      return
    }

    const pending = this.pending.get(message.id)
    if (!pending) {
      return
    }

    pending.results.set(message.turnNumber, message as KatagoTurnResponse)
    pending.expectedTurns.delete(message.turnNumber)

    if (pending.expectedTurns.size > 0) {
      return
    }

    clearTimeout(pending.timer)
    this.pending.delete(message.id)
    pending.resolve(
      [...pending.results.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, value]) => value),
    )
  }

  private rejectPending(id: unknown, error: Error): void {
    if (typeof id === 'string' && this.pending.has(id)) {
      const pending = this.pending.get(id)!
      clearTimeout(pending.timer)
      this.pending.delete(id)
      pending.reject(error)
      return
    }
    this.logger.error(`KataGo error: ${error.message}`)
  }

  private scheduleIdleStop(): void {
    this.clearIdleStop()
    if (this.pending.size > 0 || !this.process) {
      return
    }

    const idleStopMs = Number(
      this.configService.get('KATAGO_IDLE_STOP_MS') ?? 10_000,
    )
    if (idleStopMs <= 0) {
      return
    }

    this.idleStopTimer = setTimeout(() => {
      if (this.pending.size > 0) {
        return
      }
      this.logger.log(
        `KataGo idle for ${idleStopMs}ms — stopping process to free CPU/GPU`,
      )
      void this.stop()
    }, idleStopMs)
  }

  private clearIdleStop(): void {
    if (!this.idleStopTimer) {
      return
    }
    clearTimeout(this.idleStopTimer)
    this.idleStopTimer = null
  }

  private async stop(): Promise<void> {
    this.clearIdleStop()

    if (this.stopping) {
      await this.stopping
      return
    }
    if (!this.process) {
      return
    }

    const child = this.process
    this.process = null
    this.readline?.close()
    this.readline = null

    this.stopping = this.terminate(child).finally(() => {
      this.stopping = null
    })
    await this.stopping
  }

  private terminate(child: ChildProcessWithoutNullStreams): Promise<void> {
    return new Promise(resolve => {
      const force = setTimeout(() => {
        this.logger.warn('KataGo did not exit after stdin close — SIGKILL')
        child.kill('SIGKILL')
        resolve()
      }, 10_000)

      child.once('exit', () => {
        clearTimeout(force)
        resolve()
      })

      try {
        child.stdin.end()
      } catch {
        child.kill('SIGKILL')
      }
    })
  }
}
