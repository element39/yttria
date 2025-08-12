import { expect, it } from "bun:test";
import { Lexer } from "../../src/lexer";
import { Parser } from "../../src/parser";
import { FunctionDeclaration, VariableDeclaration } from "../../src/parser/ast";
import { TypeInferrer } from "../../src/typing/inference";
import { CheckerType } from "../../src/typing/types";
import { TypeChecker } from "../../src/typing/checker";

it("variables", () => {
    const mod = `
let a := 5
let x := a * 2
let y := x + a
`.trim();

    const tokens = new Lexer(mod).lex();
    const ast = new Parser(tokens).parse();
    const inf = new TypeInferrer(ast);
    const inferred = inf.infer();

    expect((inferred.body[0] as VariableDeclaration).resolvedType!.type).toBe("CheckerType");
    expect(((inferred.body[0] as VariableDeclaration).resolvedType as CheckerType).value).toBe("int");

    expect((inferred.body[1] as VariableDeclaration).resolvedType!.type).toBe("CheckerType");
    expect(((inferred.body[1] as VariableDeclaration).resolvedType as CheckerType).value).toBe("int");

    expect((inferred.body[2] as VariableDeclaration).resolvedType!.type).toBe("CheckerType");
    expect(((inferred.body[2] as VariableDeclaration).resolvedType as CheckerType).value).toBe("int");

    // console.log(JSON.stringify(inferred.body, null, 2));
    const chk = new TypeChecker(inferred);
    const errors = chk.check();

    expect(errors.length).toBe(0);
});

it("type errors", () => {
    const mod = `
let a: string = 5 + 1
`.trim();

    const tokens = new Lexer(mod).lex();
    const ast = new Parser(tokens).parse();
    const inf = new TypeInferrer(ast);
    const inferred = inf.infer();

    expect((inferred.body[0] as VariableDeclaration).resolvedType!.type).toBe("CheckerType");
    expect(((inferred.body[0] as VariableDeclaration).resolvedType as CheckerType).value).toBe("int");

    const chk = new TypeChecker(inferred);
    const errors = chk.check();
    
    expect(errors.length).toBe(1);
})