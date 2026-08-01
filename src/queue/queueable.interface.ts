export interface Queueable {
  /** Имя, которое пишется в jobs.queueable_class */
  readonly name: string

  handle(payload: Record<string, unknown> | null): Promise<void> | void
}
