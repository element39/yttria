import vm from "llvm-bindings";
import { Codegen } from "..";
import { BinaryExpression, Expression, ExpressionType, FunctionDeclaration, Identifier, IfExpression, NumberLiteral, ReturnExpression, VariableDeclaration } from "../../parser/ast";
import { LLVMHelper } from "./helper";

export class LLVMGen extends Codegen {
    helper: LLVMHelper = new LLVMHelper();

    scope: Record<string, vm.Value>[] = [{}];

    table: { [key in ExpressionType]?: (expr: any) => vm.Function | vm.Value } = {
        FunctionDeclaration: this.genFunctionDeclaration.bind(this),
        ReturnExpression: this.genReturnExpression.bind(this),
        VariableDeclaration: this.genVariableDeclaration.bind(this),
        IfExpression: this.genIfExpression.bind(this),
    }

    types: { [key: string]: vm.Type } = {
        "int": vm.Type.getInt32Ty(this.helper.context),
        "void": vm.Type.getVoidTy(this.helper.context),
    };
    
    private pushScope() {
        this.scope.push({});
    }

    private popScope() {
        this.scope.pop();
    }

    setVariable(name: string, ptr: vm.Value) {
        this.scope[this.scope.length - 1][name] = ptr;
    }

    getVariable(name: string): vm.Value | undefined {
        for (let i = this.scope.length - 1; i >= 0; i--) {
            if (name in this.scope[i]) {
                return this.scope[i][name];
            }
        }
        return undefined;
    }

    generate(): string {
        for (const expr of this.ast.body) {
            if (expr.type in this.table) {
                const fn = this.table[expr.type];
                fn && fn(expr);
            }
        }
        return this.helper.print();
    }

    genExpression(expr: Expression): vm.Value | null {
        switch (expr.type) {
            case "NumberLiteral":
                const n = expr as NumberLiteral;
                return this.helper.builder.getInt32(n.value);
            case "Identifier":
                const name = (expr as Identifier).value;
                const ptr = this.getVariable(name);
                if (!ptr) throw new Error(`Variable "${name}" not found`);
                return this.helper.builder.CreateLoad(ptr.getType().getPointerElementType(), ptr, name);
            case "BinaryExpression":
                const b = expr as BinaryExpression;
                const left = this.genExpression(b.left);
                const right = this.genExpression(b.right);
                if (!left || !right) {
                    throw new Error("Invalid binary expression operands");
                }
                switch (b.operator) {
                    case "+":
                        return this.helper.builder.CreateAdd(left, right);
                    case "-":
                        return this.helper.builder.CreateSub(left, right);
                    case "*":
                        return this.helper.builder.CreateMul(left, right);
                    case "/":
                        return this.helper.builder.CreateSDiv(left, right);
                    case "%":
                        return this.helper.builder.CreateSRem(left, right);

                    case ">":
                        return this.helper.builder.CreateICmpSGT(left, right, "gt");
                    case "<":
                        return this.helper.builder.CreateICmpSLT(left, right, "lt");
                    case ">=":
                        return this.helper.builder.CreateICmpSGE(left, right, "ge");
                    case "<=":
                        return this.helper.builder.CreateICmpSLE(left, right, "le");
                    case "==":
                        return this.helper.builder.CreateICmpEQ(left, right, "eq");
                    case "!=":
                        return this.helper.builder.CreateICmpNE(left, right, "ne");
                    case "&&":
                        const and = this.helper.builder.CreateAnd(left, right, "and");
                        return this.helper.builder.CreateICmpNE(and, this.helper.builder.getInt32(0), "and_result");
                    case "||":
                        const or = this.helper.builder.CreateOr(left, right, "or");
                        return this.helper.builder.CreateICmpNE(or, this.helper.builder.getInt32(0), "or_result");
                    // case "^^":
                    //     const xor = this.helper.builder.CreateXor(left, right, "xor");
                    //     return this.helper.builder.CreateICmpNE(xor, this.helper.builder.getInt32(0), "xor_result");
                    default:
                        throw new Error(`Unknown binary operator: ${b.operator}`);
                }
        }
        return null;
    }

    genFunctionDeclaration(expr: FunctionDeclaration): vm.Function {
        const name = expr.name.value;
        const ty = expr.returnType?.value || expr.resolvedReturnType?.type;
        if (!ty || !(ty in this.types)) {
            throw new Error(`Unknown return type: ${ty}`);
        }
        const returnType = this.types[ty];
        const fn = this.helper.fn(
            name,
            returnType,
            "internal"
        );

        this.pushScope();

        // TODO: handle function parameters here

        this.helper.block("entry", () => {
            let returned = false;

            for (const e of expr.body) {
                if (e.type in this.table) {
                    if (e.type === "ReturnExpression") returned = true;
                    const fnGen = this.table[e.type];
                    fnGen && fnGen(e);
                }
            }

            if (!returned && returnType.isVoidTy()) {
                this.helper.builder.CreateRetVoid();
            }
        });

        this.popScope();

        this.helper.verify(fn);
        return fn;
    }

    genReturnExpression(expr: ReturnExpression): vm.Function {
        if (!this.helper.currentFunction) {
            throw new Error("No current function set for return expression");
        }
        const value = this.genExpression(expr.value);
        if (this.helper.currentFunction.getReturnType().isVoidTy()) {
            this.helper.builder.CreateRetVoid();
            return this.helper.currentFunction;
        }
        if (!value) {
            throw new Error(`return expression type unhandled, got ${expr.value.type}`);
        }
        this.helper.builder.CreateRet(value);
        return this.helper.currentFunction;
    }

    genVariableDeclaration(expr: VariableDeclaration): vm.Value {
        const name = expr.name.value;
        const ty = expr.typeAnnotation?.value ?? expr.resolvedType?.type;

        if (!ty || !(ty in this.types)) {
            throw new Error(`unknown variable type: ${ty}`);
        }
        const type = this.types[ty];
        const alloca = this.helper.alloc(name, type);
        const value = this.genExpression(expr.value);
        if (value) {
            this.helper.store(alloca, value);
        }
        this.setVariable(name, alloca);
        return alloca;
    }

    genIfExpression(expr: IfExpression) {
        
    }
}