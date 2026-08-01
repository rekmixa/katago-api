import { Injectable } from '@nestjs/common'
import { InjectKnex } from 'nestjs-knex'
import type { Knex } from 'knex'
import {
  SgfAnalyzeResult,
  SgfAnalyzeResultInsert,
} from './sgf-analyze-result.types'

@Injectable()
export class SgfAnalyzeResultRepository {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  private table() {
    return this.knex.table<SgfAnalyzeResult>('sgf_analyze_results')
  }

  async create(data: SgfAnalyzeResultInsert): Promise<SgfAnalyzeResult> {
    const [row] = (await this.table()
      .insert({
        job_id: data.job_id,
        sgf: data.sgf,
        sgf_md5: data.sgf_md5,
        analyze_result: data.analyze_result ?? null,
      })
      .returning('*')) as SgfAnalyzeResult[]

    if (!row) {
      throw new Error('Cannot create sgf analyze result')
    }

    return this.normalize(row)
  }

  async findByJobId(jobId: number): Promise<SgfAnalyzeResult | null> {
    const row = await this.table()
      .where('job_id', jobId)
      .first()

    return row ? this.normalize(row) : null
  }

  async findBySgfMd5(sgfMd5: string): Promise<SgfAnalyzeResult | null> {
    const row = await this.table()
      .where('sgf_md5', sgfMd5)
      .first()

    return row ? this.normalize(row) : null
  }

  async updateAnalyzeResult(
    jobId: number,
    analyzeResult: Record<string, unknown>,
  ): Promise<void> {
    const updated = await this.table()
      .where('job_id', jobId)
      .update({
        analyze_result: analyzeResult,
        updated_at: new Date(),
      })

    if (!updated) {
      throw new Error(`Sgf analyze result for job ${jobId} not found`)
    }
  }

  private normalize(row: SgfAnalyzeResult): SgfAnalyzeResult {
    return {
      ...row,
      id: Number(row.id),
      job_id: Number(row.job_id),
    }
  }
}
