import { ExpressionType, Expression, Identifier, BinaryExpression, NumberLiteral } from "../../parser/ast";
import { ProgramSymbol, Scope, VariableSymbol } from "../analyser/symbols";
import { createEmptySlot, IntType, TypeSlot, TypeValue } from "../analyser/types";

export class TypeResolver {
    program: ProgramSymbol
    table: { [key in ExpressionType]?: (e: Expression, scope: Scope) => TypeValue | undefined } = {
        NumberLiteral: this.resolveNumberLiteral.bind(this),
        Identifier: this.resolveIdentifier.bind(this),
        BinaryExpression: this.resolveBinaryExpression.bind(this)
    }

    constructor(program: ProgramSymbol) {
        this.program = program
    }

    resolve() {
        for (const fn of this.program.functions) {
            this.resolveScope(fn.scope)
        }

        return this.program
    }

    resolveScope(scope: Scope) {
        for (const variable of scope.variables.values()) {
            this.resolveVariable(variable, scope)
        }

        for (const child of scope.children) {
            this.resolveScope(child)
        }
    }

    resolveVariable(variable: VariableSymbol, scope: Scope) {
        if (variable.slot.type)  return

        variable.slot.type = this.resolveExpression(
            variable.expression.value,
            scope
        )
    }

    resolveExpression(e: Expression, scope: Scope): TypeValue | undefined {
        return this.table[e.type]?.(e, scope)
    }

    resolveNumberLiteral(e: Expression, scope: Scope): TypeValue {
        return {
            kind: "int",
            size: 32
        } as IntType
    }

    resolveIdentifier(e: Expression, scope: Scope): TypeValue | undefined {
        const i = e as Identifier
        const variable = scope.find(i.value)

        if (!variable) throw new Error(`unknown variable '${i.value}'`)
        if (!variable.slot.type) this.resolveVariable(variable, scope)
        return variable.slot.type
    }

    resolveBinaryExpression(e: Expression, scope: Scope): TypeValue | undefined {
        const b = e as BinaryExpression

        const left = this.resolveExpression(b.left, scope)
        const right = this.resolveExpression(b.right, scope)
        if (!left || !right) return

        switch (b.operator) {
            case "+":
            case "-":
            case "*":
            case "/":
                if (left.kind === "int" && right.kind === "int") {
                    return {
                        kind: "int",
                        size: 32
                    } as IntType
                }

                return {
                    kind: "float"
                }
        }
    }
}