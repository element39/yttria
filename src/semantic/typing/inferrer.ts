import { ExpressionType, Expression, Identifier, BinaryExpression } from "../../parser/ast";
import { ProgramSymbol, Scope, VariableSymbol } from "../analyser/symbols";
import { BoolType, IntType, TypeValue } from "../analyser/types";

export class TypeInferrer {
    program: ProgramSymbol

    table: { [key in ExpressionType]?: (e: Expression, scope: Scope) => TypeValue | undefined } = {
        NumberLiteral: this.inferNumberLiteral.bind(this),
        BooleanLiteral: this.inferBooleanLiteral.bind(this),
        Identifier: this.inferIdentifier.bind(this),
        BinaryExpression: this.inferBinaryExpression.bind(this)
    }

    constructor(program: ProgramSymbol) {
        this.program = program
    }

    infer() {
        for (const fn of this.program.functions) {
            this.inferScope(fn.scope)
        }

        return this.program
    }

    inferScope(scope: Scope) {
        for (const variable of scope.symbols.values()) {
            this.inferVariable(variable, scope)
        }

        for (const child of scope.children) {
            this.inferScope(child)
        }
    }

    inferVariable(variable: VariableSymbol, scope: Scope) {
        if (variable.slot.type)
            return

        variable.slot.type = this.inferExpression(variable.expression.value, scope)
    }

    inferExpression(e: Expression, scope: Scope): TypeValue | undefined {
        return this.table[e.type]?.(e, scope)
    }

    inferNumberLiteral(e: Expression, scope: Scope): TypeValue {
        return {
            kind: "int",
            size: 32
        } as IntType
    }

    inferBooleanLiteral(e: Expression, scope: Scope): TypeValue {
        return {
            kind: "bool"
        } as BoolType
    }

    inferIdentifier(e: Expression, scope: Scope): TypeValue | undefined {
        const i = e as Identifier

        const variable = scope.find(i.value)
        if (!variable)
            throw new Error("unknown variable '" + i.value + "'")

        if (!variable.slot.type)
            this.inferVariable(variable, scope)

        return variable.slot.type
    }

    inferBinaryExpression(e: Expression, scope: Scope): TypeValue | undefined {
        const b = e as BinaryExpression

        const left = this.inferExpression(b.left, scope)
        const right = this.inferExpression(b.right, scope)

        if (!left || !right)
            return

        switch (b.operator) {
            case "+":
            case "-":
            case "*":
            case "/":
                if (left.kind !== right.kind)
                    throw new Error(`type mismatch, cannot '${b.operator}' on '${left.kind}' and '${right.kind}'`)

                return left
        }
    }
}