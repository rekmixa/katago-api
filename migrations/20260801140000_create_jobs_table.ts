import { Knex } from 'knex'

const TABLE_NAME = 'jobs'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE_NAME, table => {
    table.bigIncrements('id').primary()
    table
      .enum('status', ['pending', 'running', 'done', 'failed'])
      .notNullable()
      .defaultTo('pending')
    table.string('queueable_class').notNullable()
    table.jsonb('payload').nullable()
    table.text('error').nullable()
    table
      .integer('attempts')
      .notNullable()
      .defaultTo(0)
    table
      .timestamp('created_at')
      .notNullable()
      .defaultTo(knex.fn.now())
    table.timestamp('started_at').nullable()
    table.timestamp('finished_at').nullable()

    table.index(['status', 'id'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable(TABLE_NAME)
}
