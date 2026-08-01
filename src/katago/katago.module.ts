import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ApiTokenGuard } from '../auth/api-token.guard'
import { DbModule } from '../db/db.module'
import { KatagoClientService } from './katago-client.service'
import { KatagoController } from './katago.controller'
import { KatagoResultMapper } from './katago-result.mapper'
import { KatagoService } from './katago.service'
import { SgfAnalyzeResultRepository } from './sgf-analyze-result.repository'
import { SgfParserService } from './sgf-parser.service'

@Module({
  imports: [ConfigModule, DbModule],
  controllers: [KatagoController],
  providers: [
    ApiTokenGuard,
    SgfAnalyzeResultRepository,
    SgfParserService,
    KatagoClientService,
    KatagoResultMapper,
    KatagoService,
  ],
  exports: [
    SgfAnalyzeResultRepository,
    SgfParserService,
    KatagoClientService,
    KatagoResultMapper,
  ],
})
export class KatagoModule {}
