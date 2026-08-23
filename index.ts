import { mkdirSync, rmSync } from "fs"
import { platform } from "os"
import { Codegen } from "./src/gen/llvm"
import { ModuleLoader } from "./src/module/loader"
import { SemanticAnalyser } from "./src/semantic/analyser"
import { SemanticChecker } from "./src/semantic/checker"
import { SemanticInferrer } from "./src/semantic/inferrer"
import { SemanticResolver } from "./src/semantic/resolver"
import { ModuleSymbol } from "./src/semantic/symbols"

rmSync("./out", { recursive: true, force: true })

const program = `
use std/io as alias

pub fn main() -> int {
    return alias.putc(72)
}
`.trim()

const start = performance.now()

const ml = new ModuleLoader()
const modules = await ml.load(".", "main.yt", program)

const modTime = performance.now()

console.log(`loaded ${modules.size} module(s)`)

const analyzedModules = new Map<string, ModuleSymbol>()

for (const [name, files] of modules) {
    const sa = new SemanticAnalyser(files, name)
    const analyzed = sa.analyse()

    analyzedModules.set(name, analyzed)
    await Bun.write(`out/semantic/${name}.analyzed.json`, JSON.stringify(analyzed, null, 2))
}

const analyzedTime = performance.now()

console.log(`semantic analysis done in ${(analyzedTime - modTime).toFixed(3)}ms`)

const sr = new SemanticResolver(analyzedModules)
const resolvedModules = sr.resolve()

await Bun.write("out/semantic/resolved.json", JSON.stringify(resolvedModules, null, 2))

const resolvedTime = performance.now()
console.log(`semantic resolution done in ${(resolvedTime - analyzedTime).toFixed(3)}ms`)

const si = new SemanticInferrer(resolvedModules)
const inferredModules = si.infer()

await Bun.write("out/semantic/inferred.json", JSON.stringify(inferredModules, null, 2))

const inferredTime = performance.now()
console.log(`type inference done in ${(inferredTime - resolvedTime).toFixed(3)}ms`)

const sc = new SemanticChecker(inferredModules)
const checkedModules = sc.check()

await Bun.write("out/semantic/checked.json", JSON.stringify(checkedModules, null, 2))

const semanticTime = performance.now()
console.log(`semantic checking done in ${(semanticTime - inferredTime).toFixed(3)}ms`)

const main = checkedModules.get("main")
if (!main) throw new Error("entry module not found")

for (const [name, module] of checkedModules) {
    const cg = new Codegen(name, module)
    const ll = cg.gen()

    await Bun.write(`out/llvm/${name}.ll`, ll)
}

const codegenTime = performance.now()

console.log(`codegen done in ${(codegenTime - semanticTime).toFixed(3)}ms\n`)

const lls = [...checkedModules.keys()].map(
    name => `out/llvm/${name}.ll`
);

const objs = [...checkedModules.keys()].map(
    name => `out/obj/${name}.o`
);

for (const obj of objs) {
    const parts = obj.split("/");
    parts.pop();

    mkdirSync(parts.join("/"), { recursive: true });
}

for (const [i, obj] of objs.entries()) {
    Bun.spawnSync({
        cmd: ["clang", "-c", lls[i], "-o", obj],
        stdout: "inherit",
        stderr: "inherit"
    });
}

const output = platform() === "win32"
    ? "out/out.exe"
    : "out/out";

Bun.spawnSync({
    cmd: ["clang", ...objs, "-o", output],
    stdout: "inherit",
    stderr: "inherit"
});

const linkTime = performance.now();

console.log(`\ncompiled in ${(linkTime - codegenTime).toFixed(3)}ms`);
console.log(`total time: ${(linkTime - start).toFixed(3)}ms\n\n`);

const process = Bun.spawnSync({
    cmd: [output],
    stdout: "inherit",
    stderr: "inherit"
});

console.log(`\n\n\nprogram exited with code ${process.exitCode}`);