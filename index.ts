import { writeFileSync } from "fs";
import { TypeChecker } from "./src/checker/checker";
import { LLVMGen } from "./src/codegen/llvm/llvm";
import { Lexer } from "./src/lexer/lexer";
import { Parser } from "./src/parser/parser";
const program = `
    const radius: int = 5;
    const pi: float = 3.14159;
    fn main() -> int {
        pi * radius * radius;
    }
`

const l = new Lexer(program)
const t = l.lex()

const p = new Parser(t);
const ast = p.parse();

const c = new TypeChecker(ast);
const typed = c.check();
writeFileSync("ast.json", JSON.stringify(typed, null, 2));

const g = new LLVMGen(typed);
const ll = g.generate();

writeFileSync("out.ll", ll);

const llc = Bun.spawnSync(["llc", "out.ll", "-o", "out.s"]);
if (llc.exitCode !== 0) {
    console.error("LLC compilation failed:", new TextDecoder().decode(llc.stderr));
    process.exit(1);
}

const gcc = Bun.spawnSync(["gcc", "out.s", "-o", "out", "-lm"]);
if (gcc.exitCode !== 0) {
    console.error("GCC compilation failed:", new TextDecoder().decode(gcc.stderr));
    process.exit(1);
}

const exe = Bun.spawnSync(["./out"]);
console.log("Exit code:", exe.exitCode);
console.log("Output:\n");
process.stdout.write(new TextDecoder().decode(exe.stdout));
