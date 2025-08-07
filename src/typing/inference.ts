import { BinaryExpression, Expression, ExpressionType, NumberLiteral, StringLiteral, BooleanLiteral, ProgramExpression, VariableDeclaration, Identifier } from "../parser/ast";
import { CheckerType, BinaryConstraint, Checker, Constraint, CheckerPlaceholder } from "./types";

export class TypeInferrer {
    private ast: ProgramExpression;
    private inferred: ProgramExpression = { type: "Program", body: [] };
    private types: Record<string, CheckerType> = {
        int:    { type: "CheckerType", value: "int" },
        i8:     { type: "CheckerType", value: "i8" },
        i16:    { type: "CheckerType", value: "i16" },
        i32:    { type: "CheckerType", value: "i32" },
        i64:    { type: "CheckerType", value: "i64" },
        float:  { type: "CheckerType", value: "float" },
        string: { type: "CheckerType", value: "string" },
        bool:   { type: "CheckerType", value: "bool" },
        void:   { type: "CheckerType", value: "void" },
        null:   { type: "CheckerType", value: "null" },
        unknown: { type: "CheckerType", value: "unknown" },
    };

    private environment: Array<Map<string, CheckerType | CheckerPlaceholder>> = [];
    private constraints: Constraint[] = [];
    private placeholders: Array<Map<number, CheckerType>> = [];

    private table: { [key in ExpressionType]?: (expr: any) => Expression | null } = {
        VariableDeclaration: this.inferVariableDeclaration.bind(this),
    };

    constructor(ast: ProgramExpression) {
        this.ast = ast;
    }

    public infer(): ProgramExpression {
        this.pushEnv();

            for (const expr of this.ast.body) {
                if (!(expr.type in this.table)) continue;
                const result = this.table[expr.type];
                if (!result) continue;
                const inf = result(expr);
                if (!inf) continue;
                this.inferred.body.push(inf);
            }
            this.unify();
            this.substitute();

        this.popEnv();
        
        return this.inferred;
    }

    private inferVariableDeclaration(expr: VariableDeclaration): VariableDeclaration {
        const value = expr.value;
        const valueType = this.inferType(value);
        const placeholder = this.newPlaceholder();

        this.constraints.push({
            type: "BinaryConstraint",
            left: placeholder,
            right: valueType,
            operator: "=="
        });

        this.environment[this.environment.length - 1].set(expr.name.value, placeholder);

        return {
            ...expr,
            resolvedType: placeholder
        };
    }


    private inferType(expr: Expression): Checker {
        switch (expr.type) {
            case "BinaryExpression": {
                const bin = expr as BinaryExpression;
                const left = this.inferType(bin.left);
                const right = this.inferType(bin.right);

                if (left && right && left.type === right.type && (left as any).name === (right as any).name) {
                    return left;
                }

                return this.types.unknown;
            }
            
            case "NumberLiteral": {
                const num = expr as NumberLiteral;
                if (Number.isInteger(num.value)) {
                    return this.types.int;
                } else {
                    return this.types.float;
                }
            }

            case "StringLiteral": {
                return this.types.string;
            }

            case "BooleanLiteral": {
                return this.types.bool;
            }

            case "Identifier": {
                const env = this.environment[this.environment.length - 1];
                const type = env.get((expr as Identifier).value);

                if (!type) {
                    throw new Error(`identifier ${(expr as Identifier).value} not found in the current scope.`);
                }

                return type;
            }
        }

        return this.types.unknown;
    }


    private newPlaceholder(): CheckerPlaceholder {
        const current = this.currentEnv();
        const id = current ? current.size : 0;

        return {
            type: "CheckerPlaceholder",
            id
        };
    }

    private unify() {
        const current = this.currentEnv();
        if (!current) return;

        for (const constraint of this.constraints) {
            if (constraint.left.type === "CheckerPlaceholder" && constraint.right.type === "CheckerType") {
                current.set(constraint.left.id, constraint.right);
            } else if (constraint.right.type === "CheckerPlaceholder" && constraint.left.type === "CheckerType") {
                current.set(constraint.right.id, constraint.left);
            }
        }
    }

    private substitute() {
        const current = this.currentEnv()
        
        for (const expr of this.inferred.body) {
            if (expr.type === "VariableDeclaration") {
                const v = expr as VariableDeclaration;

                if (v.resolvedType && v.resolvedType.type === "CheckerPlaceholder") {
                    const resolved = current ? current.get(v.resolvedType.id) : undefined;

                    if (resolved) {
                        v.resolvedType = resolved;
                    } else {
                        v.resolvedType = this.types.unknown;
                    }
                }
            }
        }
    }

    private pushEnv() {
        this.environment.push(new Map());
        this.placeholders.push(new Map());
    }

    private popEnv() {
        this.environment.pop();
        this.placeholders.pop();
    }

    private currentEnv() {
        // ????
        return this.placeholders.length > 0 ? this.placeholders[this.placeholders.length - 1] : undefined;
    }
}