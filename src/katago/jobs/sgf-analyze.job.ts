import { Injectable, Logger } from '@nestjs/common'
import { Job, Queueable } from '../../queue'
import { pickKatagoOptions } from '../analyze-request.dto'
import { buildKatagoQuery } from '../build-katago-query'
import { KatagoClientService } from '../katago-client.service'
import { KatagoResultMapper } from '../katago-result.mapper'
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
    private readonly katagoClientService: KatagoClientService,
    private readonly katagoResultMapper: KatagoResultMapper,
  ) {}

  async handle(job: Job): Promise<void> {
    const payload = job.payload ?? {}
    const sgf = payload.sgf
    if (typeof sgf !== 'string' || !sgf.trim()) {
      throw new Error('Job payload.sgf is required')
    }

    const options = pickKatagoOptions(payload)

    this.logger.log(`Parsing SGF for job ${job.id}`)
    const parsed = this.sgfParserService.parse(sgf)

    this.logger.log(
      `Parsed job ${job.id}: ${parsed.boardXSize}x${parsed.boardYSize}, ` +
        `${parsed.moves.length} moves, komi=${parsed.komi}, rules=${parsed.rules}`,
    )

    const query = buildKatagoQuery(`job-${job.id}`, parsed, options)
    this.logger.log(
      `Sending KataGo query for job ${job.id} (${query.analyzeTurns.length} turns)`,
    )

    const turnResponses = await this.katagoClientService.analyze(query)
    const moves = this.katagoResultMapper.mapMoves(
      parsed.moves,
      turnResponses,
      10,
    )

    await this.sgfAnalyzeResultRepository.updateAnalyzeResult(job.id, {
      moves,
      meta: {
        boardXSize: parsed.boardXSize,
        boardYSize: parsed.boardYSize,
        rules: query.rules,
        komi: query.komi,
        movesCount: parsed.moves.length,
        options,
      },
    })
  }
}
