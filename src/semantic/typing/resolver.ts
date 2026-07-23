import { ExpressionType, Expression, Identifier, BinaryExpression, NumberLiteral, MemberAccess } from "../../parser/ast";
import { FunctionSymbol, ModuleSymbol, ProgramSymbol, Scope, Symbol, VariableSymbol } from "../analyser/symbols";
import { BoolType, createEmptySlot, IntType, TypeSlot, TypeValue } from "../analyser/types";

export class TypeResolver {
    program: ProgramSymbol
    table: { [key in ExpressionType]?: (e: Expression, scope: Scope) => TypeValue | undefined } = {
        NumberLiteral: this.resolveNumberLiteral.bind(this),
        BooleanLiteral: this.resolveBooleanLiteral.bind(this),
        Identifier: this.resolveIdentifier.bind(this),
        BinaryExpression: this.resolveBinaryExpression.bind(this),
        MemberAccess: this.resolveMemberAccess.bind(this)
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
        for (const symbol of scope.symbols.values()) {
           switch (symbol.kind) {
                case "variable": {
                    const variable = symbol as VariableSymbol
                    this.resolveVariable(variable, scope)
                }
           }
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

    resolveBooleanLiteral(e: Expression, scope: Scope): TypeValue {
        return {
            kind: "bool"
        } as BoolType
    }

    resolveIdentifier(e: Expression, scope: Scope): TypeValue | undefined {
        const symbol = this.resolveSymbol(e, scope)

        if (!symbol)
            throw new Error("unknown symbol")

        switch (symbol.kind) {
            case "variable": {
                const variable = symbol as VariableSymbol

                if (!variable.slot.type)
                    this.resolveVariable(variable, scope)

                return variable.slot.type
            }
        }
    }

    resolveSymbol(e: Expression, scope: Scope): Symbol | undefined {
        switch (e.type) {
            case "Identifier": {
                const i = e as Identifier
                return scope.find(i.value)
            }

            case "MemberAccess": {
                return this.resolveMemberAccessSymbol(
                    e as MemberAccess,
                    scope
                )
            }
        }
    }

    resolveMemberAccess(
        e: Expression,
        scope: Scope
    ): TypeValue | undefined {

        const symbol = this.resolveSymbol(e, scope)

        if (!symbol)
            return

        switch (symbol.kind) {

            case "variable":
                return (symbol as VariableSymbol).slot.type

            case "function":
                return (symbol as FunctionSymbol).returnType.type
        }
    }

    resolveMemberAccessSymbol(
        e: MemberAccess,
        scope: Scope
    ): Symbol {

        const object = this.resolveSymbol(e.object, scope)

        if (!object) throw new Error("unknown object")

        switch (object.kind) {
            case "module": {
                const module = object as ModuleSymbol
                const property = e.property as Identifier
                const symbol = module.exports.get(property.value)

                if (!symbol)
                    throw new Error(
                        `'${module.name}' has no member '${property.value}'`
                    )

                return symbol
            }

            default:
                throw new Error(
                    `'${object.name}' has no members`
                )
        }
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