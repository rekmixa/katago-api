import { Injectable } from '@nestjs/common'
import { InjectKnex } from 'nestjs-knex'
import type { Knex } from 'knex'
import { Job, JobInsert, JobStatus } from './job.types'

@Injectable()
export class JobRepository {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  private table() {
    return this.knex.table<Job>('jobs')
  }

  async findById(id: number): Promise<Job | null> {
    const job = await this.table()
      .where('id', id)
      .first()

    return job ? this.normalize(job) : null
  }

  async findByIds(ids: number[]): Promise<Job[]> {
    if (ids.length === 0) {
      return []
    }

    const jobs = await this.table().whereIn('id', ids)
    return jobs.map(job => this.normalize(job))
  }

  async create(
    queueableClass: string,
    payload: Record<string, unknown> | null = null,
  ): Promise<Job> {
    const insert: JobInsert = {
      status: JobStatus.Pending,
      queueable_class: queueableClass,
      payload,
      error: null,
      attempts: 0,
      started_at: null,
      finished_at: null,
    }

    const [job] = (await this.table()
      .insert(insert)
      .returning('*')) as Job[]

    if (!job) {
      throw new Error('Cannot create job')
    }

    return this.normalize(job)
  }

  async claimNextPending(): Promise<Job | null> {
    return this.knex.transaction(async trx => {
      const pending = await trx<Job>('jobs')
        .where('status', JobStatus.Pending)
        .orderBy('id', 'asc')
        .forUpdate()
        .skipLocked()
        .first()

      if (!pending) {
        return null
      }

      const [job] = (await trx<Job>('jobs')
        .where('id', pending.id)
        .update({
          status: JobStatus.Running,
          started_at: new Date(),
          attempts: pending.attempts + 1,
        })
        .returning('*')) as Job[]

      return job ? this.normalize(job) : null
    })
  }

  async markDone(id: number): Promise<void> {
    await this.table()
      .where('id', id)
      .update({
        status: JobStatus.Done,
        error: null,
        finished_at: new Date(),
      })
  }

  async markFailed(id: number, error: string): Promise<void> {
    await this.table()
      .where('id', id)
      .update({
        status: JobStatus.Failed,
        error,
        finished_at: new Date(),
      })
  }

  async markForRetry(id: number, error: string): Promise<void> {
    await this.table()
      .where('id', id)
      .update({
        status: JobStatus.Pending,
        error,
        started_at: null,
        finished_at: null,
      })
  }

  async requeueRunning(): Promise<number> {
    return this.table()
      .where('status', JobStatus.Running)
      .update({
        status: JobStatus.Pending,
        started_at: null,
      })
  }

  async requeueFailed(jobId?: number): Promise<number> {
    const query = this.table().where('status', JobStatus.Failed)

    if (jobId !== undefined) {
      query.andWhere('id', jobId)
    }

    return query.update({
      status: JobStatus.Pending,
      error: null,
      attempts: 0,
      started_at: null,
      finished_at: null,
    })
  }

  /** node-pg отдаёт bigint строкой — приводим id к number */
  private normalize(job: Job): Job {
    return {
      ...job,
      id: Number(job.id),
    }
  }
}
