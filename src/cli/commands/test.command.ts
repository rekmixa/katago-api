import { Command, CommandRunner, Option } from 'nest-commander'
import { QueueService } from '../../queue'
import { TestJob } from '../../queue/jobs/test.job'

interface TestCommandOptions {
  test: string
  someFlag: boolean
}

@Command({ name: 'test:test', description: 'Test command' })
export class TestCommand extends CommandRunner {
  constructor(private readonly queueService: QueueService) {
    super()
  }

  async run(passedParam: string[], options: TestCommandOptions): Promise<void> {
    console.log('test')
    console.log(passedParam)
    console.log(options)

    for (let i = 0; i < 10; i++) {
      const job = await this.queueService.dispatch(TestJob.name, { ...options })
      console.log(`Dispatched job: ${job.id}`)
    }
  }

  @Option({
    flags: '-t, --test [string]',
    description: 'Some string',
  })
  parseTest(val: string): string {
    return val
  }

  @Option({
    flags: '-sf, --some-flag [boolean]',
    description: 'Some boolean flag',
  })
  parseSomeFlag(val: boolean): boolean {
    return val
  }
}
