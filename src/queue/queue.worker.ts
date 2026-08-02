import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { JobRepository } from './job.repository'
import { QueueRegistry } from './queue.registry'

@Injectable()
export class QueueWorker implements OnModuleInit {
  private readonly logger = new Logger(QueueWorker.name)
  private busy = false

  constructor(
    private readonly jobRepository: JobRepository,
    private readonly registry: QueueRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.jobRepository.requeueRunning()
    if (count > 0) {
      this.logger.warn(`Requeued ${count} interrupted running job(s)`)
    }
  }

  @Cron(CronExpression.EVERY_SECOND)
  async tick(): Promise<void> {
    if (this.busy) {
      return
    }

    this.busy = true
    let jobId: number | null = null
    let outcome: 'done' | 'failed' | 'retry' | 'error' | null = null

    try {
      const job = await this.jobRepository.claimNextPending()
      if (!job) {
        return
      }

      jobId = job.id

      const queueable = this.registry.get(job.queueable_class)
      if (!queueable) {
        const message = `Unknown queueable class: ${job.queueable_class}`
        this.logger.error(message)
        await this.jobRepository.markFailed(job.id, message)
        outcome = 'failed'
        return
      }

      this.logger.log(`Running job ${job.id} (${job.queueable_class})`)

      try {
        await queueable.handle(job)
        await this.jobRepository.markDone(job.id)
        outcome = 'done'
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error)
        const triesCount = queueable.triesCount ?? 1
        const maxAttempts = Math.max(1, triesCount)

        if (job.attempts < maxAttempts) {
          this.logger.warn(
            `Job ${job.id} failed (attempt ${job.attempts}/${maxAttempts}), retrying: ${message}`,
          )
          await this.jobRepository.markForRetry(job.id, message)
          outcome = 'retry'
        } else {
          this.logger.error(
            `Job ${job.id} failed after ${job.attempts} attempt(s): ${message}`,
          )
          await this.jobRepository.markFailed(job.id, message)
          outcome = 'failed'
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Queue worker tick failed: ${message}`)
      outcome = 'error'
    } finally {
      this.busy = false
      if (jobId !== null && outcome !== null) {
        this.logger.log(
          `Job ${jobId} finished with status=${outcome}; queue is idle and ready for next job`,
        )
      }
    }
  }
}
