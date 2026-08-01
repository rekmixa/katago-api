import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { md5 } from '../helpers'
import { JobStatus, QueueService } from '../queue'
import {
  ANALYZE_BATCH_MAX_SIZE,
  AnalyzeBatchRequestDto,
  AnalyzeRequestDto,
  KatagoAnalyzeOptions,
  pickKatagoOptions,
} from './analyze-request.dto'
import { SgfAnalyzeJob } from './jobs/sgf-analyze.job'
import { SgfAnalyzeResultRepository } from './sgf-analyze-result.repository'

export type AnalyzeStatusResponse = {
  jobId: number
  status: JobStatus
  sgf: string
  analyzeResult: Record<string, unknown> | null
  error: string | null
}

export enum AnalyzeBatchItemResultStatus {
  Queued = 'queued',
  Exists = 'exists',
  Error = 'error',
}

export type AnalyzeBatchItemResult =
  | {
      index: number
      sgfMd5: string
      status: AnalyzeBatchItemResultStatus.Queued
      jobId: number
    }
  | {
      index: number
      sgfMd5: string
      status: AnalyzeBatchItemResultStatus.Exists
      jobId: number
    }
  | {
      index: number
      sgfMd5: string | null
      status: AnalyzeBatchItemResultStatus.Error
      error: string
    }

@Injectable()
export class KatagoService {
  constructor(
    private readonly queueService: QueueService,
    private readonly sgfAnalyzeResultRepository: SgfAnalyzeResultRepository,
  ) {}

  async startAnalyze(
    body: AnalyzeRequestDto | Record<string, unknown>,
  ): Promise<{ jobId: number }> {
    const sgfRaw = typeof body.sgf === 'string' ? body.sgf : ''
    if (!sgfRaw) {
      throw new BadRequestException('sgf is required')
    }

    const options = pickKatagoOptions(body as Record<string, unknown>)
    const result = await this.enqueueSgf(sgfRaw, options)

    if (result.status === 'exists') {
      throw new ConflictException({
        message: 'Analyze for this sgf already exists',
        jobId: result.jobId,
      })
    }

    return { jobId: result.jobId }
  }

  async startAnalyzeBatch(
    body: AnalyzeBatchRequestDto,
  ): Promise<{ results: AnalyzeBatchItemResult[] }> {
    if (body.sgfs.length === 0) {
      throw new BadRequestException('sgfs must not be empty')
    }
    if (body.sgfs.length > ANALYZE_BATCH_MAX_SIZE) {
      throw new BadRequestException(
        `sgfs must contain at most ${ANALYZE_BATCH_MAX_SIZE} items`,
      )
    }

    const options = pickKatagoOptions(body as Record<string, unknown>)

    const md5List = body.sgfs.map(sgf => md5(sgf))
    const existingRows = await this.sgfAnalyzeResultRepository.findBySgfMd5In(
      md5List,
    )
    const existingByMd5 = new Map(
      existingRows.map(row => [row.sgf_md5, row.job_id]),
    )

    const results: AnalyzeBatchItemResult[] = []
    const queuedInBatch = new Map<string, number>()

    for (let index = 0; index < body.sgfs.length; index++) {
      const sgf = body.sgfs[index]
      const sgfMd5 = md5List[index]
      const existingJobId =
        existingByMd5.get(sgfMd5) ?? queuedInBatch.get(sgfMd5)

      if (existingJobId !== undefined) {
        results.push({
          index,
          sgfMd5,
          status: AnalyzeBatchItemResultStatus.Exists,
          jobId: existingJobId,
        })
        continue
      }

      try {
        const enqueued = await this.createAnalyzeJob(
          sgf,
          sgfMd5,
          options,
        )
        queuedInBatch.set(sgfMd5, enqueued.jobId)
        existingByMd5.set(sgfMd5, enqueued.jobId)
        results.push({
          index,
          sgfMd5,
          status: AnalyzeBatchItemResultStatus.Queued,
          jobId: enqueued.jobId,
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to enqueue sgf'
        results.push({
          index,
          sgfMd5,
          status: AnalyzeBatchItemResultStatus.Error,
          error: message,
        })
      }
    }

    return { results }
  }

  async getAnalyzeByJobId(jobId: number): Promise<AnalyzeStatusResponse> {
    const job = await this.queueService.findById(jobId)
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`)
    }

    const result = await this.sgfAnalyzeResultRepository.findByJobId(jobId)
    if (!result) {
      throw new NotFoundException(`Analyze result for job ${jobId} not found`)
    }

    return {
      jobId: job.id,
      status: job.status,
      sgf: result.sgf,
      analyzeResult: result.analyze_result,
      error: job.error,
    }
  }

  private async enqueueSgf(
    normalized: string,
    options: KatagoAnalyzeOptions,
  ): Promise<{ status: 'queued' | 'exists'; jobId: number }> {
    const sgfMd5 = md5(normalized)
    const existing = await this.sgfAnalyzeResultRepository.findBySgfMd5(sgfMd5)
    if (existing) {
      return { status: 'exists', jobId: existing.job_id }
    }

    return this.createAnalyzeJob(normalized, sgfMd5, options)
  }

  private async createAnalyzeJob(
    sgf: string,
    sgfMd5: string,
    options: KatagoAnalyzeOptions,
  ): Promise<{ status: 'queued'; jobId: number }> {
    const payload = {
      sgf,
      ...options,
    }

    const job = await this.queueService.dispatch(SgfAnalyzeJob.name, payload)

    await this.sgfAnalyzeResultRepository.create({
      job_id: job.id,
      sgf,
      sgf_md5: sgfMd5,
      analyze_result: null,
    })

    return { status: 'queued', jobId: job.id }
  }
}
