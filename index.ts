import { existsSync, mkdirSync, rmSync } from "fs"
import { Codegen } from "./src/codegen"
import { Lexer } from "./src/lexer"
import { ModuleResolver } from "./src/module/resolver"
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
extern fn puts(s: string) -> int

pub fn main() -> int {
    puts("hi")
    return 1
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
const modules = { "main": { ast }, ...r.resolve() }

await Bun.write("out/modules.json", JSON.stringify(modules, null, 2))
const modTime = performance.now()

console.log(`resolved ${Object.keys(modules).length} module(s) in ${(modTime - astTime).toFixed(3)}ms\n`)

for (const [name, mod] of Object.entries(modules)) {
    console.log(`${name}:`)
    const start = performance.now()
    
    const ti = new TypeInferrer(mod.ast)
    const ist = ti.infer()

    const infTime = performance.now()
    console.log(`   inferred types in ${(infTime - start).toFixed(3)}ms`)

    const tc = new TypeChecker(ist)
    const cst = tc.check()
    if (cst.length > 0) {
        throw new Error(`type errors in ${name}:\n  ${cst.join("\n  ")}`);
    }

    const checkTime = performance.now()
    console.log(`   checked types in ${(checkTime - infTime).toFixed(3)}ms`)

    const cg = new Codegen(name, ist)
    const code = cg.generate()

    await Bun.write(`out/${name}.ll`, code)

    const genTime = performance.now()
    console.log(`   generated code in ${(genTime - checkTime).toFixed(3)}ms\n`)
}

const end = performance.now()

console.log(`finished building in ${(end - start).toFixed(3)}ms\n`)

if (!existsSync("./objects")) {
    mkdirSync("./objects")
}

for (const [name] of Object.entries(modules)) {
    Bun.spawnSync({
        cmd: ["llc", `./out/${name}.ll`, "-filetype=obj", "-o", `./objects/${name}.o`],
        stdout: "inherit",
        stderr: "inherit",
    })
}

import { readdirSync } from "fs"
const objectFiles = readdirSync("./objects")
    .filter(f => f.endsWith(".o"))
    .map(f => `./objects/${f}`)

Bun.spawnSync({
    cmd: ["gcc", ...objectFiles, "-o", "./out/executable.exe"],
    stdout: "inherit",
    stderr: "inherit",
})

console.log("executable output:\n")

const exe = Bun.spawnSync({
    cmd: ["./out/executable.exe"],
    stdout: "inherit",
    stderr: "inherit",
})


console.log("\nexit code:", exe.exitCode)