import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common'
import { AnalyzeRequestDto } from './analyze-request.dto'
import { KatagoService } from './katago.service'

@Controller('api')
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
