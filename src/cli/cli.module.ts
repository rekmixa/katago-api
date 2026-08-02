import { Module } from '@nestjs/common'
import { CommandRunnerModule } from 'nest-commander'
import { RequeueFailedCommand } from './commands/requeue-failed.command'
import { TestCommand } from './commands/test.command'
import { DbModule } from '../db/db.module'
import { QueueModule } from '../queue'

@Module({
  imports: [
    CommandRunnerModule,
    DbModule,
    QueueModule.register([], { worker: false }),
  ],
  providers: [TestCommand, RequeueFailedCommand],
})
export class CliModule {}
