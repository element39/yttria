import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "fs"
import path from "path"
import { Codegen } from "./src/codegen"
import { Lexer } from "./src/lexer"
import { ModuleResolver } from "./src/module/resolver"
import { ResolvedModule } from "./src/module/types"
import { Parser } from "./src/parser"
import { TypeChecker } from "./src/typing/checker"
import { TypeInferrer } from "./src/typing/inference"
rmSync("./out", { recursive: true, force: true })

// error driven development right here
// const program = `
// use std/io

// pub fn main() {
//     io.println("hi")
// }
// `.trim()

const program = `
fn main() -> int {
    return 5
}
`.trim()

const start = performance.now()

const l = new Lexer(program)
const t = l.lex()
const lexerTime = performance.now()
await Bun.write("out/tok.json", JSON.stringify(t, null, 2))

console.log(`lexed ${t.length} tokens in ${(lexerTime - start).toFixed(3)}ms`)

const p = new Parser(t)
const ast = p.parse()
await Bun.write("out/ast.json", JSON.stringify(ast, null, 2))
const astTime = performance.now()

console.log(`parsed ${t.length} tokens in ${(astTime - lexerTime).toFixed(3)}ms, generated ${ast.body.length} root node(s)`)

const r = new ModuleResolver(ast)
const modules: Record<string, ResolvedModule> = { "main": { ast }, ...r.resolve() }

{
    const builtinDir = path.resolve("src/module/builtin")
    if (existsSync(builtinDir)) {
        for (const file of readdirSync(builtinDir).filter(f => f.endsWith(".yt"))) {
            const content = readFileSync(path.join(builtinDir, file), "utf8")
            const tokens2 = new Lexer(content).lex()
            const ast2 = new Parser(tokens2).parse()
            const name2 = path.basename(file, ".yt")
            modules[`builtin/${name2}`] = { ast: ast2 }
        }
    }
}

await Bun.write("out/modules.json", JSON.stringify(modules, null, 2))
const modTime = performance.now()

console.log(`resolved ${Object.keys(modules).length} module(s) in ${(modTime - astTime).toFixed(3)}ms\n`)

for (const [name, mod] of Object.entries(modules)) {
    console.log(`${name}:`)
    const start = performance.now()
    
    const ti = new TypeInferrer(mod.ast)
    const ist = ti.infer()
    modules[name].ast = ist
    if (name === "main") await Bun.write("out/inferred.json", JSON.stringify(ist, null, 2))

    const infTime = performance.now()
    console.log(`   inferred types in ${(infTime - start).toFixed(3)}ms`)

    const tc = new TypeChecker(ist)
    const cst = tc.check()
    if (cst.length > 0) {
        throw new Error(`type errors in ${name}:\n  ${cst.join("\n  ")}`);
    }

    const checkTime = performance.now()
    console.log(`   checked types in ${(checkTime - infTime).toFixed(3)}ms`)

    const cg = new Codegen(name, ist, modules)
    const code = cg.generate()

    const llPath = path.join("out", `${name}.ll`)
    mkdirSync(path.dirname(llPath), { recursive: true })
    await Bun.write(llPath, code)

    const genTime = performance.now()
    console.log(`   generated code in ${(genTime - checkTime).toFixed(3)}ms\n`)
}

const end = performance.now()

console.log(`finished building in ${(end - start).toFixed(3)}ms\n`)

if (!existsSync("./objects")) {
    mkdirSync("./objects")
}

for (const [name] of Object.entries(modules)) {
    const objPath = path.join("objects", `${name}.o`)
    mkdirSync(path.dirname(objPath), { recursive: true })
    const llPath = path.join("out", `${name}.ll`)
    try {
        const res = Bun.spawnSync({ cmd: ["llc", llPath, "-filetype=obj", "-o", objPath], stdout: "pipe", stderr: "pipe" })
        const out = res.stdout ? Buffer.from(res.stdout).toString() : ""
        const err = res.stderr ? Buffer.from(res.stderr).toString() : ""
        if (res.exitCode !== 0) {
            console.error(`llc failed for ${llPath}:\n${out}${err}`)
            throw new Error(`llc failed for ${llPath}`)
        }
        // success: don't print llc output unless needed
    } catch (e) {
        // rethrow after printing a helpful message
        console.error(`failed to run 'llc' on ${llPath}: ${e}`)
        throw e
    }
}

function collectO(dir: string): string[] {
    let results: string[] = []
    for (const name of readdirSync(dir)) {
        const full = path.join(dir, name)
        if (statSync(full).isDirectory()) {
            results.push(...collectO(full))
        } else if (full.endsWith('.o')) {
            results.push(full)
        }
    }
    return results
}
const objects = collectO("./objects");

try {
    const clang = Bun.spawnSync({
        cmd: ["clang", ...objects, "-o", "./out/executable.exe", "-v"],
        stdout: "pipe",
        stderr: "pipe"
    })

    const out = clang.stdout ? Buffer.from(clang.stdout).toString() : ""
    const err = clang.stderr ? Buffer.from(clang.stderr).toString() : ""

    if (clang.exitCode !== 0) {
        console.error(`clang failed:\n${out}${err}`)
        throw new Error('clang failed')
    }
} catch (e) {
    console.error(`failed to run 'clang': ${e}`)
    throw e
}

console.log(`executable output:\n\n${"=".repeat(50)}`)

const exe = Bun.spawnSync({
    cmd: ["./out/executable.exe"],
    stdout: "inherit",
    stderr: "inherit",
})


console.log(`${"=".repeat(50)}\n\nexit code:`, exe.exitCode)