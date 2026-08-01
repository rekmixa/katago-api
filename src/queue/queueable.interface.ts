import { Job } from './job.types'

export interface Queueable {
  /** Имя, которое пишется в jobs.queueable_class */
  readonly name: string

  /**
   * Сколько раз пытаться выполнить джобу.
   * По умолчанию 1.
   */
  readonly triesCount?: number

  handle(job: Job): Promise<void> | void
}
