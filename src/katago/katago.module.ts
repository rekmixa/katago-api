import { Module } from '@nestjs/common'
import { DbModule } from '../db/db.module'
import { KatagoController } from './katago.controller'
import { KatagoService } from './katago.service'
import { SgfAnalyzeResultRepository } from './sgf-analyze-result.repository'
import { SgfParserService } from './sgf-parser.service'

@Module({
  imports: [DbModule],
  controllers: [KatagoController],
  providers: [SgfAnalyzeResultRepository, SgfParserService, KatagoService],
  exports: [SgfAnalyzeResultRepository, SgfParserService],
})
export class KatagoModule {}
