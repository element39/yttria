import { expect, it } from "bun:test";
import { Lexer } from "../../src/lexer";
import { Parser } from "../../src/parser";
import { VariableDeclaration } from "../../src/parser/ast";
import { TypeInferrer } from "../../src/typing/inference";
import { CheckerType } from "../../src/typing/types";
import { TypeChecker } from "../../src/typing/checker";

it("checks for type errors", () => {
    const mod = "let x: string = 43 / 2";
    const tokens = new Lexer(mod).lex();
    const ast = new Parser(tokens).parse();
    const inf = new TypeInferrer(ast);
    const inferred = inf.infer();
    
    expect(inferred.body.length).toBe(1);
    expect(inferred.body[0].type).toBe("VariableDeclaration");
    expect((inferred.body[0] as VariableDeclaration).resolvedType!.type).toBe("CheckerType");
    expect(((inferred.body[0] as VariableDeclaration).resolvedType as CheckerType).value).toBe("int");

    const checker = new TypeChecker(inferred);
    const errors = checker.check();

    expect(errors.length).toBe(1);
});

it("checks with variables", () => {
    const mod = `
let x := 4
let y := 3
let z: string = x + y
    `.trim();

    const tokens = new Lexer(mod).lex();
    const ast = new Parser(tokens).parse();
    const inf = new TypeInferrer(ast);
    const inferred = inf.infer();

    expect(inferred.body.length).toBe(3);
    expect((inferred.body[1] as VariableDeclaration).resolvedType!.type).toBe("CheckerType");
    expect(((inferred.body[1] as VariableDeclaration).resolvedType as CheckerType).value).toBe("int");

    const checker = new TypeChecker(inferred);
    const errors = checker.check();

    expect(errors.length).toBe(1);
})