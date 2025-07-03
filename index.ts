import { Lexer } from "./lexer"

const program = `
fn fib(n: int) -> int {
    if (n <= 1) {
        return n
    }
    
    return fib(n - 1) + fib(n - 2)
}

fn main() -> int {
    return fib(5)
}
`.trim()

const l = new Lexer(program)
const t = l.lex()

console.log(t.map((j) => j.literal).join(" "))