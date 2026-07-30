import { Knex } from 'knex'
import * as dotenv from 'dotenv'
dotenv.config()

export default {
  client: 'pg',
  connection: {
    host: String(process.env.DB_HOST),
    port: Number(process.env.DB_PORT),
    user: String(process.env.DB_USER),
    password: String(process.env.DB_PASSWORD),
    database: String(process.env.DB_NAME),
    charset: String(process.env.DB_CHARSET),
  },
  migrations: {
    tableName: 'migrations',
    directory: 'migrations',
    extension: 'ts',
  },
  seeds: {
    directory: 'seeds',
  },
} as Knex.Config
