import { BinaryExpression, Expression, ExpressionType, Identifier, NumberLiteral, ReturnExpression } from "../parser/ast"
import { FunctionSymbol, ProgramSymbol, Scope, Symbol, SymbolKind, VariableSymbol } from "./symbols"
import { FloatType, IntType, TypeValue } from "./types"

export class SemanticInferrer {
    program: ProgramSymbol
    scope!: Scope

    symbols: {
        [key in SymbolKind]?: (s: Symbol) => Symbol
    } = {
        function: this.inferFunction.bind(this),
        variable: this.inferVariable.bind(this),
    }

    expressions: {
        [key in ExpressionType]?: (e: Expression) => TypeValue
    } = {
        NumberLiteral: this.inferNumberLiteral.bind(this),
        BooleanLiteral: this.inferBooleanLiteral.bind(this),
        BinaryExpression: this.inferBinaryExpression.bind(this),
        Identifier: this.inferIdentifier.bind(this),
        ReturnExpression: this.inferReturnExpression.bind(this),
    }

    constructor(program: ProgramSymbol) {
        this.program = program
    }

    infer() {
        for (const fn of this.program.functions) {
            this.symbols[fn.kind]?.(fn)
        }

        return this.program
    }

    inferFunction(s: Symbol): Symbol {
        const fn = s as FunctionSymbol

        this.scope = fn.scope

        for (const symbol of fn.scope.symbols.values()) {
            this.symbols[symbol.kind]?.(symbol)
        }

        for (const expression of fn.expression.body) {
            if (expression.type === "ReturnExpression") {
                const type = this.expressions[expression.type]?.(expression)

                if (!type) {
                    throw new Error(`cannot infer return type`)
                }

                if (!fn.returnType.type) fn.returnType.type = type
            }
        }

        this.scope = this.scope.pop()

        return fn
    }

    inferVariable(s: Symbol): Symbol {
        const v = s as VariableSymbol

        if (
            v.expression.type !== "VariableDeclaration" ||
            v.expression.typeAnnotation
        ) return v

        const type = this.expressions[v.expression.value.type]?.(
            v.expression.value
        )

        if (!type) {
            throw new Error(
                `cannot infer type of ${v.expression.value.type}`
            )
        }

        v.typeHolder.type = type

        return v
    }

    inferIdentifier(e: Expression): TypeValue {
        const id = e as Identifier

        const symbol = this.scope.find(id.value)

        if (!symbol) {
            throw new Error(`unknown identifier "${id.value}"`)
        }

        if (symbol.kind !== "variable") {
            throw new Error(`"${id.value}" is not a variable`)
        }

        const variable = symbol as VariableSymbol

        if (!variable.typeHolder.type) {
            throw new Error(`type of "${id.value}" is unresolved`)
        }

        e.inferredType = variable.typeHolder.type
        return variable.typeHolder.type
    }

    inferBinaryExpression(e: Expression): TypeValue {
        const b = e as BinaryExpression

        const left = this.expressions[b.left.type]?.(b.left)
        const right = this.expressions[b.right.type]?.(b.right)

        if (!left || !right) {
            throw new Error(`cannot infer binary expression`)
        }

        if (left.kind !== right.kind) {
            throw new Error(
                `cannot apply "${b.operator}" to ${left.kind} and ${right.kind}`
            )
        }

        let type: TypeValue

        switch (b.operator) {
            case "+":
            case "-":
            case "*":
            case "/":
                type = right
                break

            case "==":
            case "!=":
            case "<":
            case ">":
            case "<=":
            case ">=":
                type = {
                    kind: "bool"
                }
                break

            default:
                throw new Error(`unknown operator "${b.operator}"`)
        }

        e.inferredType = type

        return type
    }

    inferReturnExpression(e: Expression): TypeValue {
        const r = e as ReturnExpression

        const type = this.expressions[r.value.type]?.(r.value)

        if (!type) {
            throw new Error(
                `cannot infer return expression of type ${r.value.type}`
            )
        }

        e.inferredType = type

        return type
    }

    inferNumberLiteral(e: Expression): TypeValue {
        const n = e as NumberLiteral

        const type: TypeValue = Number.isInteger(n.value)
            ? {
                kind: "int",
                size: 32
            } as IntType
            : {
                kind: "float"
            } as FloatType

        e.inferredType = type
        return type
    }

    inferBooleanLiteral(e: Expression): TypeValue {
        const type: TypeValue = {
            kind: "bool"
        }

        e.inferredType = type
        return type
    }
}