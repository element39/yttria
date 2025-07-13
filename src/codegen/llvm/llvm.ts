import vm from "llvm-bindings";
import { Codegen } from "..";
import { ExpressionType, FunctionDeclaration } from "../../parser/ast";
import { LLVMHelper } from "./helper";

export class LLVMGen extends Codegen {
    helper: LLVMHelper = new LLVMHelper();

    table: { [key in ExpressionType]?: (expr: any) => vm.Function } = {
        FunctionDeclaration: this.genFunctionDeclaration.bind(this),
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

    genFunctionDeclaration(expr: FunctionDeclaration): vm.Function {
        const name = expr.name.value;
        const fn = name === "main"
            ? this.helper.fn({ name, linkage: "external" })
            : this.helper.fn({ name });

        this.helper.verify(fn);
        
        return fn;
    }
}