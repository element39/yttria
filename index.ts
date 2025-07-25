import { LLVMGen } from "./src/gen/llvm"
import { Lexer } from "./src/lexer"
import { ModuleResolver } from "./src/module/resolver"
import { Parser } from "./src/parser"
import { TypeChecker } from "./src/typing/checker"
import { TypeInferrer } from "./src/typing/inference"

// error driven development right here
const program = `
import std/io
pub fn main() {
    io.println("hi")
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
const modules = r.resolve()
await Bun.write("modules.json", JSON.stringify(modules, null, 2))
const modTime = performance.now()

console.log(`resolved ${Object.keys(modules).length} module(s) in ${(modTime - astTime).toFixed(3)}ms`)

const bundle = { ...modules, program: { ast } }

for (const [name, module] of Object.entries(bundle)) {
    console.log(`processing module: ${name}`)

    const ti = new TypeInferrer(module.ast)
    const tiAst = ti.infer()

    const tc = new TypeChecker(tiAst)
    const tce = tc.check()

    if (tce.length > 0) {
        throw new Error(`type errors in module "${name}":\n${tce.join("\n")}`)
    }

    const cg = new LLVMGen(tiAst, name)
    const llvmIR = cg.generate()
    
    await Bun.write(`${name === "program" ? "tiAst" : name.replace(/\//g, "_")}.json`, JSON.stringify(tiAst, null, 2))
    await Bun.write(`${name === "program" ? "main" : name.replace(/\//g, "_")}.ll`, llvmIR)
    
    cg.writeToFile(`out/${name === "program" ? "main" : name.replace(/\//g, "_")}.o`)
    console.log(`generated code for module "${name}"`)
}

const checkTime = performance.now()

console.log(`finished in ${(checkTime - start).toFixed(3)}ms`)