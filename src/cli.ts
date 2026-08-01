import { CommandFactory } from 'nest-commander'
import { CliModule } from './cli/cli.module'

async function bootstrap() {
  await CommandFactory.run(CliModule)
  // Knex держит пул соединений — без явного exit процесс не завершится
  process.exit(0)
}

bootstrap().catch(error => {
  console.error(error)
  process.exit(1)
})
