import { dirname } from "@std/path";
import { toFileUrl } from "@std/path/to-file-url";
import { ResolutionMode, Workspace } from "@deno/loader";
import { getModuleDependencies } from "./get-module-dependencies.ts";
import { rewriteUrls } from "./urls.ts";
import {
  __unstable__loadDesignSystem as ___unstable__loadDesignSystem,
  compile as _compile,
  compileAst as _compileAst,
  type Config,
  Features,
  Polyfills,
} from "tailwindcss";

export { Features, Polyfills };

/**
 * Type definition for a custom module resolver function.
 *
 * @param id - The module identifier to resolve
 * @param base - The base path to resolve from
 * @returns The resolved path, false if ignored, or undefined if not found
 */
export type Resolver = (
  id: string,
  base: string,
) => Promise<string | false | undefined>;

/**
 * Options for configuring the Tailwind CSS compiler.
 */
export interface CompileOptions {
  /** Base directory for resolving imports */
  base: string;
  /** Source file path */
  from?: string;
  /** Callback for each dependency found */
  onDependency: (path: string) => void;
  /** Whether to rewrite URLs in CSS */
  shouldRewriteUrls?: boolean;
  /** CSS polyfills to apply */
  polyfills?: Polyfills;

  /** Custom CSS module resolver */
  customCssResolver?: Resolver;
  /** Custom JS module resolver */
  customJsResolver?: Resolver;
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
    loadModule(id: string, base: string) {
      return loadModule(id, base, onDependency, customJsResolver);
    },
    async loadStylesheet(id: string, sheetBase: string) {
      const sheet = await loadStylesheet(
        id,
        sheetBase,
        onDependency,
        customCssResolver,
      );

      if (shouldRewriteUrls) {
        sheet.content = await rewriteUrls({
          css: sheet.content,
          root: base,
          base: sheet.base,
        });
      }

      return sheet;
    },
  };
}

