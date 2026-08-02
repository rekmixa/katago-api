import { NestFactory } from '@nestjs/core'
import Logger from './services/logger'
import { TelegramModule } from './telegram.module'

async function bootstrap() {
  process.setMaxListeners(0)
  const app = await NestFactory.createApplicationContext(TelegramModule, {
    logger: new Logger(),
  })

  app.enableShutdownHooks()
}

bootstrap().catch(error => {
  console.error(error)
  process.exit(1)
})
