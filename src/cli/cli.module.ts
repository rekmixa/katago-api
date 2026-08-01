import { Module } from '@nestjs/common'
import { CommandRunnerModule } from 'nest-commander'
import { TestCommand } from './commands/test.command'
import { DbModule } from '../db/db.module'
import { QueueModule } from '../queue'

@Module({
  imports: [
    CommandRunnerModule,
    DbModule,
    QueueModule.register([], { worker: false }),
  ],
  providers: [TestCommand],
})
export class CliModule {}
