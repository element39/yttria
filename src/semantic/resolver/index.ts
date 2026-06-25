import { BinaryExpression, Expression, Identifier } from "../../parser/ast"
import { ModuleSymbol, Scope, VariableSymbol } from "../typing/symbols"
import { createEmptySlot, IntType, TypeSlot } from "../typing/types"

export class SemanticResolver {
    constructor(private mod: ModuleSymbol) {}

    resolve() {
        for (const fn of this.mod.functions) {
            for (const v of fn.variables) {
                this.resolveVariable(v)
            }
        }

        return this.mod
    }

    resolveVariable(v: VariableSymbol) {
        if (v.type.type) return

        for (const source of v.type.links) {
            this.propagate(v.type, source)
        }
    }

    resolveExpression(expr: Expression, scope: Scope): TypeSlot |undefined {
        switch (expr.type) {
            case "NumberLiteral": {
                const slot = createEmptySlot()
                slot.type = {
                    kind: "int",
                    size: 32
                } as IntType

                return slot
            }

            case "Identifier": {
                const v = scope.lookup((expr as Identifier).value)
                if (!v) throw new Error(`Variable not found: ${ (expr as Identifier).value }`)
                return v.type
            }

            case "BinaryExpression": {
                const left = this.resolveExpression((expr as BinaryExpression).left, scope)
                const right = this.resolveExpression((expr as BinaryExpression).right, scope)
                if (!left || !right) throw new Error(`Failed to resolve binary expression: ${JSON.stringify(expr)}`)
                
                    left.links.push(right)
                return left
            }
        }
    }

    propagate(target: TypeSlot, source: TypeSlot) {
        if (source.type) {
            target.type = source.type
            return
        }

        for (const s of source.links) {
            this.propagate(target, s)
        }
    }
}