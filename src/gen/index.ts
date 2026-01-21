import { Func, FunctionType, Module, Type, Value } from "../bindings";
import { ExpressionType, FunctionDeclaration, ProgramExpression, ReturnExpression } from "../parser/ast";
import { LLVMHelper } from "./helper";

export class Codegen {
    private h: LLVMHelper;
    private ast: ProgramExpression;

    private table: { [key in ExpressionType]?: (e: any) => Func | Value | void } = {
        FunctionDeclaration: this.genFunctionDeclaration.bind(this),
        ReturnExpression: this.genReturnExpression.bind(this),
    };

    constructor(moduleName: string, ast: ProgramExpression) {
        this.h = new LLVMHelper(moduleName);
        this.ast = ast;
    }

    public generate(): string {
        for (const expr of this.ast.body) {
            this.table[expr.type]?.(expr);
        }

        return this.h.toString();
    }

    private genFunctionDeclaration(f: FunctionDeclaration): Func {
        const fn = this.h.fn(
            f.name.value,
            new FunctionType(
                f.params.map(_ => Type.int32(this.h.ctx)),
                Type.int32(this.h.ctx)
            )
        );
        
        for (const expr of f.body) {
            this.table[expr.type]?.(expr);
        }
        
        return fn;
    }

    private genReturnExpression(r: ReturnExpression): Value | void {
        this.h.ret(
            Value.constInt(Type.int32(this.h.ctx), 2)
        )
    }
}