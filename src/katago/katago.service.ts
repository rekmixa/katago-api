import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { md5 } from '../helpers'
import { JobStatus, QueueService } from '../queue'
import { SgfAnalyzeJob } from './jobs/sgf-analyze.job'
import { SgfAnalyzeResultRepository } from './sgf-analyze-result.repository'

export type AnalyzeStatusResponse = {
  jobId: number
  status: JobStatus
  sgf: string
  analyzeResult: Record<string, unknown> | null
  error: string | null
}

@Injectable()
export class KatagoService {
  constructor(
    private readonly queueService: QueueService,
    private readonly sgfAnalyzeResultRepository: SgfAnalyzeResultRepository,
  ) {}

  async startAnalyze(sgf: string): Promise<{ jobId: number }> {
    const normalized = sgf.trim()
    if (!normalized) {
      throw new BadRequestException('sgf is required')
    }

    const sgfMd5 = md5(normalized)
    const existing = await this.sgfAnalyzeResultRepository.findBySgfMd5(sgfMd5)
    if (existing) {
      throw new ConflictException({
        message: 'Analyze for this sgf already exists',
        jobId: existing.job_id,
      })
    }

    const job = await this.queueService.dispatch(SgfAnalyzeJob.name, {
      sgf: normalized,
    })

    await this.sgfAnalyzeResultRepository.create({
      job_id: job.id,
      sgf: normalized,
      sgf_md5: sgfMd5,
      analyze_result: null,
    })

    return { jobId: job.id }
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
}
