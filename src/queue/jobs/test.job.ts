import { Injectable, Logger } from '@nestjs/common'
import { Job } from '../job.types'
import { Queueable } from '../queueable.interface'

@Injectable()
export class TestJob implements Queueable {
  readonly triesCount: number = 3
  readonly name = 'TestJob'

  private readonly logger = new Logger(TestJob.name)

  handle(job: Job): void {
    this.logger.log('Hello, World!')
    this.logger.log(job.payload)

    // throw new Error('test')
  }
}
