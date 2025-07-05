import { Expression, ExpressionType, FunctionDeclaration, IfExpression, ProgramExpression, ReturnExpression, VariableDeclaration } from "../parser/ast";
import { CheckerSymbol } from "./types";

export class Typechecker {
    src: ProgramExpression;
    ast: ProgramExpression = {
        type: "Program",
        body: [],
    }

    // ← now allows "int", "Point", "MyStruct", etc.
    types: Record<string, CheckerSymbol> = {
        int:   { type: "int" },
        float: { type: "float" },
        string:{ type: "string" },
        bool:  { type: "bool" },
        null:  { type: "null" },
    }

    table: { [key in ExpressionType]?: (e: any) => Expression } = {
        VariableDeclaration: this.checkVariableDeclaration.bind(this),
        FunctionDeclaration: this.checkFunctionDeclaration.bind(this),
    }

    constructor(program: ProgramExpression) {
        this.src = program;
    }

    public check(): ProgramExpression {
        for (let e of this.src.body) {
            if (e.type in this.table) {
                const expr = this.table[e.type]!(e);
                this.ast.body.push(expr);
            }
        }

        return this.ast;
    }

    private checkVariableDeclaration(e: VariableDeclaration): VariableDeclaration {
        let type: CheckerSymbol | undefined;

        if (!e.typeAnnotation) {
            switch (e.value.type) {
                case "NumberLiteral":
                    type = this.types["int"];
                    break;
                case "StringLiteral":
                    type = this.types["string"];
                    break;
                case "BooleanLiteral":
                    type = this.types["bool"];
                    break;
                case "NullLiteral":
                    type = this.types["null"];
                    break;
                default:
                    throw new Error(`Cannot infer type for variable ${e.name.value}`);
            }
            e.resolvedType = type;
        } else {
            if (!this.types[e.typeAnnotation.value]) {
                throw new Error(`Type ${e.typeAnnotation.value} is not defined`);
            }

            switch (e.typeAnnotation.value) {
                case "int":
                case "float":
                    if (e.value.type !== "NumberLiteral") {
                        throw new Error(`Type mismatch: expected int, got ${e.typeAnnotation.value}`);
                    }
                    break;
                case "string":
                    if (e.value.type !== "StringLiteral") {
                        throw new Error(`Type mismatch: expected string, got ${e.typeAnnotation.type}`);
                    }
                    break;
                case "bool":
                    if (e.value.type !== "BooleanLiteral") {
                        throw new Error(`Type mismatch: expected bool, got ${e.typeAnnotation.value}`);
                    }
                    break;
                case "null":
                    if (e.value.type !== "NullLiteral") {
                        throw new Error(`Type mismatch: expected null, got ${e.typeAnnotation.value}`);
                    }
                    break;
                default:
                    throw new Error(`Unknown type ${e.typeAnnotation.value}`);
            }

            type = this.types[e.typeAnnotation.value];
        }

        return e
    }

    private checkFunctionDeclaration(e: FunctionDeclaration): FunctionDeclaration {
        const findReturns = (body: Expression[]): ReturnExpression[] => {
            let returns: ReturnExpression[] = [];
            for (const expr of body) {
                if (expr.type === "ReturnExpression") {
                    returns.push(expr as ReturnExpression);
                } else if (expr.type === "IfExpression") {
                    const ifExpr = expr as IfExpression;
                    returns = returns.concat(findReturns(ifExpr.body));
                    if (ifExpr.alternate) {
                        returns = returns.concat(findReturns(ifExpr.alternate.body));
                    }
                }
            }
            return returns;
        };

        const returns: ReturnExpression[] = findReturns(e.body);
        if (!e.returnType) {
            if (returns.length === 0) {
                throw new Error(`Function ${e.name.value} has no return type specified and no return statements found`);
            }

            const firstType = returns[0].value.type;
            for (const ret of returns) {
                if (ret.value.type !== firstType) {
                    throw new Error(`Inconsistent return types in function ${e.name.value}`);
                }
            }

            switch (firstType) {
                case "NumberLiteral":
                    e.resolvedReturnType = this.types["int"];
                    break;
                case "StringLiteral":
                    e.resolvedReturnType = this.types["string"];
                    break;
                case "BooleanLiteral":
                    e.resolvedReturnType = this.types["bool"];
                    break;
                case "NullLiteral":
                    e.resolvedReturnType = this.types["null"];
                    break;
                default:
                    throw new Error(`Cannot infer return type for function ${e.name.value}`);
            }
        } else {
            for (const ret of returns) {
                switch (ret.value.type) {
                    case "NumberLiteral":
                        if (e.returnType.value !== "int") {
                            throw new Error(`Type mismatch: expected ${e.returnType.value}, got int`);
                        }
                        break;
                    case "StringLiteral":
                        if (e.returnType.value !== "string") {
                            throw new Error(`Type mismatch: expected ${e.returnType.value}, got string`);
                        }
                        break;
                    case "BooleanLiteral":
                        if (e.returnType.value !== "bool") {
                            throw new Error(`Type mismatch: expected ${e.returnType.value}, got bool`);
                        }
                        break;
                    case "NullLiteral":
                        if (e.returnType.value !== "null") {
                            throw new Error(`Type mismatch: expected ${e.returnType.value}, got null`);
                        }
                        break;
                    default:
                        throw new Error(`Cannot infer type for return value in function ${e.name.value}`);
                }
            }
        }
        return e
    }
}