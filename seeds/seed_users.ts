import { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  await knex('users').insert([
    { user_name: 'test' },
  ])
}
