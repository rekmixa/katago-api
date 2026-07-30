import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './http-exception.filter'
import Logger from './services/logger'

async function bootstrap() {
  process.setMaxListeners(0)
  const app = await NestFactory.create(AppModule, {
    logger: new Logger(),
  })

  app.useGlobalFilters(new HttpExceptionFilter())
  app.enableCors()
  await app.listen(3005)
}

bootstrap()
