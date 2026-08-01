import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { timingSafeEqual } from 'crypto'
import { Request } from 'express'

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('API_TOKEN')
    if (!expected) {
      throw new UnauthorizedException('API_TOKEN is not configured')
    }

    const request = context.switchToHttp().getRequest<Request>()
    const header = request.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header')
    }

    const provided = header.slice('Bearer '.length).trim()
    if (!this.tokensEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid API token')
    }

    return true
  }

  private tokensEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) {
      return false
    }
    return timingSafeEqual(bufA, bufB)
  }
}
