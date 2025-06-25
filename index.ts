// import { writeFileSync } from "fs";
import { writeFileSync } from "fs";
import { Lexer } from "./src/lexer/lexer";
import { Parser } from "./src/parser/parser";
const program = `
    const a := 5
    const b: int = 10

    fn main() -> int {
        const x := 3
        return x + a + b
    }
`

const l = new Lexer(program)
const t = l.lex()
const p = new Parser(t);
const ast = p.parse();
writeFileSync("ast.json", JSON.stringify(ast, null, 2));