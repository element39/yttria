import { BasicBlock, Func, FunctionType, Linkage, Type, Value } from "../bindings";
import { ResolvedModule } from "../module/types";
import { BinaryExpression, Expression, ExpressionType, FunctionCall, FunctionDeclaration, Identifier, IfExpression, MemberAccess, NumberLiteral, ProgramExpression, ReturnExpression, StringLiteral, SwitchExpression, VariableDeclaration } from "../parser/ast";
import { CheckerType, CheckerPlaceholder } from "../typing/types";
import { LLVMHelper } from "./helper";

export class Codegen {
    private name: string;
    private ast: ProgramExpression;
    private helper: LLVMHelper;

    private alias: string;
    private modules: { [key: string]: ResolvedModule };
    private voidCalls: Set<string> = new Set();
    private scopes: Array<Record<string, { value: Value, isPointer: boolean }>> = [];
    
    private table: { [key in ExpressionType]?: (e: any) => Func | Value | void } = {
        FunctionDeclaration: this.genFunctionDeclaration.bind(this),
        ReturnExpression: this.genReturnExpression.bind(this),
    };

    types: { [key: string]: Type }

    constructor(
        name: string,
        ast: ProgramExpression,
        modules: { [key: string]: ResolvedModule }
    ) {
        this.name = name;
        this.alias = name === "main" ? "" : name.split("/").pop()!;
        this.ast = ast;
        this.helper = new LLVMHelper(name);
        this.modules = modules;

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

    private getType(name: string): Type | null {
        return this.types[name] ?? null;
    }

    public generate(): string {
        for (const expr of this.ast.body) {
            this.table[expr.type]?.(expr);
        }
        
        this.helper.mod.verify();
        return this.helper.toString();
    }

    private genFunctionDeclaration(expr: FunctionDeclaration): Func {
        if (!expr.resolvedReturnType || expr.resolvedReturnType.type === "CheckerPlaceholder") {
            throw new Error(`function ${expr.name.value} has unresolved return type`);
        }

        const ret = expr.returnType ? this.getType(expr.resolvedReturnType.value) : this.types["void"]
        if (!ret) {
            throw new Error(`function ${expr.name} has invalid return type`);
        }

        const params = expr.params.map(param => {
            const typeName = param.paramType.value;
            const type = this.getType(typeName) ?? this.types["void"];
            if (!type) {
                throw new Error(`function ${expr.name.value} has invalid parameter type for ${param.name.value}`);
            }
            return type;
        });

        const fn = this.helper.fn(
            expr.name.value,
            new FunctionType(params, ret, false), // TODO: varargs
            {
                linkage: (this.name === "main" && expr.name.value === "main")
                    ? Linkage.External
                    : (expr.modifiers.includes("extern") || expr.modifiers.includes("pub") ? Linkage.External : Linkage.Internal),
                extern: expr.modifiers.includes("extern"),
            }
        )

        if (expr.modifiers.includes("extern")) return fn;

        for (const e of expr.body) {
            this.table[e.type]?.(e);
        }

        return fn;
    }

    private genReturnExpression(expr: ReturnExpression): void {
        const value = this.getValueFromExpression(expr.value);
        if (!value) {
            throw new Error(`return expression has invalid type`);
        }

        if (!(value instanceof Value)) {
            throw new Error(`return expression is not a value`);
        }

        this.helper.ret(value);
    }

    private getTypeFromExpression(expr: Expression): Type | null {
        switch (expr.type) {
            case "NumberLiteral":
                return Type.int32(this.helper.ctx);
        }

        return null;
    }

    private getValueFromExpression(expr: Expression): Value | null {
        switch (expr.type) {
            case "NumberLiteral": {
                const e = expr as NumberLiteral;
                return Value.constInt(Type.int32(this.helper.ctx), e.value);
            }
            case "StringLiteral": {
                const e = expr as StringLiteral;
                return this.helper.mod.addGlobalString(e.value, `${this.alias}_${e.value}`);
            }
        }

        return null;
    }
}