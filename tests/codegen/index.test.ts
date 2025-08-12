import { expect, it } from "bun:test"
import { Lexer } from "../../src/lexer";
import { Parser } from "../../src/parser";
import { TypeInferrer } from "../../src/typing/inference";
import { TypeChecker } from "../../src/typing/checker";
import { Codegen } from "../../src/codegen";

it("should generate code for function declarations", () => {
    const mod = `
pub fn main() -> int {
    return 5
}
`.trim();

    const tokens = new Lexer(mod).lex();
    const ast = new Parser(tokens).parse();
    const inferred = new TypeInferrer(ast).infer();
    const checked = new TypeChecker(ast).check();

    const gen = new Codegen("main", ast, {});
    const code = gen.generate();

    expect(code).toContain("define i32 @main() {");
    expect(code).toContain("ret i32 5");
})