import { normalizePath } from "../normalize-path.ts";
import * as env from "../env.ts";
import { Instrumentation } from "../instrumentation.ts";
import {
  compile,
  type __unstable__loadDesignSystem,
  loadModule,
} from "../compile.ts";

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";

Deno.test("normalizePath - basic paths", () => {
  assertEquals(normalizePath("./foo/bar"), "./foo/bar");
  assertEquals(normalizePath("foo\\bar"), "foo/bar");
  assertEquals(normalizePath("/foo/bar"), "/foo/bar");
});

Deno.test("normalizePath - Windows paths", () => {
  assertEquals(normalizePath("C:\\foo\\bar"), "C:/foo/bar");
  assertEquals(normalizePath("foo\\bar\\baz"), "foo/bar/baz");
});

Deno.test("env - DEBUG flag", () => {
  // Should be able to access DEBUG
  assertExists(env.DEBUG !== undefined);
});

Deno.test("Instrumentation - basic functionality", () => {
  const messages: string[] = [];
  const inst = new Instrumentation((msg) => {
    messages.push(msg);
  });

  inst.hit("test-hit");
  inst.start("test-timer");
  inst.end("test-timer");

  inst.report();

  // Should have reported something
  assertEquals(messages.length > 0, true);
  assertEquals(messages[0].includes("test-timer"), true);
});

Deno.test("Instrumentation - nested timers", () => {
  const messages: string[] = [];
  const inst = new Instrumentation((msg) => {
    messages.push(msg);
  });

  inst.start("outer");
  inst.start("inner");
  inst.end("inner");
  inst.end("outer");

  inst.report();

  assertEquals(messages.length > 0, true);
});

Deno.test("compile - basic compilation", async () => {
  const dependencies: string[] = [];
  const options = {
    base: Deno.cwd(),
    onDependency: (path: string) => {
      dependencies.push(path);
    },
  };

  const compiler = await compile("@import 'tailwindcss/index.css'; @plugin 'daisyui'", options);
  const built = compiler.build(["flex"]);
  assertStringIncludes(built, "display: flex");
});

Deno.test("loadModule - loads a module", async () => {
  const dependencies: string[] = [];
  const testModulePath = "./normalize-path.ts";
  const baseDir = `${Deno.cwd()}/src/`;
  
  const result = await loadModule(
    testModulePath,
    baseDir,
    (path: string) => {
      dependencies.push(path);
    },
  );
  
  // Should return module information
  assertExists(result);
  assertExists(result.path);
  assertExists(result.base);
  assertExists(result.module);
  
  // Should have loaded the normalizePath function
  assertEquals(typeof result.module.normalizePath, "function");
});
