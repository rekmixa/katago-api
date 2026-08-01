import { Injectable } from '@nestjs/common'
import * as sgf from '@sabaki/sgf'
import { KatagoMove, ParsedSgf } from './sgf-parser.types'

@Injectable()
export class SgfParserService {
  parse(sgfContent: string): ParsedSgf {
    const roots = sgf.parse(sgfContent)
    if (!roots.length) {
      throw new Error('SGF is empty or invalid')
    }

    const root = roots[0]
    const { boardXSize, boardYSize } = this.parseBoardSize(root.data.SZ?.[0])
    const komi = this.parseKomi(root.data.KM?.[0])
    const rules = this.parseRules(root.data.RU?.[0])
    const initialStones = this.parseInitialStones(root, boardXSize, boardYSize)
    const moves = this.parseMainLineMoves(root, boardXSize, boardYSize)

    const analyzeTurns = Array.from({ length: moves.length + 1 }, (_, i) => i)

    return {
      boardXSize,
      boardYSize,
      rules,
      komi,
      initialStones,
      moves,
      analyzeTurns,
    }
  }

  private parseBoardSize(
    sz?: string,
  ): { boardXSize: number; boardYSize: number } {
    if (!sz) {
      return { boardXSize: 19, boardYSize: 19 }
    }

    if (sz.includes(':')) {
      const [x, y] = sz.split(':').map(Number)
      if (!x || !y) {
        throw new Error(`Invalid SZ property: ${sz}`)
      }
      return { boardXSize: x, boardYSize: y }
    }

    const size = Number(sz)
    if (!size) {
      throw new Error(`Invalid SZ property: ${sz}`)
    }

    return { boardXSize: size, boardYSize: size }
  }

  private parseKomi(km?: string): number {
    if (km === undefined || km === '') {
      return 0
    }

    const komi = Number(km)
    if (Number.isNaN(komi)) {
      throw new Error(`Invalid KM property: ${km}`)
    }

    return komi
  }

  private parseRules(ru?: string): string {
    if (!ru) {
      return 'japanese'
    }

    return ru.trim().toLowerCase().replace(/\s+/g, '-')
  }

  private parseInitialStones(
    root: sgf.SgfNode,
    _boardXSize: number,
    boardYSize: number,
  ): KatagoMove[] {
    const stones: KatagoMove[] = []

    for (const coord of root.data.AB ?? []) {
      for (const vertex of sgf.parseCompressedVertices(coord)) {
        stones.push(['B', this.vertexToGtp(vertex, boardYSize)])
      }
    }

    for (const coord of root.data.AW ?? []) {
      for (const vertex of sgf.parseCompressedVertices(coord)) {
        stones.push(['W', this.vertexToGtp(vertex, boardYSize)])
      }
    }

    return stones
  }

  private parseMainLineMoves(
    root: sgf.SgfNode,
    boardXSize: number,
    boardYSize: number,
  ): KatagoMove[] {
    const moves: KatagoMove[] = []
    let node: sgf.SgfNode | undefined = root

    // корневой узел тоже может содержать первый ход
    while (node) {
      const move = this.extractMove(node, boardXSize, boardYSize)
      if (move) {
        moves.push(move)
      }

      node = node.children[0]
    }

    return moves
  }

  private extractMove(
    node: sgf.SgfNode,
    boardXSize: number,
    boardYSize: number,
  ): KatagoMove | null {
    if (node.data.B) {
      return ['B', this.sgfCoordToGtp(node.data.B[0], boardXSize, boardYSize)]
    }

    if (node.data.W) {
      return ['W', this.sgfCoordToGtp(node.data.W[0], boardXSize, boardYSize)]
    }

    return null
  }

  private sgfCoordToGtp(
    coord: string | undefined,
    boardXSize: number,
    boardYSize: number,
  ): string {
    if (!coord || coord === '') {
      return 'pass'
    }

    // классический pass в старых SGF на 19×19
    if (coord === 'tt' && boardXSize <= 19 && boardYSize <= 19) {
      return 'pass'
    }

    const vertex = sgf.parseVertex(coord)
    if (vertex[0] < 0 || vertex[1] < 0) {
      return 'pass'
    }

    return this.vertexToGtp(vertex, boardYSize)
  }

  /** SGF (0,0)=верхний левый → GTP вроде D4 / Q16 */
  private vertexToGtp([x, y]: [number, number], boardYSize: number): string {
    const col =
      x >= 8
        ? String.fromCharCode('A'.charCodeAt(0) + x + 1) // пропускаем I
        : String.fromCharCode('A'.charCodeAt(0) + x)
    const row = boardYSize - y

    return `${col}${row}`
  }
}
