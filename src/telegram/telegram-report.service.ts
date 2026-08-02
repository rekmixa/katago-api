import { Injectable } from '@nestjs/common'
import { InjectKnex } from 'nestjs-knex'
import type { Knex } from 'knex'
import { JobStatus } from '../queue/job.types'

export interface QueueStats {
  doneLastHour: number
  doneTotal: number
  failedTotal: number
  remaining: number
  avgDurationSec: number | null
}

@Injectable()
export class TelegramReportService {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  async getStats(): Promise<QueueStats> {
    const [doneLastHourRow] = await this.knex('jobs')
      .where('status', JobStatus.Done)
      .whereRaw("finished_at >= now() - interval '1 hour'")
      .count<{ count: string }>({ count: '*' })

    const [doneTotalRow] = await this.knex('jobs')
      .where('status', JobStatus.Done)
      .count<{ count: string }>({ count: '*' })

    const [failedTotalRow] = await this.knex('jobs')
      .where('status', JobStatus.Failed)
      .count<{ count: string }>({ count: '*' })

    const [remainingRow] = await this.knex('jobs')
      .whereIn('status', [JobStatus.Pending, JobStatus.Running])
      .count<{ count: string }>({ count: '*' })

    const avgResult = await this.knex('jobs')
      .where('status', JobStatus.Done)
      .whereRaw("finished_at >= now() - interval '1 hour'")
      .whereNotNull('started_at')
      .whereNotNull('finished_at')
      .select(
        this.knex.raw(
          'avg(extract(epoch from (finished_at - started_at))) as avg',
        ),
      )
      .first<{ avg: string | null }>()

    const avg =
      avgResult?.avg != null && Number(avgResult.avg) > 0
        ? Number(avgResult.avg)
        : null

    return {
      doneLastHour: Number(doneLastHourRow?.count ?? 0),
      doneTotal: Number(doneTotalRow?.count ?? 0),
      failedTotal: Number(failedTotalRow?.count ?? 0),
      remaining: Number(remainingRow?.count ?? 0),
      avgDurationSec: avg,
    }
  }

  formatReport(stats: QueueStats): string {
    const lines = [
      '📊 KataGo — сводка',
      '',
      `За час: ${stats.doneLastHour}`,
      `Всего готово: ${stats.doneTotal}`,
      `Ошибок: ${stats.failedTotal}`,
      `В очереди: ${stats.remaining}`,
    ]

    const eta = this.formatEta(stats)
    lines.push('')
    lines.push(eta)

    return lines.join('\n')
  }

  private formatEta(stats: QueueStats): string {
    if (stats.remaining <= 0) {
      return 'Оценка: очередь пуста'
    }

    let secondsLeft: number | null = null
    let rateNote = ''

    if (stats.doneLastHour > 0) {
      secondsLeft = (stats.remaining / stats.doneLastHour) * 3600
      rateNote = `~${stats.doneLastHour} парт/ч`
    } else if (stats.avgDurationSec != null) {
      secondsLeft = stats.remaining * stats.avgDurationSec
      rateNote = `~${Math.round(stats.avgDurationSec)} с/партия (по последнему часу)`
    }

    if (secondsLeft == null) {
      return 'Оценка: недостаточно данных за последний час'
    }

    const etaText = this.humanDuration(secondsLeft)
    const finishAt = new Date(Date.now() + secondsLeft * 1000)
    const finishStr = finishAt.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

    return `Оценка: ещё ~${etaText} (${rateNote})\nДо ~${finishStr}`
  }

  private humanDuration(totalSec: number): string {
    const sec = Math.max(0, Math.round(totalSec))
    const days = Math.floor(sec / 86400)
    const hours = Math.floor((sec % 86400) / 3600)
    const mins = Math.floor((sec % 3600) / 60)

    if (days > 0) {
      return `${days} д ${hours} ч`
    }
    if (hours > 0) {
      return `${hours} ч ${mins} мин`
    }
    return `${mins} мин`
  }
}
