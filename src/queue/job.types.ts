export enum JobStatus {
  Pending = 'pending',
  Running = 'running',
  Done = 'done',
  Failed = 'failed',
}

export interface Job {
  id: number
  status: JobStatus
  queueable_class: string
  payload: Record<string, unknown> | null
  error: string | null
  attempts: number
  created_at: Date
  started_at: Date | null
  finished_at: Date | null
}

export type JobInsert = {
  status?: JobStatus
  queueable_class: string
  payload?: Record<string, unknown> | null
  error?: string | null
  attempts?: number
  started_at?: Date | null
  finished_at?: Date | null
}
