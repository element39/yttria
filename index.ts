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
fn main() -> int {
    return 5
}
`.trim()

const l = new Lexer(program)
const t = l.lex()
const p = new Parser(t)
const ast = p.parse()

writeFileSync("ast.json", JSON.stringify(ast, null, 2))
console.log(JSON.stringify(ast, null, 2))