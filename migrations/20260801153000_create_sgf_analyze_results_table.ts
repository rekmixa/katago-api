import { Knex } from 'knex'

const TABLE_NAME = 'sgf_analyze_results'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE_NAME, table => {
    table.bigIncrements('id').primary()
    table
      .bigInteger('job_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('jobs')
    table.text('sgf').notNullable()
    table.string('sgf_md5', 32).notNullable()
    table.jsonb('analyze_result').nullable()
    table.timestamps(false, true)

    table.unique(['job_id'])
    table.unique(['sgf_md5'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable(TABLE_NAME)
}
