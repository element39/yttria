import { FunctionType, Linkage, Type, Value } from "bun-llvm";
import { ExpressionType, FunctionDeclaration, ProgramExpression, ReturnExpression } from "../parser/ast";
import { LLVMHelper } from "./helper";

export class Codegen {
    private ast: ProgramExpression;
    private helper: LLVMHelper;
    
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

    private genFunctionDeclaration(expr: FunctionDeclaration): Value | null {
        const fn = this.helper.fn(
            expr.name.value,
            new FunctionType([], Type.int32(this.helper.ctx), false),
            { linkage: (expr.modifiers.includes("pub") || expr.modifiers.includes("extern")) ? Linkage.External : Linkage.Internal }
        )

        for (const e of expr.body) {
            if (e.type in this.table) {
                const gen = this.table[e.type];
                gen && gen(e);
            }
        }

        return null;
    }

    private genReturnExpression(expr: ReturnExpression): Value | null {
        this.helper.builder.ret(Value.constInt(Type.int32(this.helper.ctx), 3));
        return null;
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
}