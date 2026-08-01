import { Module } from '@nestjs/common'
import { DbModule } from 'src/db/db.module'
import { TasksService } from './tasks.service'

@Module({
  imports: [DbModule],
  providers: [TasksService],
})
export class TasksModule {}
