import { Module } from '@nestjs/common'
import { CommandRunnerModule } from 'nest-commander'
import { TestCommand } from './commands/test.command'
import { DbModule } from '../db/db.module'

@Module({
  imports: [CommandRunnerModule, DbModule],
  providers: [TestCommand],
})
export class CliModule {}
