import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common'
import { ApiTokenGuard } from '../auth/api-token.guard'
import {
  AnalyzeBatchRequestDto,
  AnalyzeRequestDto,
} from './analyze-request.dto'
import { KatagoService } from './katago.service'

@Controller('api')
@UseGuards(ApiTokenGuard)
export class KatagoController {
  constructor(private readonly katagoService: KatagoService) {}

  @Post('analyze')
  async startAnalyze(@Body() body: AnalyzeRequestDto) {
    return this.katagoService.startAnalyze(body ?? { sgf: '' })
  }

  @Post('analyze/batch')
  async startAnalyzeBatch(@Body() body: AnalyzeBatchRequestDto) {
    return this.katagoService.startAnalyzeBatch(body ?? { sgfs: [] })
  }

  @Get('analyze/:jobId')
  async getAnalyze(@Param('jobId', ParseIntPipe) jobId: number) {
    return this.katagoService.getAnalyzeByJobId(jobId)
  }
}
