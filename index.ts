import { rmSync } from "fs"
import { Lexer } from "./src/lexer"
import { Parser } from "./src/parser"
import { SemanticAnalyzer } from "./src/semantic/analysis"
import { TypeChecker } from "./src/semantic/typing"
import { Codegen } from "./src/gen"
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
fn main() {
    return 10 / 2 + 3 * 4 - 5
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

const sa = new SemanticAnalyzer(ast)
const analyzed = sa.analyze()

const tc = new TypeChecker(ast)
tc.check()

await Bun.write("out/semantic.json", JSON.stringify(analyzed, null, 2))
const semanticTime = performance.now()

console.log(`semantic analysis done in ${(semanticTime - astTime).toFixed(3)}ms`)

const cg = new Codegen("my_module", ast)
const llvmIr = cg.generate()
await Bun.write("out/module.ll", llvmIr)

const cgTime = performance.now()

console.log(`total time: ${(cgTime - start).toFixed(3)}ms`)
console.log("")

Bun.write("out/module.ll", llvmIr)
const clang = Bun.spawn({
    cmd: ["clang", "-o", "out/program.exe", "out/module.ll"],
})
await clang.exited

const exe = Bun.spawn({
    cmd: ["out/program.exe"],
})

await exe.exited

console.log(`program exited with code ${exe.exitCode}`)