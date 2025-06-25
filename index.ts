// import { writeFileSync } from "fs";
import { writeFileSync } from "fs";
import { Lexer } from "./src/lexer/lexer";
import { Parser } from "./src/parser/parser";
const program = `
    3 + 4 * 5 - 6 / 2
`

const l = new Lexer(program)
const t = l.lex()
const p = new Parser(t);
const ast = p.parse();
writeFileSync("ast.json", JSON.stringify(ast, null, 2));