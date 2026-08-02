import { Command, CommandRunner, Option } from 'nest-commander'
import { JobStatus, QueueService } from '../../queue'

interface RequeueFailedOptions {
  jobId?: number
}

@Command({
  name: 'queue:requeue-failed',
  description:
    'Move failed jobs back to pending (clear error, attempts, started_at, finished_at)',
})
export class RequeueFailedCommand extends CommandRunner {
  constructor(private readonly queueService: QueueService) {
    super()
  }

  async run(
    _passedParam: string[],
    options: RequeueFailedOptions,
  ): Promise<void> {
    const jobId = options.jobId

    if (jobId !== undefined) {
      const job = await this.queueService.findById(jobId)
      if (!job) {
        console.error(`Job ${jobId} not found`)
        return
      }
      if (job.status !== JobStatus.Failed) {
        console.error(`Job ${jobId} is not failed (status=${job.status})`)
        return
      }
    }

    const count = await this.queueService.requeueFailed(jobId)

    if (jobId !== undefined) {
      console.log(
        count > 0
          ? `Requeued failed job ${jobId} → pending`
          : `No failed job updated for id=${jobId}`,
      )
      return
    }

    console.log(`Requeued ${count} failed job(s) → pending`)
  }

  @Option({
    flags: '-j, --job-id <number>',
    description: 'Requeue only this failed job id',
  })
  parseJobId(val: string): number {
    const id = Number(val)
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('--job-id must be a positive integer')
    }
    return id
  }
}
