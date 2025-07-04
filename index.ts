import { writeFileSync } from "fs"
import { Lexer } from "./lexer"
import { Parser } from "./parser"

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
if (3 > 5) {
    5
} else if (3 < 5) {
    "hello"
} else {
    null
}
`.trim()

const t1 = performance.now()

const l = new Lexer(program)
const t = l.lex()
const p = new Parser(t)
const ast = p.parse()

const t2 = performance.now()

writeFileSync("tok.json", JSON.stringify(t, null, 2))
writeFileSync("ast.json", JSON.stringify(ast, null, 2))

console.log(`parsed ${t.length} tokens in ${(t2 - t1).toFixed(3)}ms`)