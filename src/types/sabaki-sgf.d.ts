declare module '@sabaki/sgf' {
  export interface SgfNode {
    id: number | string
    data: Record<string, string[]>
    parentId: number | string | null
    children: SgfNode[]
  }

  export function parse(
    contents: string,
    options?: { getId?: () => number | string },
  ): SgfNode[]

  export function parseVertex(input: string): [number, number]

  export function parseCompressedVertices(input: string): [number, number][]

  export function stringifyVertex(vertex: [number, number]): string
}
