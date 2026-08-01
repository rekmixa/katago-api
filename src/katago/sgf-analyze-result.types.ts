export interface SgfAnalyzeResult {
  id: number
  job_id: number
  sgf: string
  analyze_result: Record<string, unknown> | null
  created_at: Date
  updated_at: Date
}

export type SgfAnalyzeResultInsert = {
  job_id: number
  sgf: string
  analyze_result?: Record<string, unknown> | null
}
