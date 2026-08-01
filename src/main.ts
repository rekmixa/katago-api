import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './http-exception.filter'
import Logger from './services/logger'

async function bootstrap() {
  process.setMaxListeners(0)
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new Logger(),
  })

  // Default Express limit is ~100kb — too small for POST /api/analyze/batch (up to 1000 SGFs)
  const bodyLimit = process.env.BODY_LIMIT ?? '50mb'
  app.useBodyParser('json', { limit: bodyLimit })
  app.useBodyParser('urlencoded', { limit: bodyLimit, extended: true })

  app.useGlobalFilters(new HttpExceptionFilter())
  app.enableCors()
  await app.listen(3005)
}

bootstrap()
