import { dirname } from "@std/path"
import { toFileUrl } from "@std/path/to-file-url"
import { Workspace, ResolutionMode } from "@deno/loader"
import { getModuleDependencies } from "./get-module-dependencies.ts"
import { rewriteUrls } from "./urls.ts"

// Re-export types that would come from tailwindcss
// These are placeholders - in real usage, would import from tailwindcss
export const Features = {} as any
export const Polyfills = {} as any

export type Resolver = (id: string, base: string) => Promise<string | false | undefined>

export interface CompileOptions {
  base: string
  from?: string
  onDependency: (path: string) => void
  shouldRewriteUrls?: boolean
  polyfills?: typeof Polyfills

  customCssResolver?: Resolver
  customJsResolver?: Resolver
}

function createCompileOptions({
  base,
  from,
  polyfills,
  onDependency,
  shouldRewriteUrls,

  customCssResolver,
  customJsResolver,
}: CompileOptions) {
  return {
    base,
    polyfills,
    from,
    async loadModule(id: string, base: string) {
      return loadModule(id, base, onDependency, customJsResolver)
    },
    async loadStylesheet(id: string, sheetBase: string) {
      const sheet = await loadStylesheet(id, sheetBase, onDependency, customCssResolver)

      if (shouldRewriteUrls) {
        sheet.content = await rewriteUrls({
          css: sheet.content,
          root: base,
          base: sheet.base,
        })
      }

      return sheet
    },
  }
}

