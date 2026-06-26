import { rmSync } from "fs"
import { Lexer } from "./src/lexer"
import { Parser } from "./src/parser"
import { SemanticAnalyser } from "./src/semantic/analyser"
import { TypeResolver } from "./src/semantic/typing/resolver"
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
    let x: int = 5
    let y := x + 2
    let z := x + y
    let a: i16 = 10
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

await Bun.write("out/analyzed.json", JSON.stringify(analyzed, null, 2))

const tr = new TypeResolver(analyzed)
tr.resolve()

await Bun.write("out/resolved.json", JSON.stringify(analyzed, null, 2))

const semanticTime = performance.now()

console.log(`semantic analysis done in ${(semanticTime - astTime).toFixed(3)}ms`)

console.log(`total time: ${(semanticTime - start).toFixed(3)}ms`)