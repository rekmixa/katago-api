import { Injectable, Logger } from '@nestjs/common'
import { Job, Queueable } from '../../queue'
import { SgfAnalyzeResultRepository } from '../sgf-analyze-result.repository'

@Injectable()
export class SgfAnalyzeJob implements Queueable {
  readonly name = 'SgfAnalyzeJob'
  readonly triesCount = 1

  private readonly logger = new Logger(SgfAnalyzeJob.name)

  constructor(
    private readonly sgfAnalyzeResultRepository: SgfAnalyzeResultRepository,
  ) {}

  async handle(job: Job): Promise<void> {
    this.logger.log(`Mock analyze for job ${job.id}`)

    // Мок: реальный KataGo позже
    await this.sgfAnalyzeResultRepository.updateAnalyzeResult(job.id, {})
  }
}
