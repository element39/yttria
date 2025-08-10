import { ProgramExpression, Expression, VariableDeclaration, Identifier, NumberLiteral, BinaryExpression, ExpressionType } from "../parser/ast";
import { Constraint, Checker, CheckerPlaceholder, CheckerType } from "./types";

export class TypeInferrer {
    private pid: number = 0;
    private ast: ProgramExpression;

    private typeEnviroment = new Map<string, CheckerType | CheckerPlaceholder>();

    private types: Record<string, CheckerType> = {
        bool:   { type: "CheckerType", value: "bool" },

        int:    { type: "CheckerType", value: "int" },
        i8:     { type: "CheckerType", value: "i8" },
        i16:    { type: "CheckerType", value: "i16" },
        i32:    { type: "CheckerType", value: "i32" },
        i64:    { type: "CheckerType", value: "i64" },

        float:  { type: "CheckerType", value: "float" },

        string: { type: "CheckerType", value: "string" },

        void:   { type: "CheckerType", value: "void" },

        null:   { type: "CheckerType", value: "null" },
        unknown: { type: "CheckerType", value: "unknown" },

        // ugc types are added
    };

    private table: { [key in ExpressionType]?: (expr: any) => Expression } = {
        VariableDeclaration: this.inferVariableDeclaration.bind(this)
    }

    constructor(ast: ProgramExpression) {
        this.ast = ast;
    }

    public infer(): ProgramExpression {
        const neue = this.ast

        neue.body = neue.body.map(expr => {
            if (expr.type in this.table) {
                return this.table[expr.type]!(expr);
            }

            return expr;
        });

        return neue;
    }

    private inferVariableDeclaration(decl: VariableDeclaration): VariableDeclaration {
        const ty = this.inferType(decl.value);

        decl.resolvedType = ty;
        this.typeEnviroment.set(decl.name.value, ty);

        return decl;
    }

    private placeholder(): CheckerPlaceholder {
        return { type: "CheckerPlaceholder", id: this.pid++ };
    }

    private inferType(expr: Expression): CheckerType | CheckerPlaceholder {
        switch (expr.type) {
            case "NumberLiteral":
                return this.types.int;
            case "StringLiteral":
                return this.types.string;
            case "BooleanLiteral":
                return this.types.bool;
            case "Identifier":
                return this.typeEnviroment.get((expr as Identifier).value) ?? this.placeholder();
            case "BinaryExpression":
                const left = this.inferType((expr as BinaryExpression).left);
                const right = this.inferType((expr as BinaryExpression).right);
                if (left.type === "CheckerType" && right.type === "CheckerType") {
                    if (left.value === right.value) {
                        return left;
                    }
                }
                return this.placeholder();
        }

        return this.placeholder();
    }
}