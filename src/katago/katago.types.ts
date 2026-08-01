export type KatagoMoveInfo = {
  move: string
  order: number
  visits?: number
  edgeVisits?: number
  winrate?: number
  scoreLead?: number
  scoreMean?: number
  prior?: number
  pv?: string[]
  [key: string]: unknown
}

export type KatagoRootInfo = {
  winrate: number
  scoreLead: number
  scoreSelfplay?: number
  scoreStdev?: number
  utility?: number
  visits?: number
  currentPlayer?: string
  [key: string]: unknown
}

export type KatagoTurnResponse = {
  id: string
  turnNumber: number
  isDuringSearch?: boolean
  moveInfos: KatagoMoveInfo[]
  rootInfo: KatagoRootInfo
  ownership?: number[]
  policy?: number[]
  [key: string]: unknown
}

export type AnalyzeMoveResult = {
  turnNumber: number
  color: string
  coord: string
  winrate: number
  scoreLead: number
  leader: 'B' | 'W' | 'even'
  alternatives: Array<{
    coord: string
    winrate?: number
    scoreLead?: number
    visits?: number
    prior?: number
    order: number
    pv?: string[]
  }>
}
