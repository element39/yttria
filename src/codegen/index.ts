import { BasicBlock, FunctionType, Linkage, Type, Value } from "bun-llvm";
import { BinaryExpression, Expression, ExpressionType, FunctionCall, FunctionDeclaration, IfExpression, NumberLiteral, ProgramExpression, ReturnExpression, VariableDeclaration } from "../parser/ast";
import { LLVMHelper } from "./helper";

export class Codegen {
    private ast: ProgramExpression;
    private helper: LLVMHelper;
    private scopes: Array<Record<string, { value: Value, isPointer: boolean }>> = [];
    
    private table: { [key in ExpressionType]?: (e: any) => Value | null } = {
        ReturnExpression: this.genReturnExpression.bind(this),
        FunctionCall: this.genFunctionCall.bind(this),
        VariableDeclaration: this.genVariableDeclaration.bind(this),

        IfExpression: this.genIfExpression.bind(this),
    };

    private registerFunctionSignature(expr: FunctionDeclaration): void {
        const fnName = expr.name.value;
        const retTy = this.getType(expr.resolvedReturnType?.name!);
        const paramTypes = expr.params.map(param => this.getType(param.paramType.value));
        const fnType = new FunctionType(paramTypes, retTy, false);

        if (!this.helper.mod.getFunction(fnName)) {
            this.helper.mod.createFunction(fnName, fnType, { linkage: Linkage.External });
        }
    }

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

        const fn = this.helper.mod.getFunction(expr.name.value);
        if (!fn) throw new Error(`Function ${expr.name.value} not found in module during codegen`);

        let entryBlock = (fn as any).blocks?.[0] || fn.addBlock("entry");
        this.helper.builder.insertInto(entryBlock);

        const scope: Record<string, { value: Value, isPointer: boolean }> = {};
        this.scopes.push(scope);

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

    private genFunctionCall(expr: FunctionCall): Value | null {
        const fnName = expr.callee.value;
        const fn = this.helper.mod.getFunction(fnName);
        if (!fn) throw new Error(`function ${fnName} not found`);

        const args = expr.args.map((arg: Expression) => this.genExpression(arg)).filter((v): v is Value => v !== null);
        return this.helper.builder.call(fn, args);
    }

    private genIfExpression(expr: IfExpression): Value | null {
        const block = this.helper.builder.getInsertBlock();
        if (!block || !block.parent) throw new Error("no current block for if expression");

        const condBB = block.parent.addBlock("if_cond");
        const trueBB = block.parent.addBlock("if_true");
        let falseBB: BasicBlock;
        let endBB: BasicBlock | undefined;

        if (expr.alternate) {
            falseBB = block.parent.addBlock("if_false");
            endBB = block.parent.addBlock("if_end");
        } else {
            endBB = block.parent.addBlock("if_end");
            falseBB = endBB;
        }

        this.helper.builder.insertInto(block);
        this.helper.builder.br(condBB);

        this.helper.builder.insertInto(condBB);
        const condition = this.genExpression(expr.condition);
        if (!condition) throw new Error("condition expression must return a value");
        this.helper.builder.condBr(condition, trueBB, falseBB);

        this.helper.builder.insertInto(trueBB);
        let trueReturned = false;
        for (const e of expr.body) {
            if (!(e.type in this.table)) continue;
            if (e.type === "ReturnExpression") trueReturned = true;
            const fnGen = this.table[e.type];
            fnGen && fnGen(e);
        }

        if (!trueReturned) {
            this.helper.builder.br(endBB);
        }

        let falseReturned = false;
        
        if (expr.alternate) {
            this.helper.builder.insertInto(falseBB);

            if (expr.alternate.type === "IfExpression") {
                this.genIfExpression(expr.alternate);
            } else if (expr.alternate.type === "ElseExpression") {
                for (const e of expr.alternate.body) {
                    if (!(e.type in this.table)) continue;
                        
                    if (e.type === "ReturnExpression") falseReturned = true;
                    const fnGen = this.table[e.type];
                    fnGen && fnGen(e);
                }
            }

            if (!falseReturned) {
                this.helper.builder.br(endBB);
            }
        }

        if (endBB && (!trueReturned || !falseReturned)) {
            this.helper.builder.insertInto(endBB);
        } else if (endBB && trueReturned && falseReturned) {
            endBB.erase();
        }

        return null;
    }

    private genExpression(expr: Expression, expectedType?: Type | null): Value | null {
        const tbl: { [key in ExpressionType]?: (expr: any, expectedType?: Type | null) => Value | null } = {
            NumberLiteral: (expr, expectedType) => {
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

                    case "==":
                        return this.helper.builder.icmpEQ(left, right);
                    case "!=":
                        return this.helper.builder.icmpNE(left, right);
                    case "<":
                        return this.helper.builder.icmpSLT(left, right);
                    case "<=":
                        return this.helper.builder.icmpSLE(left, right);
                    case ">":
                        return this.helper.builder.icmpSGT(left, right);
                    case ">=":
                        return this.helper.builder.icmpSGE(left, right);
                    case "&&":
                        const andResult = this.helper.builder.alloca(Type.int1(this.helper.ctx), "and_result");
                        this.helper.builder.store(left, andResult);
                        const andRight = this.helper.builder.load(right);
                        this.helper.builder.store(andRight, andResult);
                        return this.helper.builder.load(andResult);
                    case "||":
                        const orResult = this.helper.builder.alloca(Type.int1(this.helper.ctx), "or_result");
                        this.helper.builder.store(left, orResult);
                        const orRight = this.helper.builder.load(right);
                        this.helper.builder.store(orRight, orResult);
                        return this.helper.builder.load(orResult);
                    default:
                        throw new Error(`Unknown binary operator: ${expr.operator}`);
                }
            },
        };

        const visitor = tbl[expr.type];
        if (!visitor) {
            if (expr.type in this.table) {
                const gen = this.table[expr.type];
                return gen ? gen(expr) : null;
            }

            throw new Error(`genExpression: Unhandled expression type: ${expr.type}`);
        }
        const res = visitor(expr, expectedType);
        return res;
    }

    generate() {
        for (const expr of this.ast.body) {
            if (expr.type === "FunctionDeclaration") {
                this.registerFunctionSignature(expr as FunctionDeclaration);
            }
        }

        for (const expr of this.ast.body) {
            if (expr.type === "FunctionDeclaration") {
                this.genFunctionDeclaration(expr as FunctionDeclaration);
            } else if (expr.type in this.table) {
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