import { Module } from '@nestjs/common'
import { DbModule } from '../db/db.module'
import { KatagoController } from './katago.controller'
import { KatagoService } from './katago.service'
import { SgfAnalyzeResultRepository } from './sgf-analyze-result.repository'

@Module({
  imports: [DbModule],
  controllers: [KatagoController],
  providers: [SgfAnalyzeResultRepository, KatagoService],
  exports: [SgfAnalyzeResultRepository],
})
export class KatagoModule {}
