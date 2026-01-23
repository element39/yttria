import { Func, FunctionType, Module, Type, Value } from "../bindings";
import { BinaryExpression, Expression, ExpressionType, FunctionDeclaration, Identifier, NumberLiteral, ProgramExpression, ReturnExpression, VariableDeclaration } from "../parser/ast";
import { LLVMHelper } from "./helper";

export class Codegen {
    private h: LLVMHelper;
    private ast: ProgramExpression;

    private table: { [key in ExpressionType]?: (e: any) => Func | Value | void } = {
        FunctionDeclaration: this.genFunctionDeclaration.bind(this),
        ReturnExpression: this.genReturnExpression.bind(this),
        BinaryExpression: this.genBinaryExpression.bind(this),
        VariableDeclaration: this.genVariableDeclaration.bind(this) 
    };

    private variables: { [name: string]: { ptr: Value; type: Type; value?: Value } } = {};

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

    private genReturnExpression(r: ReturnExpression): void {
        const v = this.getValueFromExpression(r.value);
        if (!v) {
            throw new Error(`Unsupported return expression type: ${r.value.type}`);
        }

        this.h.ret(
            v
        )
    }

    private genBinaryExpression(b: BinaryExpression): Value | void {
        const left = this.getValueFromExpression(b.left);
        const right = this.getValueFromExpression(b.right);

        if (!left || !right) {
            throw new Error(`Unsupported binary expression operands: ${b.left.type}, ${b.right.type}`);
        }
        
        let val: Value = (() => {
            switch (b.operator) {
                case "+":
                    return this.h.add(left, right);
                case "-":
                    return this.h.sub(left, right);
                case "*":
                    return this.h.mul(left, right);
                case "/":
                    return this.h.div(left, right);
                default:
                    throw new Error(`Unsupported binary operator: ${b.operator}`);
            }
        })();

        return val;
    }

    private genVariableDeclaration(v: VariableDeclaration): void {
        const val = this.getValueFromExpression(v.value);
        if (!val) {
            throw new Error(`Unsupported variable declaration value type: ${v.value.type}`);
        }

        const ptr = this.h.alloca(val.getType(), v.name.value)
        this.h.store(val, ptr);
        this.variables[v.name.value] = { ptr, type: val.getType(), value: val };
    }

    private getTypeFromExpression(e: Expression): Type | null {
        switch (e.type) {
            case "NumberLiteral":
                return Type.int32(this.h.ctx);
        }

        return null;
    }

    private getValueFromExpression(expr: Expression): Value | null {
        switch (expr.type) {
            case "NumberLiteral": {
                const e = expr as NumberLiteral;
                return Value.constInt(Type.int32(this.h.ctx), e.value);
            }

            case "BinaryExpression": {
                const e = expr as BinaryExpression;
                return this.genBinaryExpression(e) as Value;
            }

            case "Identifier": {
                const e = expr as Identifier;
                const obj = this.variables[e.value];
                if (!obj) {
                    throw new Error(`Undefined variable: ${e.value}`);
                }
                // if cached 
                if (obj.value) return obj.value;
                return this.h.load(obj.type, obj.ptr, e.value);
            }
        }

        return null;
    }
}