import { Expression, ExpressionType, FunctionDeclaration, NumberLiteral, ProgramExpression, VariableDeclaration } from "../parser/ast";
import { CheckerType } from "./types";

export class TypeInferrer {
    private ast: ProgramExpression
    private inferred: ProgramExpression = { type: "Program", body: [] }
    private types: Record<string, CheckerType> = {
        int:    { type: "CheckerType", name: "int" },
        i8:     { type: "CheckerType", name: "i8" },
        i16:    { type: "CheckerType", name: "i16" },
        i32:    { type: "CheckerType", name: "i32" },
        i64:    { type: "CheckerType", name: "i64" },
        float:  { type: "CheckerType", name: "float" },
        string: { type: "CheckerType", name: "string" },
        bool:   { type: "CheckerType", name: "bool" },
        void:   { type: "CheckerType", name: "void" },
        null:   { type: "CheckerType", name: "null" },
        unknown: { type: "CheckerType", name: "unknown" },
    }

    private table: { [key in ExpressionType]?: (expr: any) => Expression | null } = {
        FunctionDeclaration: this.inferFunctionDeclaration.bind(this),
        VariableDeclaration: this.inferVariableDeclaration.bind(this),
    }

    constructor(ast: ProgramExpression) {
        this.ast = ast
    }

    infer() {
        for (const expr of this.ast.body) {
            if (expr.type in this.table) {
                const txpr = this.table[expr.type]!(expr)
                if (txpr) this.inferred.body = [...this.inferred.body, txpr]
            }
        }

        return this.inferred
    }

    private inferFunctionDeclaration(fn: FunctionDeclaration): FunctionDeclaration {
        return {
            ...fn,
            body: fn.body.map(xpr => {
                if (xpr.type in this.table) {
                    const txpr = this.table[xpr.type]!(xpr)
                    return txpr ?? xpr
                }
                return xpr
            })
        }
    }

    private inferVariableDeclaration(v: VariableDeclaration): VariableDeclaration {
        const iv = v;

        let resolvedType: CheckerType;
        resolvedType = this.getTypeByValue(iv.value);

        if (!resolvedType) resolvedType = this.types["unknown"];

        return {
            ...iv,
            resolvedType
        }
    }

    private getTypeByValue(v: Expression): CheckerType {
        switch (v.type) {
            case "NumberLiteral":
                const nl = v as NumberLiteral
                if (Number.isInteger(nl.value)) return this.types["int"]
                return this.types["float"]
            case "BooleanLiteral":
                return this.types["bool"]
            case "StringLiteral":
                return this.types["string"]
            case "Identifier":
                return this.types["unknown"]
        } 

        return this.types["unknown"]
    }
}