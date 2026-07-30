import { Command, CommandRunner, Option } from 'nest-commander'

interface TestCommandOptions {
  test: string
  someFlag: boolean
}

@Command({ name: 'test:test', description: 'Test command' })
export class TestCommand extends CommandRunner {
  async run(
    passedParam: string[],
    options: TestCommandOptions,
  ): Promise<void> {
    console.log('test')
    console.log(passedParam)
    console.log(options)
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
