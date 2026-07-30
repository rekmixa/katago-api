import { InjectKnex } from 'nestjs-knex'
import type { Knex } from 'knex'

export interface Entity extends Object {
  readonly id?: number
  readonly created_at?: Date
  readonly updated_at?: Date
}

export abstract class BaseRepository<
  TEntity extends Entity = any,
  TInsert = Omit<TEntity, 'id' | 'created_at' | 'updated_at'>,
  TUpdate = Partial<TInsert>
> {
  constructor(@InjectKnex() protected readonly knex: Knex) {}

  protected abstract tableName(): string

  protected table() {
    return this.knex.table<Knex.CompositeTableType<TEntity, TInsert, TUpdate>>(
      this.tableName(),
    )
  }

  async findAll(): Promise<TEntity[]> {
    return this.table()
      .select('*')
      .orderBy('id', 'desc')
      .returning('*')
  }

  async findById(id: number): Promise<TEntity | null> {
    const entity = await this.table()
      .select('*')
      .where('id', id)
      .first()

    if (entity) {
      return entity
    }

    return null
  }

  async getById(id: number): Promise<TEntity> {
    const entity = await this.findById(id)
    if (entity === null) {
      throw new Error(`Cannot get entity by id ${id}`)
    }

    return entity
  }

  async persist(entity: TEntity | TInsert | TUpdate): Promise<TEntity> {
    let result: TEntity[]

    if ((entity as TEntity).id !== undefined) {
      result = ((await this.table()
        .where('id', (entity as TEntity).id)
        .update({ ...(entity as any), updated_at: new Date() } as TUpdate)
        .returning('*')) as unknown) as TEntity[]
    } else {
      result = ((await this.table()
        .insert(entity as TInsert)
        .returning('*')) as unknown) as TEntity[]
    }

    if (!result || result[0] === undefined) {
      throw new Error('Cannot save entity')
    }

    Object.assign(entity, result[0])

    return result[0]
  }

  async delete(entity: TEntity): Promise<void> {
    await this.table()
      .where('id', entity.id)
      .delete()
  }
}
