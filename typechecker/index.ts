import { Expression, ExpressionType, ProgramExpression } from "../parser/ast";
import { CheckerSymbol } from "./types";

export class Typechecker {
    ast: ProgramExpression;

    // ← now allows "int", "Point", "MyStruct", etc.
    types: Record<string, CheckerSymbol> = {
        int:   { type: "int" },
        float: { type: "float" },
        string:{ type: "string" },
        bool:  { type: "bool" },
        null:  { type: "null" },
    }

    table: { [key in ExpressionType]?: (e: Expression) => void } = {

    }

    constructor(program: ProgramExpression) {
        this.ast = program;
    }

    check(): void {
        for (const e of this.ast.body) {
            if (e.type in this.table) {
                this.table[e.type]!(e);
            }
        }
    }
}