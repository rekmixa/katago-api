import { Injectable } from '@nestjs/common'
import { BaseRepository, Entity } from './base.repository'

export interface User extends Entity {
  user_name: string
  first_name: string | null
  password_hash: string | null
}

@Injectable()
export class UserRepository extends BaseRepository<User> {
  protected tableName(): string {
    return 'users'
  }

  async findByLogin(login: string): Promise<User | null> {
    return this.table()
      .select('*')
      .where('user_name', login)
      .first()
  }
}