async function ensureSourceDetectionRootExists(compiler: {
  root: Awaited<ReturnType<typeof compile>>["root"];
}) {
  // Verify if the `source(…)` path exists (until the glob pattern starts)
  if (compiler.root && compiler.root !== "none") {
    const globSymbols = /[*{]/;
    const basePath = [];
    for (const segment of compiler.root.pattern.split("/")) {
      if (globSymbols.test(segment)) {
        break;
      }

      basePath.push(segment);
    }

    let exists = false;
    try {
      const stat = await Deno.stat(
        dirname(compiler.root.base) + "/" + basePath.join("/"),
      );
      exists = stat.isDirectory;
    } catch {
      exists = false;
    }

    if (!exists) {
      throw new Error(
        `The \`source(${compiler.root.pattern})\` does not exist or is not a directory.`,
      );
    }
  }
}

/**
 * Compiles a Tailwind CSS AST with the given options.
 *
 * @param ast - The AST nodes to compile
 * @param options - Compilation options
 * @returns A compiler instance
 */
export async function compileAst(
  ast: Parameters<typeof _compileAst>[0],
  options: CompileOptions,
): Promise<Awaited<ReturnType<typeof _compileAst>>> {
  const compiler = await _compileAst(ast, createCompileOptions(options));
  await ensureSourceDetectionRootExists(compiler);
  return compiler;
}

/**
 * Compiles Tailwind CSS from a string with the given options.
 *
 * @param css - The CSS string to compile
 * @param options - Compilation options
 * @returns A compiler instance
 */
export async function compile(
  css: string,
  options: CompileOptions,
): Promise<Awaited<ReturnType<typeof _compile>>> {
  const compiler = await _compile(css, createCompileOptions(options));
  await ensureSourceDetectionRootExists(compiler);
  return compiler;
}

/**
 * Loads a design system from CSS (unstable API).
 *
 * @param css - The CSS string containing design system definitions
 * @param options - Load options including base path
 * @returns A design system object
 */
export async function __unstable__loadDesignSystem(
  css: string,
  { base }: { base: string },
): Promise<Awaited<ReturnType<typeof ___unstable__loadDesignSystem>>> {
  return await ___unstable__loadDesignSystem(css, {
    base,
    loadModule(id, base) {
      return loadModule(id, base, () => {});
    },
    loadStylesheet(id, base) {
      return loadStylesheet(id, base, () => {});
    },
  });
}

/**
 * Loads a module for Tailwind CSS configuration or plugins.
 *
 * @param id - The module identifier
 * @param base - The base path
 * @param onDependency - Callback for dependencies
 * @param customJsResolver - Custom JS resolver
 * @returns The loaded module
 */
export async function loadModule(
  id: string,
  base: string,
  onDependency: (path: string) => void,
  customJsResolver?: Resolver,
): Promise<{ path: string; base: string; module: Config }> {
  if (id[0] !== ".") {
    const resolvedPath = await resolveJsId(id, base, customJsResolver);
    if (!resolvedPath) {
      throw new Error(`Could not resolve '${id}' from '${base}'`);
    }

    const module = await importModule(toFileUrl(resolvedPath).href);
    const moduleWithDefault = module as Config & { default?: Config };
    return {
      path: resolvedPath,
      base: dirname(resolvedPath),
      module: moduleWithDefault.default ?? module,
    };
  }

  const resolvedPath = await resolveJsId(id, base, customJsResolver);
  if (!resolvedPath) {
    throw new Error(`Could not resolve '${id}' from '${base}'`);
  }

  const [module, moduleDependencies] = await Promise.all([
    importModule(toFileUrl(resolvedPath).href + "?id=" + Date.now()),
    getModuleDependencies(resolvedPath),
  ]);

  for (const file of moduleDependencies) {
    onDependency(file);
  }
  return {
    path: resolvedPath,
    base: dirname(resolvedPath),
    module: (module as { default?: unknown }).default ?? module,
  };
}

async function loadStylesheet(
  id: string,
  base: string,
  onDependency: (path: string) => void,
  cssResolver?: Resolver,
) {
  const resolvedPath = await resolveCssId(id, base, cssResolver);
  if (!resolvedPath) {
    throw new Error(`Could not resolve '${id}' from '${base}'`);
  }

  onDependency(resolvedPath);

  const file = await Deno.readTextFile(resolvedPath);
  return {
    path: resolvedPath,
    base: dirname(resolvedPath),
    content: file,
  };
}

// Use Deno native dynamic import or @deno/loader
async function importModule(path: string): Promise<Config> {
  try {
    return await import(path);
  } catch (error) {
    // For TypeScript files or special module formats, try with import maps
    console.error(`Failed to import ${path}:`, error);
    throw error;
  }
}

// Create a Deno loader workspace for module resolution
let workspace: Workspace | null = null;

function getWorkspace() {
  if (!workspace) {
    workspace = new Workspace();
  }
  return workspace;
}

async function resolveCssId(
  id: string,
  base: string,
  customCssResolver?: Resolver,
): Promise<string | false | undefined> {
  if (customCssResolver) {
    const customResolution = await customCssResolver(id, base);
    if (customResolution) {
      return customResolution;
    }
  }

  // Use @deno/loader for CSS resolution
  try {
    const ws = await getWorkspace();
    const loader = await ws.createLoader();

    const resolved = await loader.resolve(
      id,
      toFileUrl(base).href,
      ResolutionMode.Import,
    );
    if (resolved) {
      return new URL(resolved).pathname;
    }
  } catch {
    // Fall back to simple file resolution
    const simplePath = dirname(base) + "/" + id;
    try {
      await Deno.stat(simplePath);
      return simplePath;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

async function resolveJsId(
  id: string,
  base: string,
  customJsResolver?: Resolver,
): Promise<string | false | undefined> {
  if (customJsResolver) {
    const customResolution = await customJsResolver(id, base);
    if (customResolution) {
      return customResolution;
    }
  }

  // Use @deno/loader for JS/TS resolution
  try {
    const ws = await getWorkspace();
    const loader = await ws.createLoader();

    const resolved = await loader.resolve(
      id,
      toFileUrl(base).href,
      ResolutionMode.Import,
    );
    if (resolved) {
      // Convert file:// URL to local path
      const url = new URL(resolved);
      if (url.protocol === "file:") {
        return url.pathname;
      }
      return resolved;
    }
  } catch {
    // Fall back to simple file resolution for relative paths
    if (id.startsWith(".")) {
      const simplePath = dirname(base) + "/" + id;
      try {
        await Deno.stat(simplePath);
        return simplePath;
      } catch {
        // Try with common extensions
        for (const ext of [".ts", ".js", ".tsx", ".jsx", ".mts", ".mjs"]) {
          try {
            await Deno.stat(simplePath + ext);
            return simplePath + ext;
          } catch {
            // Continue trying
          }
        }
      }
    }
  }

  return undefined;
}
