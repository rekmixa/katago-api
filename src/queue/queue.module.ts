import { DynamicModule, Module, Type } from '@nestjs/common'
import { DbModule } from '../db/db.module'
import { QUEUEABLES } from './queue.constants'
import { JobRepository } from './job.repository'
import { Queueable } from './queueable.interface'
import { QueueRegistry } from './queue.registry'
import { QueueService } from './queue.service'
import { QueueWorker } from './queue.worker'

@Module({})
export class QueueModule {
  static register(queueables: Type<Queueable>[] = []): DynamicModule {
    return {
      module: QueueModule,
      imports: [DbModule],
      providers: [
        ...queueables,
        {
          provide: QUEUEABLES,
          useFactory: (...instances: Queueable[]) => instances,
          inject: queueables,
        },
        JobRepository,
        QueueRegistry,
        QueueService,
        QueueWorker,
      ],
      exports: [QueueService, JobRepository],
    }
  }
}
