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

    try {
      const job = await this.jobRepository.claimNextPending()
      if (!job) {
        return
      }

      const queueable = this.registry.get(job.queueable_class)
      if (!queueable) {
        const message = `Unknown queueable class: ${job.queueable_class}`
        this.logger.error(message)
        await this.jobRepository.markFailed(job.id, message)
        return
      }

      this.logger.log(`Running job ${job.id} (${job.queueable_class})`)

      try {
        await queueable.handle(job.payload)
        await this.jobRepository.markDone(job.id)
        this.logger.log(`Job ${job.id} done`)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error)
        this.logger.error(`Job ${job.id} failed: ${message}`)
        await this.jobRepository.markFailed(job.id, message)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Queue worker tick failed: ${message}`)
    } finally {
      this.busy = false
    }
  }
}
