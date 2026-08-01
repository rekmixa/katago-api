import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common'
import { KatagoService } from './katago.service'

@Controller('api')
export class KatagoController {
  constructor(private readonly katagoService: KatagoService) {}

  @Post('analyze')
  async startAnalyze(@Body() body: { sgf?: string }) {
    return this.katagoService.startAnalyze(body?.sgf ?? '')
  }

  @Get('analyze/:jobId')
  async getAnalyze(@Param('jobId', ParseIntPipe) jobId: number) {
    return this.katagoService.getAnalyzeByJobId(jobId)
  }
}
