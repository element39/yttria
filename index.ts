import { writeFileSync } from "fs"
import { Lexer } from "./lexer"
import { Parser } from "./parser"
import { Typechecker } from "./typechecker"

// const program = `
// fn fib(n: int) -> int {
//     if (n <= 1) {
//         return n
//     }
    
//     return fib(n - 1) + fib(n - 2)
// }

// fn main() -> int {
//     return fib(5)
// }
// `.trim()

const program = `
const a: int = 5
const b: bool = true
const c: string = "hello world"
// const d: string? = null
`.trim()

const start = performance.now()

const l = new Lexer(program)
const t = l.lex()

const lexerTime = performance.now()

writeFileSync("tok.json", JSON.stringify(t, null, 2))

console.log(`lexed ${t.length} tokens in ${(lexerTime - start).toFixed(3)}ms`)

const p = new Parser(t)
const ast = p.parse()

const astTime = performance.now()

writeFileSync("ast.json", JSON.stringify(ast, null, 2))

console.log(`parsed ${t.length} tokens in ${(astTime - lexerTime).toFixed(3)}ms, generated ${ast.body.length} root node(s)`)

const tc = new Typechecker(ast);
tc.check()

const typecheckTime = performance.now()

console.log(`typechecked in ${(typecheckTime - astTime).toFixed(3)}ms`)

console.log(`total time: ${(typecheckTime - start).toFixed(3)}ms`)