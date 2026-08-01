/** Ход в формате KataGo Analysis Engine: [цвет, GTP-координата] */
export type KatagoMove = [string, string]

export type ParsedSgf = {
  boardXSize: number
  boardYSize: number
  rules: string
  komi: number
  initialStones: KatagoMove[]
  moves: KatagoMove[]
  /** Ходы для анализа: 0 = стартовая позиция, N = после N-го хода */
  analyzeTurns: number[]
}
