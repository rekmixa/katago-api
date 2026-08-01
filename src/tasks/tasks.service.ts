import { Inject, Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { UserRepository } from '../db/repositories/user.repository'

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name)

  constructor(
    @Inject(UserRepository)
    private readonly userRepository: UserRepository,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async getTgUsers(): Promise<void> {
    // const users = await this.userRepository.findAll()

    // for (const user of users) {
    //   this.logger.debug(`user: ${user.id}`)
    // }
  }
}
