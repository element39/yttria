import { FunctionType, Linkage, Type, Value } from "bun-llvm";
import { BinaryExpression, Expression, ExpressionType, FunctionDeclaration, NumberLiteral, ProgramExpression, ReturnExpression } from "../parser/ast";
import { LLVMHelper } from "./helper";

export class Codegen {
    private ast: ProgramExpression;
    private helper: LLVMHelper;
    private scopes: Array<Record<string, Value>> = [];
    
    private table: { [key in ExpressionType]?: (e: any) => Value | null } = {
        FunctionDeclaration: this.genFunctionDeclaration.bind(this),
        ReturnExpression: this.genReturnExpression.bind(this),
    };

    types: { [key: string]: Type }

    constructor(name: string, ast: ProgramExpression) {
        this.ast = ast;
        this.helper = new LLVMHelper(name);

        this.types = {
            "int": Type.int32(this.helper.ctx),
            "i8": Type.int8(this.helper.ctx),
            "i16": Type.int16(this.helper.ctx),
            "i32": Type.int32(this.helper.ctx),
            "i64": Type.int64(this.helper.ctx),

            "float": Type.float(this.helper.ctx),

            "string": Type.pointer(Type.int8(this.helper.ctx)),
            "char": Type.int8(this.helper.ctx),

            "void": Type.void(this.helper.ctx),
            "bool": Type.int1(this.helper.ctx),
        }
    }

    private currentReturnType: Type | null = null;

    private genFunctionDeclaration(expr: FunctionDeclaration): Value | null {
        let retTy = this.getType(expr.resolvedReturnType?.name!);
        this.currentReturnType = retTy;

        const paramTy = expr.params.map(p => this.getType(p.paramType.value));

        const scope: Record<string, Value> = {};
        this.scopes.push(scope);

        const fn = this.helper.fn(
            expr.name.value,
            new FunctionType(paramTy, retTy, false),
            { linkage: (expr.modifiers.includes("pub") || expr.modifiers.includes("extern")) ? Linkage.External : Linkage.Internal }
        );

        for (let i = 0; i < expr.params.length; ++i) {
            const paramName = expr.params[i].name.value;
            scope[paramName] = fn.getArg(i);
        }

        for (const e of expr.body) {
            if (e.type in this.table) {
                const gen = this.table[e.type];
                gen && gen(e);
            }
        }

        this.scopes.pop();
        this.currentReturnType = null;
        return null;
    }

    private genReturnExpression(expr: ReturnExpression): Value | null {
        const value = this.genExpression(expr.value, this.currentReturnType);
        if (!value) throw new Error("Failed to generate return value");
        this.helper.builder.ret(value);
        return null;
    }

    private genExpression(expr: Expression, expectedType?: Type | null): Value | null {
        const tbl: { [key in ExpressionType]?: (expr: any, expectedType?: Type | null) => Value | null } = {
            NumberLiteral: (expr: NumberLiteral, expectedType) => {
                const t = expectedType ?? Type.int32(this.helper.ctx);
                return Value.constInt(t, expr.value);
            },
            Identifier: (expr: any) => {
                const found = [...this.scopes].reverse().find(scope => expr.value in scope);
                if (found) {
                    return found[expr.value];
                }
                throw new Error(`Undefined variable: ${expr.value}`);
            },
            BinaryExpression: (expr: BinaryExpression, expectedType) => {
                const left = this.genExpression(expr.left, expectedType);
                const right = this.genExpression(expr.right, expectedType);
                if (!left || !right) return null;

                switch (expr.operator) {
                    case "+":
                        return this.helper.builder.add(left, right);
                    case "-":
                        return this.helper.builder.sub(left, right);
                    case "*":
                        return this.helper.builder.mul(left, right);
                    case "/": {
                        if (!expectedType) return this.helper.builder.sdiv(left, right);

                        const typeName = Object.entries(this.types).find(([_, v]) => v === expectedType)?.[0];
                        if (typeName === "float") {
                            return this.helper.builder.fdiv(left, right);
                        } else if (["int", "i8", "i16", "i32", "i64"].includes(typeName || "")) {
                            return this.helper.builder.sdiv(left, right);
                        } else {
                            return this.helper.builder.udiv(left, right);
                        }
                    }
                    default:
                        throw new Error(`Unknown binary operator: ${expr.operator}`);
                }
            }
        };

        const visitor = tbl[expr.type];
        if (!visitor) throw new Error(`genExpression: Unhandled expression type: ${expr.type}`);

        return visitor(expr, expectedType);
    }

    generate() {
        for (const expr of this.ast.body) {
            if (expr.type in this.table) {
                const gen = this.table[expr.type];
                gen && gen(expr);
            }
        }

        return this.helper.toString();
    }

    private getType(name: string): Type {
        const type = this.types[name];
        if (!type) throw new Error(`Unknown type: ${name}`);

        return type;
    }
}