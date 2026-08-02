import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import * as https from 'https'
import { TelegramReportService } from './telegram-report.service'

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name)
  private readonly token: string
  private readonly chatId: string
  private offset = 0
  private running = false
  private pollPromise: Promise<void> | null = null

  constructor(
    private readonly config: ConfigService,
    private readonly reports: TelegramReportService,
  ) {
    this.token = String(this.config.get('TELEGRAM_BOT_TOKEN') || '')
    this.chatId = String(this.config.get('TELEGRAM_CHAT_ID') || '')
  }

  onModuleInit(): void {
    if (!this.token || !this.chatId) {
      this.logger.error(
        'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are required; bot not started',
      )
      return
    }

    this.running = true
    this.pollPromise = this.pollLoop()
    this.logger.log('Telegram bot polling started')
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false
    if (this.pollPromise) {
      await this.pollPromise.catch(() => undefined)
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async hourlyReport(): Promise<void> {
    if (!this.token || !this.chatId) {
      return
    }

    try {
      await this.sendReportToChannel()
    } catch (error) {
      this.logger.error(`Hourly report failed: ${error}`)
    }
  }

  async sendReportToChannel(): Promise<void> {
    const stats = await this.reports.getStats()
    const text = this.reports.formatReport(stats)
    await this.sendMessage(this.chatId, text)
  }

  private async pollLoop(): Promise<void> {
    while (this.running) {
      try {
        const updates = await this.getUpdates(this.offset, 30)
        for (const update of updates) {
          this.offset = update.update_id + 1
          await this.handleUpdate(update)
        }
      } catch (error) {
        this.logger.warn(`Polling error: ${error}`)
        await sleep(3000)
      }
    }
  }

  private async handleUpdate(update: TgUpdate): Promise<void> {
    const message = update.message
    if (!message?.text) {
      return
    }

    const cmd = parseCommand(message.text)
    if (!cmd) {
      return
    }

    if (cmd === '/ping') {
      await this.sendMessage(String(message.chat.id), 'pong')
      return
    }

    if (cmd === '/sendreport') {
      await this.sendReportToChannel()
      if (String(message.chat.id) !== this.chatId) {
        await this.sendMessage(String(message.chat.id), 'Report sent to channel')
      }
    }
  }

  private async getUpdates(
    offset: number,
    timeoutSec: number,
  ): Promise<TgUpdate[]> {
    const url =
      `https://api.telegram.org/bot${this.token}/getUpdates` +
      `?offset=${offset}&timeout=${timeoutSec}&allowed_updates=${encodeURIComponent(
        '["message"]',
      )}`
    const data = await httpJson(url)
    if (!data.ok) {
      throw new Error(`getUpdates failed: ${JSON.stringify(data)}`)
    }
    return (data.result || []) as TgUpdate[]
  }

  private async sendMessage(chatId: string, text: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`
    const data = await httpJson(url, {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    })
    if (!data.ok) {
      throw new Error(`sendMessage failed: ${JSON.stringify(data)}`)
    }
  }
}

interface TgUpdate {
  update_id: number
  message?: {
    chat: { id: number }
    text?: string
  }
}

function parseCommand(text: string): string | null {
  const first = text.trim().split(/\s+/)[0]
  if (!first || !first.startsWith('/')) {
    return null
  }
  return first.replace(/@\w+$/, '').toLowerCase()
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function httpJson(
  url: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; result?: unknown }> {
  const payload = body ? JSON.stringify(body) : undefined
  const u = new URL(url)

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: payload ? 'POST' : 'GET',
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : undefined,
      },
      res => {
        const chunks: Buffer[] = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch (error) {
            reject(error)
          }
        })
      },
    )
    req.on('error', reject)
    if (payload) {
      req.write(payload)
    }
    req.end()
  })
}
