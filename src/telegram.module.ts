import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { DbModule } from './db/db.module'
import { TelegramBotService } from './telegram/telegram-bot.service'
import { TelegramReportService } from './telegram/telegram-report.service'

@Module({
  imports: [ConfigModule.forRoot(), ScheduleModule.forRoot(), DbModule],
  providers: [TelegramReportService, TelegramBotService],
})
export class TelegramModule {}
