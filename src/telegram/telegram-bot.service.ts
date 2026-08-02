import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Cron, CronExpression } from '@nestjs/schedule'
import * as http from 'http'
import * as https from 'https'
import { TelegramReportService } from './telegram-report.service'

interface TgUpdate {
  update_id: number
  message?: {
    chat: { id: number }
    text?: string
  }
}

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name)
  private readonly token: string
  private readonly chatId: string
  private readonly adminIds: Set<string>
  private readonly apiBaseUrl: string
  private offset = 0
  private running = false
  private pollPromise: Promise<void> | null = null

  constructor(
    private readonly config: ConfigService,
    private readonly reports: TelegramReportService,
  ) {
    this.token = String(this.config.get('TELEGRAM_BOT_TOKEN') || '')
    this.chatId = String(this.config.get('TELEGRAM_CHAT_ID') || '')
    this.adminIds = this.parseAdminIds(this.config.get('TELEGRAM_ADMIN_IDS'))
    this.apiBaseUrl = String(
      this.config.get('TELEGRAM_API_URL') || 'https://api.telegram.org',
    ).replace(/\/+$/, '')
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
    this.logger.log(`Telegram bot polling started (api=${this.apiBaseUrl})`)
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
        await this.sleep(3000)
      }
    }
  }

  private async handleUpdate(update: TgUpdate): Promise<void> {
    const message = update.message
    if (!message?.text) {
      return
    }

    const cmd = this.parseCommand(message.text)
    if (!cmd) {
      return
    }

    const fromChatId = String(message.chat.id)

    // /start is public — helps discover chatId for TELEGRAM_ADMIN_IDS
    if (cmd === '/start') {
      await this.sendMessage(fromChatId, fromChatId)
      return
    }

    if (!this.isAdmin(fromChatId)) {
      return
    }

    if (cmd === '/ping') {
      await this.sendMessage(fromChatId, 'pong')
      return
    }

    if (cmd === '/sendreport') {
      await this.sendReportToChannel()
      if (fromChatId !== this.chatId) {
        await this.sendMessage(fromChatId, 'Report sent to channel')
      }
    }
  }

  private isAdmin(chatId: string): boolean {
    return this.adminIds.has(chatId)
  }

  private parseAdminIds(value: unknown): Set<string> {
    return new Set(
      String(value || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean),
    )
  }

  private parseCommand(text: string): string | null {
    const first = text.trim().split(/\s+/)[0]
    if (!first || !first.startsWith('/')) {
      return null
    }
    return first.replace(/@\w+$/, '').toLowerCase()
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private apiUrl(method: string, query = ''): string {
    return `${this.apiBaseUrl}/bot${this.token}/${method}${query}`
  }

  private async getUpdates(
    offset: number,
    timeoutSec: number,
  ): Promise<TgUpdate[]> {
    const url = this.apiUrl(
      'getUpdates',
      `?offset=${offset}&timeout=${timeoutSec}&allowed_updates=${encodeURIComponent(
        '["message"]',
      )}`,
    )
    const data = await this.httpJson(url)
    if (!data.ok) {
      throw new Error(`getUpdates failed: ${JSON.stringify(data)}`)
    }
    return (data.result || []) as TgUpdate[]
  }

  private async sendMessage(chatId: string, text: string): Promise<void> {
    const data = await this.httpJson(this.apiUrl('sendMessage'), {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    })
    if (!data.ok) {
      throw new Error(`sendMessage failed: ${JSON.stringify(data)}`)
    }
  }

  private httpJson(
    url: string,
    body?: Record<string, unknown>,
  ): Promise<{ ok: boolean; result?: unknown }> {
    const payload = body ? JSON.stringify(body) : undefined
    const u = new URL(url)
    const transport = u.protocol === 'http:' ? http : https

    return new Promise((resolve, reject) => {
      const req = transport.request(
        {
          hostname: u.hostname,
          port: u.port || undefined,
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
}
