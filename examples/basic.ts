/**
 * Example: Basic usage of tailwindcss-deno
 *
 * Run with: deno run --allow-read --allow-env examples/basic.ts
 */

import { normalizePath } from "../src/normalize-path.ts"
import { optimize } from "../src/optimize.ts"
import { Instrumentation } from "../src/instrumentation.ts"
import * as env from "../src/env.ts"

console.log("🦕 Tailwind CSS Deno - Basic Example\n")

// Example 1: Path normalization
console.log("1. Path Normalization:")
const paths = [
  "./src/styles.css",
  "components\\Button.tsx",
  "/absolute/path/to/file.ts",
]

for (const path of paths) {
  console.log(`  ${path} -> ${normalizePath(path)}`)
}

// Example 2: Environment variables
console.log("\n2. Environment Variables:")
console.log(`  DEBUG mode: ${env.DEBUG}`)

// Example 3: CSS Optimization
console.log("\n3. CSS Optimization:")
const sampleCSS = `
.container {
  @apply flex items-center justify-center;
  padding: 1rem;
}

.button {
  @apply bg-blue-500 text-white rounded;
  &:hover {
    @apply bg-blue-600;
  }
}
`

try {
  const result = optimize(sampleCSS, {
    file: "example.css",
    minify: false,
  })
  console.log("  ✓ CSS optimized successfully")
  console.log(`  Output length: ${result.code.length} characters`)
} catch (error) {
  console.log(`  ⚠ Optimization skipped (requires lightningcss): ${error.message}`)
}

// Example 4: Instrumentation
console.log("\n4. Performance Instrumentation:")
const inst = new Instrumentation()

inst.start("example-task")
inst.start("subtask-1")
// Simulate some work
await new Promise((resolve) => setTimeout(resolve, 10))
inst.end("subtask-1")

inst.start("subtask-2")
await new Promise((resolve) => setTimeout(resolve, 5))
inst.end("subtask-2")
inst.end("example-task")

console.log("  Collecting metrics...")
inst.report((msg) => console.log(msg))

console.log("\n✅ Example completed!")
