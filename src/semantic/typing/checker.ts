import { ExpressionType, Expression, Identifier, BinaryExpression } from "../../parser/ast"
import { ProgramSymbol, Scope, VariableSymbol } from "../analyser/symbols"
import { BoolType, IntType, TypeValue } from "../analyser/types"

export class TypeChecker {
    program: ProgramSymbol
    table: { [key in ExpressionType]?: (e: Expression, scope: Scope) => TypeValue | undefined } = {
        NumberLiteral: this.checkNumberLiteral.bind(this),
        BooleanLiteral: this.checkBooleanLiteral.bind(this),
        Identifier: this.checkIdentifier.bind(this),
        BinaryExpression: this.checkBinaryExpression.bind(this)
    }

    constructor(program: ProgramSymbol) {
        this.program = program
    }

    check() {
        for (const fn of this.program.functions) {
            this.checkScope(fn.scope)
        }
        return this.program
    }

    checkScope(scope: Scope) {
        for (const symbol of scope.symbols.values()) {
           switch (symbol.kind) {
                case "variable": {
                    const variable = symbol as VariableSymbol
                    this.checkVariable(variable, scope)
                }
            }
        }

        for (const child of scope.children) {
            this.checkScope(child)
        }
    }

    checkVariable(variable: VariableSymbol, scope: Scope) {
        if (!variable.slot.type) throw new Error(`variable '${variable.name}' has no type`)

        const inferredType = this.checkExpression(variable.expression.value, scope)
        if (!inferredType) throw new Error(`could not infer type for variable '${variable.name}'`)

        if (inferredType.kind !== variable.slot.type.kind) {
            throw new Error(`type mismatch for variable '${variable.name}', expected '${variable.slot.type.kind}' but got '${inferredType.kind}'`)
        }
    }

    checkExpression(e: Expression, scope: Scope): TypeValue | undefined {
        return this.table[e.type]?.(e, scope)
    }

    checkNumberLiteral(e: Expression, scope: Scope): TypeValue {
        return {
            kind: "int",
            size: 32
        } as IntType
    }

    checkBooleanLiteral(e: Expression, scope: Scope): TypeValue {
        return {
            kind: "bool"
        } as BoolType
    }

    checkIdentifier(e: Expression, scope: Scope): TypeValue | undefined {
        const i = e as Identifier
        // const variable = scope.find(i.value)

        // if (!variable) throw new Error(`unknown variable '${i.value}'`)
        // if (!variable.slot.type) throw new Error(`variable '${i.value}' has no type`)

        // return variable.slot.type

        const symbol = scope.find(i.value)
        if (!symbol) throw new Error(`unknown symbol '${i.value}'`)

        switch (symbol.kind) {
            case "variable": {
                const variable = symbol as VariableSymbol
                if (!variable.slot.type) throw new Error(`variable '${i.value}' has no type`)
                return variable.slot.type
            }
        }

        return undefined
    }

    checkBinaryExpression(e: Expression, scope: Scope): TypeValue | undefined {
        const b = e as BinaryExpression

        const left = this.checkExpression(b.left, scope)
        const right = this.checkExpression(b.right, scope)

        if (!left || !right) return

        if (left.kind !== right.kind) {
            throw new Error(`type mismatch, cannot '${b.operator}' on '${left.kind}' and '${right.kind}'`)
        }

        return left
    }
}