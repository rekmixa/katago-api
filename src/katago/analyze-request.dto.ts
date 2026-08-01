/**
 * Опциональные поля запроса KataGo Analysis Engine
 * (всё, кроме позиции/партии — они берутся из SGF).
 * @see https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md
 */
export type KatagoAnalyzeOptions = {
  analyzeTurns?: number[]
  maxVisits?: number
  rootPolicyTemperature?: number
  rootFpuReductionMax?: number
  analysisPVLen?: number
  includeOwnership?: boolean
  includeOwnershipStdev?: boolean
  includeMovesOwnership?: boolean
  includeMovesOwnershipStdev?: boolean
  includePolicy?: boolean
  includePVVisits?: boolean
  includeNoResultValue?: boolean
  avoidMoves?: Array<{
    player: string
    moves: string[]
    untilDepth: number
  }>
  allowMoves?: Array<{
    player: string
    moves: string[]
    untilDepth: number
  }>
  overrideSettings?: Record<string, unknown>
  reportDuringSearchEvery?: number
  priority?: number
  priorities?: number[]
  /** Переопределить правила из SGF */
  rules?: string
  /** Переопределить коми из SGF */
  komi?: number
  initialPlayer?: string
}

export type AnalyzeRequestDto = KatagoAnalyzeOptions & {
  sgf: string
}

export const KATAGO_OPTION_KEYS: (keyof KatagoAnalyzeOptions)[] = [
  'analyzeTurns',
  'maxVisits',
  'rootPolicyTemperature',
  'rootFpuReductionMax',
  'analysisPVLen',
  'includeOwnership',
  'includeOwnershipStdev',
  'includeMovesOwnership',
  'includeMovesOwnershipStdev',
  'includePolicy',
  'includePVVisits',
  'includeNoResultValue',
  'avoidMoves',
  'allowMoves',
  'overrideSettings',
  'reportDuringSearchEvery',
  'priority',
  'priorities',
  'rules',
  'komi',
  'initialPlayer',
]

export function pickKatagoOptions(
  body: Record<string, unknown>,
): KatagoAnalyzeOptions {
  const options: KatagoAnalyzeOptions = {}

  for (const key of KATAGO_OPTION_KEYS) {
    if (body[key] !== undefined) {
      ;(options as Record<string, unknown>)[key] = body[key]
    }
  }

  return options
}
