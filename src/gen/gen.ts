import { ProgramAST } from "../parser/ast";

export abstract class CodeGen {
    constructor(protected name: string, protected ast: ProgramAST) {}
    abstract generate(ast: ProgramAST): string;
}