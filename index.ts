import { LLVMGen } from "./src/codegen/llvm/llvm"
import { Lexer } from "./src/lexer"
import { Parser } from "./src/parser"
import { Typechecker } from "./src/typechecker"
// error driven development right here

const program = `
fn fib(n: int) -> int {
    if (n <= 1) {
        return n
    }
    
    return fib(n - 1) + fib(n - 2)
}

fn add(b: i32, a: i32) -> i32 {
    return a + b
}

fn main() -> int {
    return fib(12) // returns 144!!!!!!!!! im so goated
}
`.trim()

const start = performance.now()

const l = new Lexer(program)
const t = l.lex()

const lexerTime = performance.now()

Bun.write("tok.json", JSON.stringify(t, null, 2))

console.log(`lexed ${t.length} tokens in ${(lexerTime - start).toFixed(3)}ms`)

const p = new Parser(t)
const ast = p.parse()

Bun.write("ast.json", JSON.stringify(ast, null, 2))

const astTime = performance.now()
console.log(`parsed ${t.length} tokens in ${(astTime - lexerTime).toFixed(3)}ms, generated ${ast.body.length} root node(s)`)

const tc = new Typechecker(ast);
const c = tc.check()

Bun.write("tcAst.json", JSON.stringify(c, null, 2))


const typecheckTime = performance.now()

console.log(`typechecked in ${(typecheckTime - astTime).toFixed(3)}ms`)

const gen = new LLVMGen(c)
const ll = gen.generate()

Bun.write("out.ll", ll)

const llTime = performance.now()

console.log(`generated ${(Buffer.byteLength(ll, 'utf8') / 1024).toFixed(3)}kB of LLVM IR in ${(llTime - typecheckTime).toFixed(3)}ms\n`)

console.log("compiling to executable...")
const llc = Bun.spawnSync(["llc", "out.ll", "-o", "out.s", "-O3"])
if (llc.exitCode !== 0) {
    console.error("llc failed with exit code", llc.exitCode)
    if (llc.stdout) console.error("stdout:", llc.stdout.toString())
    //@ts-ignore
    if (llc.stderr) console.error("stderr:", llc.stderr.toString())
    process.exit(1)
}

// Link to executable (Windows: out.exe, Linux/macOS: out)
const linker = Bun.spawnSync([
    "clang", "out.s", "-o", process.platform === "win32" ? "out.exe" : "out",
])
if (linker.exitCode !== 0) {
    console.error("linker failed with exit code", linker.exitCode)
    if (linker.stdout) console.error("stdout:", linker.stdout.toString())
    //@ts-ignore
    if (linker.stderr) console.error("stderr:", linker.stderr.toString())
    process.exit(2)
}

const exeTime = performance.now()
console.log(`(${(Bun.file(process.platform === "win32" ? "out.exe" : "out").size / 1024).toFixed(3)}kB) compiled in ${(exeTime - llTime).toFixed(3)}ms`)
console.log(`total compilation time: ${(exeTime - start).toFixed(3)}ms\n`)

console.log("running...")
const exe = Bun.spawnSync([
    "./out"
], {
    stdout: "pipe",
    stderr: "pipe"
})

console.log(`exit code: ${exe.exitCode}`)

const run = performance.now()
console.log(`total run time: ${(performance.now() - run).toFixed(3)}ms\n`)
console.log(`total time: ${(run - start).toFixed(3)}ms`)
