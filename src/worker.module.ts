import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { DbModule } from './db/db.module'
import { KatagoModule, SgfAnalyzeJob } from './katago'
import { QueueModule } from './queue'

/**
 * Queue/KataGo worker only — no HTTP.
 * Run via `yarn worker` / `node dist/worker`.
 */
@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    DbModule,
    KatagoModule,
    QueueModule.register([SgfAnalyzeJob], {
      worker: true,
      imports: [KatagoModule],
    }),
  ],
})
export class WorkerModule {}
