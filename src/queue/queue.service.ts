import { Injectable } from '@nestjs/common'
import { JobRepository } from './job.repository'
import { Job } from './job.types'
import { Queueable } from './queueable.interface'
import { QueueRegistry } from './queue.registry'

@Injectable()
export class QueueService {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly registry: QueueRegistry,
  ) {}

  async dispatch(
    queueable: Queueable | string,
    payload: Record<string, unknown> = {},
  ): Promise<Job> {
    const queueableClass =
      typeof queueable === 'string' ? queueable : queueable.name

    if (!this.registry.get(queueableClass)) {
      throw new Error(`Unknown queueable class: ${queueableClass}`)
    }

    return this.jobRepository.create(queueableClass, payload)
  }

  async findById(id: number): Promise<Job | null> {
    return this.jobRepository.findById(id)
  }

  async requeueFailed(jobId?: number): Promise<number> {
    return this.jobRepository.requeueFailed(jobId)
  }
}
