import { ProgramExpression } from "../parser/ast";

export abstract class Codegen {
    private ast: ProgramExpression;

    constructor(ast: ProgramExpression) {
        this.ast = ast;
    }

    abstract generate(): string;
}