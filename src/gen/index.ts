import { Func, FunctionType, Module, Type, Value } from "../bindings";
import { BinaryExpression, Expression, ExpressionType, FunctionDeclaration, NumberLiteral, ProgramExpression, ReturnExpression } from "../parser/ast";
import { LLVMHelper } from "./helper";

export class Codegen {
    private h: LLVMHelper;
    private ast: ProgramExpression;

    private table: { [key in ExpressionType]?: (e: any) => Func | Value | void } = {
        FunctionDeclaration: this.genFunctionDeclaration.bind(this),
        ReturnExpression: this.genReturnExpression.bind(this),
        BinaryExpression: this.getBinaryExpression.bind(this),
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

    private genReturnExpression(r: ReturnExpression): void {
        const v = this.getValueFromExpression(r.value);
        if (!v) {
            throw new Error(`Unsupported return expression type: ${r.value.type}`);
        }

        this.h.ret(
            v
        )
    }

    private getBinaryExpression(b: BinaryExpression): Value | void {
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
                return this.getBinaryExpression(e) as Value;
            }
        }

        return null;
    }
}