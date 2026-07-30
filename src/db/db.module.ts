import { Module } from '@nestjs/common'
import { KnexModule } from 'nestjs-knex'
import config from '../../knexfile'
import { UserRepository } from './repositories/user.repository'

@Module({
  imports: [
    KnexModule.forRoot({
      config,
    }),
  ],
  providers: [
    UserRepository,
  ],
  exports: [
    UserRepository,
  ],
})
export class DbModule {}
