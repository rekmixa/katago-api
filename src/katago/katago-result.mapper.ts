import { Injectable } from '@nestjs/common'
import { KatagoMove } from './sgf-parser.types'
import {
  AnalyzeMoveResult,
  KatagoTurnResponse,
} from './katago.types'

@Injectable()
export class KatagoResultMapper {
  mapMoves(
    moves: KatagoMove[],
    turnResponses: KatagoTurnResponse[],
    alternativesLimit = 10,
  ): AnalyzeMoveResult[] {
    const byTurn = new Map(
      turnResponses.map(response => [response.turnNumber, response]),
    )

    return moves.map((move, index) => {
      const turnNumber = index + 1
      const [color, coord] = move
      const after = byTurn.get(turnNumber)
      const before = byTurn.get(index)

      const root = after?.rootInfo
      const scoreLead = root?.scoreLead ?? 0
      const winrate = root?.winrate ?? 0

      const alternativesSource = before?.moveInfos ?? after?.moveInfos ?? []
      const alternatives = [...alternativesSource]
        .sort((a, b) => a.order - b.order)
        .slice(0, alternativesLimit)
        .map(info => ({
          coord: info.move,
          winrate: info.winrate,
          scoreLead: info.scoreLead,
          visits: info.visits ?? info.edgeVisits,
          prior: info.prior,
          order: info.order,
          pv: info.pv,
        }))

      return {
        turnNumber,
        color,
        coord,
        winrate,
        scoreLead,
        leader: this.leaderFromScoreLead(scoreLead),
        alternatives,
      }
    })
  }

  private leaderFromScoreLead(scoreLead: number): 'B' | 'W' | 'even' {
    if (scoreLead > 0.05) {
      return 'B'
    }
    if (scoreLead < -0.05) {
      return 'W'
    }
    return 'even'
  }
}
