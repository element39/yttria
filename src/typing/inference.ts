import { ProgramExpression, Expression, VariableDeclaration, Identifier, NumberLiteral, BinaryExpression } from "../parser/ast";
import { Constraint, Checker, CheckerPlaceholder, CheckerType } from "./types";

export class TypeInferrer {
    private ast: ProgramExpression;
    private constraints: Constraint[] = [];
    private environment: Map<string, Checker> = new Map();
    private placeholderCounter: number = 0;
    private solutions: Map<number, CheckerType> = new Map();
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

    constructor(ast: ProgramExpression) {
        this.ast = ast;
    }

    public infer(): ProgramExpression {
        this.collectConstraints(this.ast);
        this.solveConstraints();
        this.substituteTypes(this.ast);
        return this.ast;
    }

    private collectConstraints(expr: Expression | ProgramExpression): void {
        if (expr.type === "Program") {
            for (const statement of (expr as ProgramExpression).body) {
                this.collectConstraints(statement);
            }
        } else if (expr.type === "VariableDeclaration") {
            const decl = expr as VariableDeclaration;
            const valueType = this.inferExpressionType(decl.value);

            if (valueType.type === "CheckerType") {
                decl.resolvedType = valueType;
            } else {
                const varPlaceholder = this.newPlaceholder();
                this.constraints.push({ type: "BinaryConstraint", left: varPlaceholder, right: valueType, operator: "==" });
                this.environment.set(decl.name.value, varPlaceholder);
                decl.resolvedType = varPlaceholder;
            }
        }
    }

    private solveConstraints(): void {
        for (const constraint of this.constraints) {
            if (constraint.type === "BinaryConstraint" && constraint.operator === "==") {
                const { left, right } = constraint;
                if (left.type === "CheckerPlaceholder" && right.type === "CheckerType") {
                    this.solutions.set(left.id, right);
                } else if (right.type === "CheckerPlaceholder" && left.type === "CheckerType") {
                    this.solutions.set(right.id, left);
                }
            }
        }
    }

    private newPlaceholder(): CheckerPlaceholder {
        return { type: "CheckerPlaceholder", id: this.placeholderCounter++ };
    }

    private inferExpressionType(expr: Expression): Checker {
        if (expr.type === "NumberLiteral") {
            return Number.isInteger((expr as NumberLiteral).value) ? this.types.int : this.types.float;
        }

        if (expr.type === "StringLiteral") {
            return this.types.string;
        }

        if (expr.type === "BooleanLiteral") {
            return this.types.bool;
        }

        if (expr.type === "Identifier") {
            return this.environment.get((expr as Identifier).value) || this.newPlaceholder();
        }

        if (expr.type === "BinaryExpression") {
            const bin = expr as BinaryExpression;
            const left = this.inferExpressionType(bin.left);
            const right = this.inferExpressionType(bin.right);
            if (left.type === "CheckerType" && right.type === "CheckerType") {
                if (left.value === "int" && right.value === "int") {
                    return this.types.int;
                }
                if (left.value === "float" || right.value === "float") {
                    return this.types.float;
                }
            }
            return this.types.unknown;
        }
        return this.newPlaceholder();
    }

    private substituteTypes(expr: Expression | ProgramExpression): void {
        if (expr.type === "Program") {
            for (const statement of (expr as ProgramExpression).body) {
                this.substituteTypes(statement);
            }
        } else if (expr.type === "VariableDeclaration") {
            const resolved = (expr as VariableDeclaration).resolvedType;

            if (resolved && resolved.type === "CheckerPlaceholder") {
                const solved = this.getSolvedType(resolved);
                if (solved) (expr as VariableDeclaration).resolvedType = solved;
            }
        }
    }

    private getSolvedType(placeholder: CheckerPlaceholder): CheckerType | undefined {
        return this.solutions.get(placeholder.id);
    }
}