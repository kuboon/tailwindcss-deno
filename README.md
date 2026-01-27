# tailwindcss-deno

A Deno-native port of `@tailwindcss/node` that provides Tailwind CSS compilation
utilities using Deno's native APIs.

## Features

- 🦕 **Deno Native**: Uses Deno's built-in APIs instead of Node.js dependencies
- 📦 **@deno/loader Integration**: Module loading powered by
  [@deno/loader](https://jsr.io/@deno/loader)
- 🚀 **TypeScript First**: Written in TypeScript for Deno
- 🔧 **CSS Optimization**: Built-in CSS optimization with Lightning CSS
- 🗺️ **Source Maps**: Full source map support

## Installation

Add to your `deno.json`:

```json
{
  "imports": {
    "@kuboon/tailwindcss-deno": "jsr:@kuboon/tailwindcss-deno@^0.1.0"
  }
}
```

Or import directly:

```typescript
import { compile } from "jsr:@kuboon/tailwindcss-deno";
```

## Usage

### Basic Compilation

```typescript
import { compile } from "@kuboon/tailwindcss-deno";

const css = `
  @import "tailwindcss";
`;

const result = await compile(css, {
  base: Deno.cwd(),
  onDependency: (path) => {
    console.log("Dependency:", path);
  },
});
```

### Module Loading

The library uses `@deno/loader` for resolving and loading modules, supporting:

- Local file imports
- npm: specifiers
- jsr: specifiers
- HTTP/HTTPS imports
- TypeScript files

### CSS Optimization

```typescript
import { optimize } from "@kuboon/tailwindcss-deno";

const result = optimize(css, {
  minify: true,
  file: "output.css",
});

console.log(result.code);
```

### Source Maps

```typescript
import { toSourceMap } from "@kuboon/tailwindcss-deno";

const sourceMap = toSourceMap(decodedMap);
console.log(sourceMap.inline); // Inline base64 source map
```

## API

### `compile(css, options)`

Compiles Tailwind CSS with the given options.

**Options:**

- `base: string` - Base directory for resolving imports
- `from?: string` - Source file path
- `onDependency: (path: string) => void` - Callback for each dependency
- `shouldRewriteUrls?: boolean` - Whether to rewrite URLs in CSS
- `polyfills?: Polyfills` - CSS polyfills to apply
- `customCssResolver?: Resolver` - Custom CSS module resolver
- `customJsResolver?: Resolver` - Custom JS module resolver

### `optimize(css, options)`

Optimizes CSS output using Lightning CSS.

**Options:**

- `file?: string` - File name for source maps
- `minify?: boolean` - Enable minification
- `map?: string` - Input source map

### `loadModule(id, base, onDependency, customResolver?)`

Loads a JavaScript/TypeScript module using @deno/loader.

### `normalizePath(path)`

Normalizes file paths across platforms.

## Differences from @tailwindcss/node

1. **Module Resolution**: Uses `@deno/loader` instead of `enhanced-resolve` and
   `jiti`
2. **File System**: Uses Deno's native `Deno.readTextFile()` instead of Node.js
   `fs`
3. **Path Handling**: Uses `@std/path` instead of Node.js `path` module
4. **Environment Variables**: Uses `Deno.env.get()` instead of `process.env`
5. **No Module Registration**: Deno handles module loading natively, no need for
   `Module.register()`

## Development

```bash
# Run tests
deno task test

# Watch mode
deno task dev
```

## License

MIT

## Credits

Based on
[@tailwindcss/node](https://github.com/tailwindlabs/tailwindcss/tree/main/packages/%40tailwindcss-node)
by Tailwind Labs.
