import { Expression, ExpressionType, ProgramExpression, VariableDeclaration } from "../parser/ast";
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
        VariableDeclaration: this.checkVariableDeclaration.bind(this),
    }

    constructor(program: ProgramExpression) {
        this.ast = program;
    }

    public check(): void {
        for (const e of this.ast.body) {
            if (e.type in this.table) {
                this.table[e.type]!(e);
            }
        }
    }

    private checkVariableDeclaration(e: Expression): void {
        const { name, value, typeAnnotation, mutable } = e as VariableDeclaration;

        if (!typeAnnotation) {
            // TODO: infer types
            throw new Error(`Variable ${name.value} must have a type annotation`);
        }

        if (!this.types[typeAnnotation.value]) {
            throw new Error(`Type ${typeAnnotation.value} is not defined`);
        }

        const type = this.types[typeAnnotation.value];

        switch (value.type) {
            case "NumberLiteral":
                if (type.type !== "int" && type.type !== "float") {
                    throw new Error(`Cannot assign a number to a variable of type ${type.type}`);
                }
                break;
            case "StringLiteral":
                if (type.type !== "string") {
                    throw new Error(`Cannot assign a string to a variable of type ${type.type}`);
                }
                break;
            case "BooleanLiteral":
                if (type.type !== "bool") {
                    throw new Error(`Cannot assign a boolean to a variable of type ${type.type}`);
                }
                break;
            case "NullLiteral":
                if (type.type !== "null") {
                    throw new Error(`Cannot assign null to a variable of type ${type.type}`);
                }
                break;
        }
    }
}