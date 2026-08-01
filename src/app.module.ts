import { Logger, Module, OnApplicationBootstrap } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { AppController } from './app.controller'
import { DbModule } from './db/db.module'
import { QueueModule } from './queue'
import { TasksModule } from './tasks/tasks.module'

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    DbModule,
    QueueModule.register([]),
    TasksModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule implements OnApplicationBootstrap {
  private logger: Logger = new Logger(AppModule.name)

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('onApplicationBootstrap')
  }
}
