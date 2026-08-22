import { rmSync } from "fs"
import { platform } from "os"
import { Codegen } from "./src/gen/llvm"
import { Lexer } from "./src/lexer"
import { Parser } from "./src/parser"
import { SemanticAnalyser } from "./src/semantic/analyser"
import { SemanticChecker } from "./src/semantic/checker"
import { SemanticInferrer } from "./src/semantic/inferrer"
import { SemanticResolver } from "./src/semantic/resolver"

rmSync("./out", { recursive: true, force: true })

// error driven development right here
// const program = `
// use std/io

// pub fn main() {
//     io.println("hi")
// }
// `.trim()

// const program = `
// fn main() -> int {
//     let x := 2

//     switch (x) {
//         0 -> {
//             return 22
//         }
//         1 -> {
//             return 12
//         }
//         2 -> {
//             return 3
//         }
//         default -> {
//             return 7
//         }
//     }
        
//     return 1
// }
// `.trim()

const program = `
extern fn putchar(c: int) -> int

pub fn main() -> int {
    putchar(72)

    return 2
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

const sa = new SemanticAnalyser(ast)
const analyzed = sa.analyse()

await Bun.write("out/semantic/analyzed.json", JSON.stringify(analyzed, null, 2))

const sr = new SemanticResolver(analyzed)
const resolved = sr.resolve()

await Bun.write("out/semantic/resolved.json", JSON.stringify(resolved, null, 2))

const si = new SemanticInferrer(resolved)
const inferred = si.infer()

await Bun.write("out/semantic/inferred.json", JSON.stringify(inferred, null, 2))

const sc = new SemanticChecker(inferred)
const symbol = sc.check()

const semanticTime = performance.now()

console.log(`semantic analysis done in ${(semanticTime - astTime).toFixed(3)}ms`)

const cg = new Codegen("main", ast, symbol)
const ll = cg.gen()

await Bun.write("out/out.ll", ll)

const codegenTime = performance.now()

console.log(`codegen done in ${(codegenTime - semanticTime).toFixed(3)}ms`)

// Bun.$`clang -c out/out.ll -o out/out.o`
// platform() === "win32"
//     ? Bun.$`clang out/out.o -o out/out.exe`
//     : Bun.$`clang out/out.o -o out/out`

Bun.spawnSync({
    cmd: ["clang", "-c", "out/out.ll", "-o", "out/out.o"],
    stdout: "inherit",
    stderr: "inherit"
})

Bun.spawnSync({
    cmd: platform() === "win32" ? ["clang", "out/out.o", "-o", "out/out.exe"] : ["clang", "out/out.o", "-o", "out/out"],
    stdout: "inherit",
    stderr: "inherit"
})

const linkTime = performance.now()
console.log(`compiled in ${(performance.now() - codegenTime).toFixed(3)}ms`)
console.log(`total time: ${(linkTime - start).toFixed(3)}ms\n`)

const process = Bun.spawnSync({
    cmd: ["./out/out"],
    stdout: "inherit",
    stderr: "inherit"
})

console.log(`\n\nprogram exited with code ${process.exitCode}`)