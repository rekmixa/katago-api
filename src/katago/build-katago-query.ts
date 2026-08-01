import { KatagoAnalyzeOptions } from './analyze-request.dto'
import { ParsedSgf } from './sgf-parser.types'

export function buildKatagoQuery(
  queryId: string,
  parsed: ParsedSgf,
  options: KatagoAnalyzeOptions = {},
): Record<string, unknown> & { id: string; analyzeTurns: number[] } {
  const {
    rules: rulesOverride,
    komi: komiOverride,
    analyzeTurns: analyzeTurnsOverride,
    ...rest
  } = options

  const analyzeTurns = analyzeTurnsOverride ?? parsed.analyzeTurns

  const query: Record<string, unknown> & {
    id: string
    analyzeTurns: number[]
  } = {
    id: queryId,
    moves: parsed.moves,
    rules: rulesOverride ?? parsed.rules,
    komi: komiOverride ?? parsed.komi,
    boardXSize: parsed.boardXSize,
    boardYSize: parsed.boardYSize,
    analyzeTurns,
  }

  if (parsed.initialStones.length > 0) {
    query.initialStones = parsed.initialStones
  }

  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) {
      query[key] = value
    }
  }

  return query
}
