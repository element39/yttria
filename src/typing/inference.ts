import { CaseExpression, ElseExpression, Expression, ExpressionType, FunctionDeclaration, IfExpression, NumberLiteral, ProgramExpression, ReturnExpression, SwitchExpression, VariableDeclaration, WhileExpression } from "../parser/ast";
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
        const walk = (expr: Expression): boolean => {
            switch (expr.type) {
                case "ReturnExpression":
                    return true;
                case "IfExpression": {
                    const ifExpr = expr as any;
                    let found = false;
                    for (const stmt of ifExpr.body) {
                        if (walk(stmt)) found = true;
                    }
                    if (ifExpr.alternate) {
                        if (walk(ifExpr.alternate)) found = true;
                    }
                    return found;
                }
                case "ElseExpression": {
                    const elseExpr = expr as any;
                    let found = false;
                    for (const stmt of elseExpr.body) {
                        if (walk(stmt)) found = true;
                    }
                    return found;
                }
                case "WhileExpression": {
                    const whileExpr = expr as any;
                    let found = false;
                    for (const stmt of whileExpr.body) {
                        if (walk(stmt)) found = true;
                    }
                    return found;
                }
                case "SwitchExpression": {
                    const switchExpr = expr as any;
                    let found = false;
                    for (const caseExpr of switchExpr.cases) {
                        if (walk(caseExpr)) found = true;
                    }
                    return found;
                }
                case "CaseExpression": {
                    const caseExpr = expr as any;
                    let found = false;
                    for (const stmt of caseExpr.body) {
                        if (walk(stmt)) found = true;
                    }
                    return found;
                }
                default:
                    return false;
            }
        };

        let resolvedReturnType: CheckerType | undefined = undefined;
        if (fn.returnType) {
            resolvedReturnType = this.types[fn.returnType.value] ?? this.types["unknown"];
        } else {
            let foundType: CheckerType | undefined = undefined;
            const findReturnType = (expr: Expression): CheckerType | undefined => {
                switch (expr.type) {
                    case "ReturnExpression":
                        return this.getTypeByValue((expr as ReturnExpression).value);

                    case "IfExpression":
                        const ixpr = expr as IfExpression;
                        for (const stmt of ixpr.body) {
                            const t = findReturnType(stmt);
                            if (t) return t;
                        }
                        if (ixpr.alternate) {
                            const t = findReturnType(ixpr.alternate);
                            if (t) return t;
                        }
                        break;

                    case "ElseExpression":
                        const eexpr = expr as ElseExpression;
                        for (const stmt of eexpr.body) {
                            const t = findReturnType(stmt);
                            if (t) return t;
                        }
                        break;
                    

                    case "WhileExpression": 
                        const wxpr = expr as WhileExpression;
                        for (const stmt of wxpr.body) {
                            const t = findReturnType(stmt);
                            if (t) return t;
                        }
                        break;
                    

                    case "SwitchExpression": 
                        const sxpr = expr as SwitchExpression;
                        for (const caseExpr of sxpr.cases) {
                            const t = findReturnType(caseExpr);
                            if (t) return t;
                        }
                        break;
                    

                    case "CaseExpression": 
                        const cxpr = expr as CaseExpression;
                        for (const stmt of cxpr.body) {
                            const t = findReturnType(stmt);
                            if (t) return t;
                        }
                        break;
                }

                return undefined;
            };

            for (const stmt of fn.body) {
                const t = findReturnType(stmt);
                if (t) {
                    foundType = t;
                    break;
                }
            }
            resolvedReturnType = foundType ?? this.types["unknown"];
        }

        return {
            ...fn,
            resolvedReturnType,
            body: fn.body.map(xpr => {
                if (xpr.type in this.table) {
                    const txpr = this.table[xpr.type]!(xpr)
                    return txpr ?? xpr
                }
                return xpr
            })
        };
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