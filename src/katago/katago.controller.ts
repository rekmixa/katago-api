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
import { AnalyzeRequestDto } from './analyze-request.dto'
import { KatagoService } from './katago.service'

@Controller('api')
@UseGuards(ApiTokenGuard)
export class KatagoController {
  constructor(private readonly katagoService: KatagoService) {}

  @Post('analyze')
  async startAnalyze(@Body() body: AnalyzeRequestDto) {
    return this.katagoService.startAnalyze(body ?? { sgf: '' })
  }

  @Get('analyze/:jobId')
  async getAnalyze(@Param('jobId', ParseIntPipe) jobId: number) {
    return this.katagoService.getAnalyzeByJobId(jobId)
  }
}
