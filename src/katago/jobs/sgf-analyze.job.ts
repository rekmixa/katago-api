import { Injectable, Logger } from '@nestjs/common'
import { Job, Queueable } from '../../queue'
import { SgfAnalyzeResultRepository } from '../sgf-analyze-result.repository'
import { SgfParserService } from '../sgf-parser.service'

@Injectable()
export class SgfAnalyzeJob implements Queueable {
  readonly name = 'SgfAnalyzeJob'
  readonly triesCount = 1

  private readonly logger = new Logger(SgfAnalyzeJob.name)

  constructor(
    private readonly sgfAnalyzeResultRepository: SgfAnalyzeResultRepository,
    private readonly sgfParserService: SgfParserService,
  ) {}

  async handle(job: Job): Promise<void> {
    const sgf = job.payload?.sgf
    if (typeof sgf !== 'string' || !sgf.trim()) {
      throw new Error('Job payload.sgf is required')
    }

    this.logger.log(`Parsing SGF for job ${job.id}`)
    const parsed = this.sgfParserService.parse(sgf)

    this.logger.log(
      `Parsed job ${job.id}: ${parsed.boardXSize}x${parsed.boardYSize}, ` +
        `${parsed.moves.length} moves, komi=${parsed.komi}, rules=${parsed.rules}`,
    )

    // Пока мок: сохраняем распарсенную структуру (KataGo подключим позже)
    await this.sgfAnalyzeResultRepository.updateAnalyzeResult(job.id, {
      parsed,
    })
  }
}
