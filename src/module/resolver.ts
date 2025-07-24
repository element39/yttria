import { ProgramExpression } from "../parser/ast";

export class ModuleResolver {
    private program: ProgramExpression;

    constructor(program: ProgramExpression) {
        this.program = program;
    }

    resolve() {

    }
}