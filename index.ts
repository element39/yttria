import { Lexer } from "./src/lexer"
import { ModuleResolver } from "./src/module/resolver"
import { Parser } from "./src/parser"

// error driven development right here
const program = `
use std/io

pub fn main() {
    io.println("no hands!")
    return 2
}
`.trim()

const start = performance.now()

const l = new Lexer(program)
const t = l.lex()
const lexerTime = performance.now()

await Bun.write("tok.json", JSON.stringify(t, null, 2))

console.log(`lexed ${t.length} tokens in ${(lexerTime - start).toFixed(3)}ms`)

const p = new Parser(t)
const ast = p.parse()

await Bun.write("ast.json", JSON.stringify(ast, null, 2))
const astTime = performance.now()
console.log(`parsed ${t.length} tokens in ${(astTime - lexerTime).toFixed(3)}ms, generated ${ast.body.length} root node(s)`)

const r = new ModuleResolver(ast)
const i = r.resolve()

console.log(r.modules)