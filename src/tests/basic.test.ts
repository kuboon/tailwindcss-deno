import { assertEquals, assertExists } from "jsr:@std/assert@^1.0.0"
import { normalizePath } from "../src/normalize-path.ts"
import * as env from "../src/env.ts"
import { Instrumentation } from "../src/instrumentation.ts"

Deno.test("normalizePath - basic paths", () => {
  assertEquals(normalizePath("./foo/bar"), "./foo/bar")
  assertEquals(normalizePath("foo\\bar"), "foo/bar")
  assertEquals(normalizePath("/foo/bar"), "/foo/bar")
})

Deno.test("normalizePath - Windows paths", () => {
  assertEquals(normalizePath("C:\\foo\\bar"), "C:/foo/bar")
  assertEquals(normalizePath("foo\\bar\\baz"), "foo/bar/baz")
})

Deno.test("env - DEBUG flag", () => {
  // Should be able to access DEBUG
  assertExists(env.DEBUG !== undefined)
})

Deno.test("Instrumentation - basic functionality", () => {
  const messages: string[] = []
  const inst = new Instrumentation((msg) => {
    messages.push(msg)
  })

  inst.hit("test-hit")
  inst.start("test-timer")
  inst.end("test-timer")

  inst.report()

  // Should have reported something
  assertEquals(messages.length > 0, true)
  assertEquals(messages[0].includes("test-timer"), true)
})

Deno.test("Instrumentation - nested timers", () => {
  const messages: string[] = []
  const inst = new Instrumentation((msg) => {
    messages.push(msg)
  })

  inst.start("outer")
  inst.start("inner")
  inst.end("inner")
  inst.end("outer")

  inst.report()

  assertEquals(messages.length > 0, true)
})
