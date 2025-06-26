import { ProgramExpression } from "../parser/ast";

export abstract class Codegen {
    protected ast: ProgramExpression;

    constructor(ast: ProgramExpression) {
        this.ast = ast;
    }

    public abstract generate(): string;
}