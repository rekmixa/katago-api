import { Knex } from 'knex'

const TABLE_NAME: string = 'users'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE_NAME, table => {
    table.increments()
    table.string('user_name').unique()
    table.string('first_name').nullable()
    table.string('password_hash').nullable()
    table.timestamps(false, true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable(TABLE_NAME)
}
