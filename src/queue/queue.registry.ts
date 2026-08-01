import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import { QUEUEABLES } from './queue.constants'
import { Queueable } from './queueable.interface'

@Injectable()
export class QueueRegistry {
  private readonly logger = new Logger(QueueRegistry.name)
  private readonly handlers = new Map<string, Queueable>()

  constructor(
    @Optional()
    @Inject(QUEUEABLES)
    queueables: Queueable[] | Queueable | null,
  ) {
    const list = !queueables
      ? []
      : Array.isArray(queueables)
      ? queueables
      : [queueables]

    for (const queueable of list) {
      if (this.handlers.has(queueable.name)) {
        throw new Error(`Duplicate queueable registered: ${queueable.name}`)
      }

      this.handlers.set(queueable.name, queueable)
      this.logger.log(`Registered queueable: ${queueable.name}`)
    }
  }

  get(name: string): Queueable | undefined {
    return this.handlers.get(name)
  }
}
