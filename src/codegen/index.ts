import { ProgramExpression } from "../parser/ast";
import { LLVMHelper } from "./helper";

export class Codegen {
    private ast: ProgramExpression;
    private h: LLVMHelper;

    constructor(name: string, ast: ProgramExpression) {
        this.ast = ast;
        this.h = new LLVMHelper(name);
    }

    generate() {
        return this.h.generate();
    }
}