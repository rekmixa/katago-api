import { Injectable, Logger } from '@nestjs/common'
import { Queueable } from '../queueable.interface'

@Injectable()
export class TestJob implements Queueable {
  readonly triesCount: number = 3
  readonly name = 'TestJob'

  private readonly logger = new Logger(TestJob.name)

  handle(payload: Record<string, unknown>): void {
    this.logger.log('Hello, World!')
    this.logger.log(payload)

    // throw new Error('test')
  }
}
