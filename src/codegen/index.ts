import { FunctionType, Linkage, Type, Value } from "bun-llvm";
import { BinaryExpression, Expression, ExpressionType, FunctionDeclaration, NumberLiteral, ProgramExpression, ReturnExpression, VariableDeclaration } from "../parser/ast";
import { LLVMHelper } from "./helper";

export class Codegen {
    private ast: ProgramExpression;
    private helper: LLVMHelper;
    private scopes: Array<Record<string, { value: Value, isPointer: boolean }>> = [];
    
    private table: { [key in ExpressionType]?: (e: any) => Value | null } = {
        FunctionDeclaration: this.genFunctionDeclaration.bind(this),
        ReturnExpression: this.genReturnExpression.bind(this),
        VariableDeclaration: this.genVariableDeclaration.bind(this)
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

        const scope: Record<string, { value: Value, isPointer: boolean }> = {};
        this.scopes.push(scope);

        const fn = this.helper.fn(
            expr.name.value,
            new FunctionType(paramTy, retTy, false),
            {
                linkage: (expr.modifiers.includes("pub") || expr.modifiers.includes("extern")) ? Linkage.External : Linkage.Internal,
                extern: expr.modifiers.includes("extern")
            }
        );
        
        expr.params.forEach((param, i) => {
            const paramName = param.name.value;
            scope[paramName] = { value: fn.getArg(i), isPointer: false };
        });

        if (!expr.modifiers.includes("extern")) {
            let hasReturn = false;
            for (const e of expr.body) {
                if (e.type === "ReturnExpression") hasReturn = true;
                if (e.type in this.table) {
                    const gen = this.table[e.type];
                    gen && gen(e);
                }
            }

            if (!hasReturn && expr.resolvedReturnType?.name === "void") {
                this.helper.builder.ret();
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

    private genVariableDeclaration(expr: VariableDeclaration): Value | null {
        const varName = expr.name.value;
        const varType = this.getType(expr.typeAnnotation?.value || expr.resolvedType?.name || "int");

        const value = this.genExpression(expr.value, varType);
        if (!value) throw new Error(`Failed to generate value for variable ${expr.name.value}`);

        const alloca = this.helper.builder.alloca(varType, expr.name.value);
        this.helper.builder.store(value, alloca);

        this.scopes[this.scopes.length - 1][varName] = { value: alloca, isPointer: true };
        return null;
    }

    private genExpression(expr: Expression, expectedType?: Type | null): Value | null {
        const tbl: { [key in ExpressionType]?: (expr: any, expectedType?: Type | null) => Value | null } = {
            NumberLiteral: (expr, expectedType) => {
                // Use float if expected, otherwise int32
                const t = expectedType ?? Type.int32(this.helper.ctx);
                if (t.isFloat()) {
                    return Value.constFloat(t, expr.value);
                }
                if (!Number.isInteger(expr.value)) {
                    throw new Error(`can't assign float literal ${expr.value} to integer type`);
                }
                return Value.constInt(t, expr.value);
            },

            BooleanLiteral: (expr, expectedType) => {
                return Value.constInt(Type.int1(this.helper.ctx), expr.value ? 1 : 0);
            },

            Identifier: (expr: any) => {
                const found = [...this.scopes].reverse().find(scope => expr.value in scope);
                if (found) {
                    const entry = found[expr.value];
                    if (entry.isPointer) {
                        return this.helper.builder.load(entry.value);
                    } else {
                        return entry.value;
                    }
                }
                throw new Error(`Undefined variable: ${expr.value}`);
            },

            BinaryExpression: (expr: BinaryExpression, expectedType) => {
                let resultType: Type;
                if (expectedType?.isFloat && expectedType.isFloat()) {
                    resultType = expectedType;
                } else {
                    const leftIsFloatLit = expr.left.type === "NumberLiteral" && !Number.isInteger((expr.left as NumberLiteral).value);
                    const rightIsFloatLit = expr.right.type === "NumberLiteral" && !Number.isInteger((expr.right as NumberLiteral).value);
                    resultType = (leftIsFloatLit || rightIsFloatLit)
                        ? Type.float(this.helper.ctx)
                        : Type.int32(this.helper.ctx);
                }

                const left = this.genExpression(expr.left, resultType);
                const right = this.genExpression(expr.right, resultType);
                if (!left || !right) throw new Error(`failed to generate binary expression: ${expr.operator}`);

                switch (expr.operator) {
                    case "+":
                        return resultType.isFloat()
                            ? this.helper.builder.fadd(left, right)
                            : this.helper.builder.add(left, right);
                    case "-":
                        return resultType.isFloat()
                            ? this.helper.builder.fsub(left, right)
                            : this.helper.builder.sub(left, right);
                    case "*":
                        return resultType.isFloat()
                            ? this.helper.builder.fmul(left, right)
                            : this.helper.builder.mul(left, right);
                    case "/":
                        return resultType.isFloat()
                            ? this.helper.builder.fdiv(left, right)
                            : this.helper.builder.sdiv(left, right);
                    default:
                        throw new Error(`Unknown binary operator: ${expr.operator}`);
                }
            },
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
        if (!type) {
            const available = Object.keys(this.types).join(", ");
            throw new Error(
                `unknown type: '${name}'.\navailable types: [${available}]\n` +
                `this probably meant a type annotation or inference failed.`
            );
        }
        return type;
    }
}