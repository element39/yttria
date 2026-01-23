import { rmSync } from "fs"
import { Lexer } from "./src/lexer"
import { Parser } from "./src/parser"
import { SemanticAnalyzer } from "./src/semantic/analysis"
import { TypeChecker } from "./src/semantic/checker"
import { Codegen } from "./src/gen"
import { TypeInferrer } from "./src/semantic/inferrer"
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
    let a := 10
    let b := 20
    let c := a + b
    return a + b * c / 2 - 5
}
`.trim()

const start = performance.now()

const l = new Lexer(program)
const t = l.lex()
const lexerTime = performance.now()
await Bun.write("out/tok.json", JSON.stringify(t, null, 2))

console.log(`lexed ${program.length} characters in ${(lexerTime - start).toFixed(3)}ms into ${t.length} tokens`)

const p = new Parser(t)
const ast = p.parse()
await Bun.write("out/ast.json", JSON.stringify(ast, null, 2))
const astTime = performance.now()

console.log(`parsed ${t.length} tokens in ${(astTime - lexerTime).toFixed(3)}ms, generated ${ast.body.length} root node(s)`)

const sa = new SemanticAnalyzer(ast)
const analyzed = sa.analyze()

const ti = new TypeInferrer(analyzed)
const inferred = ti.infer()

const tc = new TypeChecker(inferred)
const checked = tc.check()

await Bun.write("out/semantic.json", JSON.stringify(checked, null, 2))
const semanticTime = performance.now()

console.log(`semantic analysis done in ${(semanticTime - astTime).toFixed(3)}ms`)

const cg = new Codegen("my_module", ast)
const llvmIr = cg.generate()
await Bun.write("out/module.ll", llvmIr)

console.log("")

Bun.write("out/module.ll", llvmIr)
const clang = Bun.spawn({
    cmd: ["clang", "-o", "out/program.exe", "out/module.ll"],
})
await clang.exited

const cgTime = performance.now()


console.log(`codegen done in ${(cgTime - semanticTime).toFixed(3)}ms`)
console.log(`total time: ${(cgTime - start).toFixed(3)}ms`)
console.log("")

const exe = Bun.spawn({
    cmd: ["out/program.exe"],
})

await exe.exited

console.log(`program exited with code ${exe.exitCode}`)