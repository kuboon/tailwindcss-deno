
import { readFile } from "node:fs/promises";
import Context from "https://deno.land/std@0.200.0/wasi/snapshot_preview1.ts";
import { instantiateNapiModuleSync, getDefaultContext } from "npm:@napi-rs/wasm-runtime";
import { fileURLToPath } from "node:url";

// Note: Direct import like `import { ... } from "..."` does not work for this WASM module
// because it requires a specific import object (env, wasi_snapshot_preview1) that
// Deno's default WASM loader does not provide automatically for N-API modules.
// Additionally, `node:wasi` in Deno currently has compatibility issues ("Context not supported"),
// so we use `std/wasi` as a replacement.

async function main() {

  let wasmUrl: string;
  try {
      const pkgUrl = import.meta.resolve("npm:@tailwindcss/oxide-wasm32-wasi/package.json");
      wasmUrl = pkgUrl.replace("package.json", "tailwindcss-oxide.wasm32-wasi.wasm");
  } catch (e) {
      console.error("Could not resolve @tailwindcss/oxide-wasm32-wasi/package.json");
      console.error("Make sure to cache the package: deno cache npm:@tailwindcss/oxide-wasm32-wasi");
      throw e;
  }

  let wasmPath: string;
  if (wasmUrl.startsWith("file:")) {
      wasmPath = fileURLToPath(wasmUrl);
  } else {
      throw new Error("Resolved URL is not file protocol: " + wasmUrl);
  }

  console.log(`Loading WASM from: ${wasmPath}`);
  const wasmBuffer = await readFile(wasmPath);

  const wasi = new Context({
    args: Deno.args,
    env: Deno.env.toObject(),
    preopens: {
      "./": ".",
    },
  });

  // Shim for @napi-rs/wasm-runtime which might expect `wasiImport` (Node.js style)
  // @ts-ignore
  wasi.wasiImport = wasi.exports;

  const apiContext = getDefaultContext();

  // Create shared memory
  const sharedMemory = new WebAssembly.Memory({
    initial: 16384,
    maximum: 65536,
    shared: true,
  });

  const { napiModule } = instantiateNapiModuleSync(wasmBuffer, {
    context: apiContext,
    wasi: wasi,
    overwriteImports(importObject) {
        importObject.env = {
            ...importObject.env,
            ...importObject.napi,
            ...importObject.emnapi,
            memory: sharedMemory,
        };
        return importObject;
    },
    beforeInit({ instance }) {
        // Manually trigger NAPI registration functions exported by the WASM
        for (const name of Object.keys(instance.exports)) {
            if (name.startsWith('__napi_register__')) {
                // @ts-ignore
                instance.exports[name]();
            }
        }
    },
  });

  console.log("Oxide WASM module loaded successfully!");
  console.log("Exports available:", Object.keys(napiModule.exports));

  if (napiModule.exports.Scanner) {
    console.log("Scanner class is available.");
  }
}

main().catch(console.error);
