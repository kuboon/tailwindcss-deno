import { SourceMapGenerator } from "source-map-js"

// Type definitions for source maps
export interface DecodedSourceMap {
  mappings: Array<{
    generatedPosition: { line: number; column: number }
    originalPosition?: { line: number; column: number }
    name?: string
  }>
}

export interface DecodedSource {
  url: string
  content: string
}

export interface SourceMap {
  readonly raw: string
  readonly inline: string
  comment(url: string): string
}

class DefaultMap<K, V> extends Map<K, V> {
  constructor(private factory: (key: K) => V) {
    super()
  }

  get(key: K): V {
    if (!this.has(key)) {
      this.set(key, this.factory(key))
    }
    return super.get(key)!
  }
}

function serializeSourceMap(map: DecodedSourceMap): string {
  const generator = new SourceMapGenerator()

  let id = 1
  const sourceTable = new DefaultMap<
    DecodedSource | null,
    {
      url: string
      content: string
    }
  >((src) => {
    return {
      url: src?.url ?? `<unknown ${id++}>`,
      content: src?.content ?? "<none>",
    }
  })

  for (const mapping of map.mappings) {
    const original = sourceTable.get(
      (mapping.originalPosition as any)?.source ?? null
    )

    generator.addMapping({
      generated: mapping.generatedPosition,
      original: mapping.originalPosition,
      source: original.url,
      name: mapping.name,
    })

    generator.setSourceContent(original.url, original.content)
  }

  return generator.toString()
}

export function toSourceMap(map: DecodedSourceMap | string): SourceMap {
  const raw = typeof map === "string" ? map : serializeSourceMap(map)

  function comment(url: string) {
    return `/*# sourceMappingURL=${url} */\n`
  }

  return {
    raw,
    get inline() {
      const encoder = new TextEncoder()
      const data = encoder.encode(raw)
      const base64 = btoa(String.fromCharCode(...data))
      return comment(`data:application/json;base64,${base64}`)
    },
    comment,
  }
}
