import { ProgramExpression, Expression, VariableDeclaration, Identifier, NumberLiteral, BinaryExpression, ExpressionType, FunctionDeclaration, IfExpression, ReturnExpression } from "../parser/ast";
import { Constraint, Checker, CheckerPlaceholder, CheckerType, BinaryConstraint } from "./types";

export class TypeInferrer {
    private pid: number = 0;
    private ast: ProgramExpression;

    private typeEnviroment = new Map<string, CheckerType | CheckerPlaceholder>();
    private constraints: Constraint[] = [];

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
        VariableDeclaration: this.inferVariableDeclaration.bind(this),
        FunctionDeclaration: this.inferFunctionDeclaration.bind(this),
        IfExpression: this.inferIfExpression.bind(this),
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

        this.unify();
        neue.body.forEach(expr => this.applyResolvedTypes(expr));
        return neue;
    }

    private inferVariableDeclaration(decl: VariableDeclaration): VariableDeclaration {
        const ty = this.inferType(decl.value);

        decl.resolvedType = ty;
        this.typeEnviroment.set(decl.name.value, ty);

        return decl;
    }

    private inferFunctionDeclaration(decl: FunctionDeclaration): FunctionDeclaration {
        const oldEnv = this.typeEnviroment;
        this.typeEnviroment = new Map(oldEnv);

        decl.params.forEach(param => {
            this.typeEnviroment.set(param.name.value, this.getTypeOrThrow(param.paramType.value));
        });

        const returnTypes: (CheckerType | CheckerPlaceholder)[] = [];

        const collectReturnTypes = (expr: Expression): void => {
            if (expr.type === "ReturnExpression") {
                const retType = this.inferType((expr as ReturnExpression).value);
                returnTypes.push(retType);
            }
            
            if (expr.type === "IfExpression") {
                const ifExpr = expr as IfExpression;
                ifExpr.body.forEach(collectReturnTypes);
                if (ifExpr.alternate) {
                    ifExpr.alternate.body.forEach(collectReturnTypes);
                }
            }
        };

        decl.body = decl.body.map(e => {
            if (e.type in this.table) {
                collectReturnTypes(e);
                return this.table[e.type]!(e);
            }
            collectReturnTypes(e);
            return e;
        });

        let resolvedReturnType: CheckerType | CheckerPlaceholder | undefined;
        if (returnTypes.length === 0) {
            resolvedReturnType = this.types.void;
        } else {
            const concreteTypes = returnTypes.filter(t => this.isConcrete(t)) as CheckerType[];
            if (concreteTypes.length === returnTypes.length) {
                const firstType = concreteTypes[0];

                if (concreteTypes.every(t => t.value === firstType.value)) {
                    resolvedReturnType = firstType;
                } else {
                    resolvedReturnType = this.types.unknown;
                }
            } else {
                resolvedReturnType = returnTypes[0];
            }
        }

        decl.resolvedReturnType = resolvedReturnType;

        this.typeEnviroment = oldEnv;
        return decl;
    }

    private inferIfExpression(expr: IfExpression): IfExpression {
        expr.inferredCondition = this.inferType(expr.condition);

        expr.body = expr.body.map(e => {
            if (e.type in this.table) {
                return this.table[e.type]!(e);
            }

            return e;
        });
        
        if (!expr.alternate) return expr

        expr.alternate.body = expr.alternate.body.map(e => {
            if (e.type in this.table) {
                return this.table[e.type]!(e);
            }

            return e;
        });

        return expr;
    }

    private unify() {
        for (const c of this.constraints) {
            if (c.type === "BinaryConstraint") {
                const { left, right } = c;
                if (this.isConcrete(left) && this.isConcrete(right)) continue

                else if (this.isPlaceholder(left) && this.isConcrete(right)) this.replacePlaceholder(left.id, right);
                else if (this.isConcrete(left) && this.isPlaceholder(right)) this.replacePlaceholder(right.id, left);
                else if (this.isPlaceholder(left) && this.isPlaceholder(right)) this.mergePlaceholders(left.id, right.id);
            }
        }
    }

    private applyResolvedTypes(expr: Expression): void {
        switch (expr.type) {
            case "VariableDeclaration":
                const vd = expr as VariableDeclaration;
                const ty = this.typeEnviroment.get(vd.name.value);
                if (ty && this.isConcrete(ty)) {
                    vd.resolvedType = ty;
                }
                this.applyResolvedTypes(vd.value);
                break;
            case "BinaryExpression":
                const be = expr as BinaryExpression;
                this.applyResolvedTypes(be.left);
                this.applyResolvedTypes(be.right);
                break;
        }
    }


    private placeholder(): CheckerPlaceholder {
        return { type: "CheckerPlaceholder", id: this.pid++ };
    }

    private inferType(expr: Expression): CheckerType | CheckerPlaceholder {
        switch (expr.type) {
            case "NumberLiteral":
                return Number.isInteger((expr as NumberLiteral).value)
                    ? this.types.int
                    : this.types.float;
            case "StringLiteral":
                return this.types.string;
            case "BooleanLiteral":
                return this.types.bool;
            case "Identifier":
                return this.typeEnviroment.get((expr as Identifier).value) ?? this.placeholder();
            case "BinaryExpression":
            const binExpr = expr as BinaryExpression;
            const left = this.inferType(binExpr.left);
            const right = this.inferType(binExpr.right);

            if (this.isConcrete(left) && this.isConcrete(right)) {
                if (binExpr.operator === "/") {
                    return this.types.float;
                }

                if (left.value === right.value) {
                    return left;
                }

                throw new Error(`type mismatch in ${binExpr.operator}: ${left.value} vs ${right.value}`);
            } else {
                this.constraints.push({
                    type: "BinaryConstraint",
                    left,
                    right,
                    operator: "=="
                } as BinaryConstraint);
                return this.placeholder();
            }
        }

        return this.placeholder();
    }

    private getTypeOrThrow(name: string): CheckerType {
        const type = this.types[name]
        if (!type) {
            throw new Error(`type not found for ${name}`);
        }
        return type;
    }

    private isConcrete(t: Checker): t is CheckerType {
        return t.type === "CheckerType";
    }

    private isPlaceholder(t: Checker): t is CheckerPlaceholder {
        return t.type === "CheckerPlaceholder";
    }

    private replacePlaceholder(id: number, withType: CheckerType) {
        for (const [name, ty] of this.typeEnviroment) {
            if (this.isPlaceholder(ty) && ty.id === id) {
                this.typeEnviroment.set(name, withType);
            }
        }

        for (const c of this.constraints) {
            if (c.type === "BinaryConstraint") {
                if (this.isPlaceholder(c.left) && c.left.id === id) {
                    c.left = withType;
                }
                if (this.isPlaceholder(c.right) && c.right.id === id) {
                    c.right = withType;
                }
            }
        }
    }

    private mergePlaceholders(id1: number, id2: number) {
        for (const [name, ty] of this.typeEnviroment) {
            if (this.isPlaceholder(ty) && ty.id === id2) {
                this.typeEnviroment.set(name, { type: "CheckerPlaceholder", id: id1 });
            }
        }

        for (const c of this.constraints) {
            if (c.type === "BinaryConstraint") {
                if (this.isPlaceholder(c.left) && c.left.id === id2) {
                    c.left.id = id1;
                }
                if (this.isPlaceholder(c.right) && c.right.id === id2) {
                    c.right.id = id1;
                }
            }
        }
    }
}