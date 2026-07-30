import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common'
import { Response } from 'express'

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    const status = exception.getStatus()
    const res: any = exception.getResponse()

    // заголовки из payload
    if (res?.headers) {
      for (const [key, value] of Object.entries(res.headers)) {
        response.setHeader(key, value as string)
      }
      delete res.headers
    }

    // fallback
    response.status(status).json(res)
  }
}
