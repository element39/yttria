import { Lexer } from "./src/lexer"
import { ModuleResolver } from "./src/module/resolver"
import { Parser } from "./src/parser"
import { TypeChecker } from "./src/typing/checker"
import { TypeInferrer } from "./src/typing/inference"

// error driven development right here
const program = `
pub fn main() {
    const y: int = "hi"
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
const mod = r.resolve()
await Bun.write("modules.json", JSON.stringify(mod, null, 2))
const modTime = performance.now()

console.log(`resolved ${Object.keys(mod).length} module(s) in ${(modTime - astTime).toFixed(3)}ms`)

const ti = new TypeInferrer(ast)
const tiAst = ti.infer()
await Bun.write("tiAst.json", JSON.stringify(tiAst, null, 2))
const inferTime = performance.now()

console.log(`inferred types in ${(inferTime - modTime).toFixed(3)}ms`)

const tc = new TypeChecker(tiAst)
const tce = tc.check()
await Bun.write("tce.json", JSON.stringify(tce, null, 2))

if (tce.length > 0) {
    throw new Error(tce.join("\n"))
}

const checkTime = performance.now()

console.log(`checked types in ${(checkTime - inferTime).toFixed(3)}ms`)

console.log(`finished in ${(checkTime - start).toFixed(3)}ms`)