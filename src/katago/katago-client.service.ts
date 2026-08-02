import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
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
const STDERR_LOG_EVERY_MS = 5_000

@Injectable()
export class KatagoClientService implements OnModuleDestroy {
  private readonly logger = new Logger(KatagoClientService.name)
  private process: ChildProcessWithoutNullStreams | null = null
  private readline: Interface | null = null
  private starting: Promise<void> | null = null
  private stopping: Promise<void> | null = null
  private idleStopTimer: NodeJS.Timeout | null = null
  private lastStderrLogAt = 0
  private readonly pending = new Map<string, PendingQuery>()

  constructor(private readonly configService: ConfigService) {}

  async onModuleDestroy(): Promise<void> {
    this.clearIdleStop()
    await this.stop(true)
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
        // KataGo keeps burning CPU after a hung query; kill immediately
        // or the 2-core host freezes and the queue cron cannot run.
        this.logger.error(
          `KataGo query ${query.id} timed out after ${timeoutMs}ms — SIGKILL`,
        )
        this.forceKill()
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
    const now = Date.now()
    if (now - this.lastStderrLogAt < STDERR_LOG_EVERY_MS) {
      return
    }
    this.lastStderrLogAt = now
    const text = chunk.toString().trim()
    if (text) {
      this.logger.warn(`KataGo stderr: ${text.slice(0, 500)}`)
    }
  }

  private onProcessExit(
    code: number | null,
    signal: NodeJS.Signals | null,
  ): void {
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

    if (
      typeof message.id !== 'string' ||
      typeof message.turnNumber !== 'number'
    ) {
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
      void this.stop(false)
    }, idleStopMs)
  }

  private clearIdleStop(): void {
    if (!this.idleStopTimer) {
      return
    }
    clearTimeout(this.idleStopTimer)
    this.idleStopTimer = null
  }

  /** Immediate kill — used on query timeout so the host does not freeze. */
  private forceKill(): void {
    this.clearIdleStop()
    const child = this.process
    if (!child) {
      return
    }
    try {
      child.kill('SIGKILL')
    } catch (error) {
      console.log('forceKill')
      console.log(error)
    }
  }

  private async stop(force: boolean): Promise<void> {
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

    this.stopping = this.terminate(child, force).finally(() => {
      this.stopping = null
    })
    await this.stopping
  }

  private terminate(
    child: ChildProcessWithoutNullStreams,
    force: boolean,
  ): Promise<void> {
    return new Promise(resolve => {
      const forceDelayMs = force ? 500 : 2_000

      const forceTimer = setTimeout(() => {
        this.logger.warn('KataGo still alive — SIGKILL')
        try {
          child.kill('SIGKILL')
        } catch (error) {
          console.log(error)
        }
        resolve()
      }, forceDelayMs)

      child.once('exit', () => {
        clearTimeout(forceTimer)
        resolve()
      })

      if (force) {
        try {
          child.kill('SIGKILL')
        } catch (error) {
          console.log(error)
          resolve()
        }
        return
      }

      try {
        child.stdin.end()
      } catch {
        try {
          child.kill('SIGKILL')
        } catch (error) {
          console.log(error)
        }
      }
    })
  }
}
