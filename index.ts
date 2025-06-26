// import { writeFileSync } from "fs";
import { writeFileSync } from "fs";
import { TypeChecker } from "./src/checker/checker";
import { LLVMGen } from "./src/codegen/llvm/llvm";
import { Lexer } from "./src/lexer/lexer";
import { Parser } from "./src/parser/parser";
// const program = `
//     const a := 5
//     const b: int = 10

//     fn main() -> int {
//         const x := 3
//         return x + a + b
//     }
// `

const program = `
    fn main() -> int {
        return (1 + 2 * 3 - 4 / 2) * 10
    }
`;

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

const ggc = Bun.spawnSync(["gcc", "out.s", "-o", "out", "-lm"]);
if (ggc.exitCode !== 0) {
    console.error("GCC compilation failed:", new TextDecoder().decode(ggc.stderr));
    process.exit(1);
}

const exe = Bun.spawnSync(["./out"]);
console.log("Exit code:", exe.exitCode);
console.log("Output:\n");
process.stdout.write(new TextDecoder().decode(exe.stdout));
