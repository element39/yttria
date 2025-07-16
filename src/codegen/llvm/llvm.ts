import vm from "llvm-bindings";
import { Codegen } from "..";
import { Expression, ExpressionType, FunctionDeclaration, NumberLiteral, ReturnExpression } from "../../parser/ast";
import { LLVMHelper } from "./helper";

export class LLVMGen extends Codegen {
    helper: LLVMHelper = new LLVMHelper();

    table: { [key in ExpressionType]?: (expr: any) => vm.Function } = {
        FunctionDeclaration: this.genFunctionDeclaration.bind(this),
        ReturnExpression: this.genReturnExpression.bind(this),
    }

    types: { [key: string]: vm.Type } = {
        "int": vm.Type.getInt32Ty(this.helper.context),
        "void": vm.Type.getVoidTy(this.helper.context),
    };
    
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
            case "NumberLiteral": {
                const n = expr as NumberLiteral;
                return this.helper.builder.getInt32(n.value);
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

        const block = this.helper.block("entry", () => {
            for (const e of expr.body) {
                if (e.type in this.table) {
                    const fnGen = this.table[e.type];
                    fnGen && fnGen(e);
                }
            }
        });

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
            throw new Error("Return expression value is not valid");
        }

        this.helper.builder.CreateRet(value);
        return this.helper.currentFunction;
    }
}