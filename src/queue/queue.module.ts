import { DynamicModule, Module, Type } from '@nestjs/common'
import { DbModule } from '../db/db.module'
import { QUEUEABLES } from './queue.constants'
import { JobRepository } from './job.repository'
import { TestJob } from './jobs/test.job'
import { Queueable } from './queueable.interface'
import { QueueRegistry } from './queue.registry'
import { QueueService } from './queue.service'
import { QueueWorker } from './queue.worker'

export type QueueModuleOptions = {
  /** Воркер с cron. Для CLI обычно false. Default: true */
  worker?: boolean
  /** Доп. импорты для зависимостей queueable-классов */
  imports?: DynamicModule['imports']
}

@Module({})
export class QueueModule {
  static register(
    queueables: Type<Queueable>[] = [],
    options: QueueModuleOptions = {},
  ): DynamicModule {
    const allQueueables = [TestJob, ...queueables]
    const enableWorker = options.worker !== false

    return {
      global: true,
      module: QueueModule,
      imports: [DbModule, ...(options.imports ?? [])],
      providers: [
        ...allQueueables,
        {
          provide: QUEUEABLES,
          useFactory: (...instances: Queueable[]) => instances,
          inject: allQueueables,
        },
        JobRepository,
        QueueRegistry,
        QueueService,
        ...(enableWorker ? [QueueWorker] : []),
      ],
      exports: [QueueService, JobRepository],
    }
  }
}