async function ensureSourceDetectionRootExists(compiler: {
  root: Awaited<ReturnType<typeof compile>>["root"]
}) {
  // Verify if the `source(…)` path exists (until the glob pattern starts)
  if (compiler.root && compiler.root !== "none") {
    const globSymbols = /[*{]/
    const basePath = []
    for (const segment of compiler.root.pattern.split("/")) {
      if (globSymbols.test(segment)) {
        break
      }

      basePath.push(segment)
    }

    let exists = false
    try {
      const stat = await Deno.stat(
        dirname(compiler.root.base) + "/" + basePath.join("/"),
      )
      exists = stat.isDirectory
    } catch {
      exists = false
    }

    if (!exists) {
      throw new Error(
        `The \`source(${compiler.root.pattern})\` does not exist or is not a directory.`,
      )
    }
  }
}

// Placeholder compile functions - would integrate with actual tailwindcss
export async function compileAst(ast: any[], options: CompileOptions) {
  // TODO: Integrate with actual tailwindcss compileAst
  const compiler = { root: "none" } as any
  await ensureSourceDetectionRootExists(compiler)
  return compiler
}

export async function compile(css: string, options: CompileOptions) {
  // TODO: Integrate with actual tailwindcss compile
  const compiler = { root: "none" } as any
  await ensureSourceDetectionRootExists(compiler)
  return compiler
}

export async function __unstable__loadDesignSystem(css: string, { base }: { base: string }) {
  // TODO: Integrate with actual tailwindcss __unstable__loadDesignSystem
  return {} as any
}

export async function loadModule(
  id: string,
  base: string,
  onDependency: (path: string) => void,
  customJsResolver?: Resolver,
) {
  if (id[0] !== ".") {
    const resolvedPath = await resolveJsId(id, base, customJsResolver)
    if (!resolvedPath) {
      throw new Error(`Could not resolve '${id}' from '${base}'`)
    }

    const module = await importModule(toFileUrl(resolvedPath).href)
    return {
      path: resolvedPath,
      base: dirname(resolvedPath),
      module: module.default ?? module,
    }
  }

  const resolvedPath = await resolveJsId(id, base, customJsResolver)
  if (!resolvedPath) {
    throw new Error(`Could not resolve '${id}' from '${base}'`)
  }

  const [module, moduleDependencies] = await Promise.all([
    importModule(toFileUrl(resolvedPath).href + "?id=" + Date.now()),
    getModuleDependencies(resolvedPath),
  ])

  for (const file of moduleDependencies) {
    onDependency(file)
  }
  return {
    path: resolvedPath,
    base: dirname(resolvedPath),
    module: module.default ?? module,
  }
}

async function loadStylesheet(
  id: string,
  base: string,
  onDependency: (path: string) => void,
  cssResolver?: Resolver,
) {
  const resolvedPath = await resolveCssId(id, base, cssResolver)
  if (!resolvedPath) throw new Error(`Could not resolve '${id}' from '${base}'`)

  onDependency(resolvedPath)

  const file = await Deno.readTextFile(resolvedPath)
  return {
    path: resolvedPath,
    base: dirname(resolvedPath),
    content: file,
  }
}

// Use Deno native dynamic import or @deno/loader
async function importModule(path: string): Promise<any> {
  // Check if there's a custom loader hook
  if (typeof (globalThis as any).__tw_load === "function") {
    const module = await (globalThis as any).__tw_load(path)
    if (module) {
      return module
    }
  }

  try {
    return await import(path)
  } catch (error) {
    // For TypeScript files or special module formats, try with import maps
    console.error(`Failed to import ${path}:`, error)
    throw error
  }
}

// Create a Deno loader workspace for module resolution
let workspace: Workspace | null = null

async function getWorkspace() {
  if (!workspace) {
    workspace = new Workspace({
      // Use import conditions for ESM resolution
      nodeConditions: ["deno", "import", "default"],
      noConfig: false,
      noLock: false,
    })
  }
  return workspace
}

async function resolveCssId(
  id: string,
  base: string,
  customCssResolver?: Resolver,
): Promise<string | false | undefined> {
  if (typeof (globalThis as any).__tw_resolve === "function") {
    const resolved = (globalThis as any).__tw_resolve(id, base)
    if (resolved) {
      return Promise.resolve(resolved)
    }
  }

  if (customCssResolver) {
    const customResolution = await customCssResolver(id, base)
    if (customResolution) {
      return customResolution
    }
  }

  // Use @deno/loader for CSS resolution
  try {
    const ws = await getWorkspace()
    const loader = await ws.createLoader({
      entrypoints: [toFileUrl(base).href],
    })

    const resolved = loader.resolve(id, toFileUrl(base).href, ResolutionMode.Import)
    if (resolved) {
      return new URL(resolved).pathname
    }
  } catch (error) {
    // Fall back to simple file resolution
    const simplePath = dirname(base) + "/" + id
    try {
      await Deno.stat(simplePath)
      return simplePath
    } catch {
      return undefined
    }
  }

  return undefined
}

async function resolveJsId(
  id: string,
  base: string,
  customJsResolver?: Resolver,
): Promise<string | false | undefined> {
  if (typeof (globalThis as any).__tw_resolve === "function") {
    const resolved = (globalThis as any).__tw_resolve(id, base)
    if (resolved) {
      return Promise.resolve(resolved)
    }
  }

  if (customJsResolver) {
    const customResolution = await customJsResolver(id, base)
    if (customResolution) {
      return customResolution
    }
  }

  // Use @deno/loader for JS/TS resolution
  try {
    const ws = await getWorkspace()
    const loader = await ws.createLoader({
      entrypoints: [toFileUrl(base).href],
    })

    const resolved = loader.resolve(id, toFileUrl(base).href, ResolutionMode.Import)
    if (resolved) {
      // Convert file:// URL to local path
      const url = new URL(resolved)
      if (url.protocol === "file:") {
        return url.pathname
      }
      return resolved
    }
  } catch (error) {
    // Fall back to simple file resolution for relative paths
    if (id.startsWith(".")) {
      const simplePath = dirname(base) + "/" + id
      try {
        await Deno.stat(simplePath)
        return simplePath
      } catch {
        // Try with common extensions
        for (const ext of [".ts", ".js", ".tsx", ".jsx", ".mts", ".mjs"]) {
          try {
            await Deno.stat(simplePath + ext)
            return simplePath + ext
          } catch {
            // Continue trying
          }
        }
      }
    }
  }

  return undefined
}
