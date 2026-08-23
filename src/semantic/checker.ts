import { Expression, ExpressionType, ReturnExpression } from "../parser/ast"
import { FunctionSymbol, ModuleSymbol, ProgramSymbol } from "./symbols"
import { TypeValue } from "./types"

export class SemanticChecker {
    inferredModules: Map<string, ModuleSymbol>

    expressions: { [key in ExpressionType]?: (e: Expression, expected?: TypeValue) => void } = {
        ReturnExpression: this.checkReturnExpression.bind(this),
    }

    constructor(inferredModules: Map<string, ModuleSymbol>) {
        this.inferredModules = inferredModules
    }

    check(): Map<string, ModuleSymbol> {
        for (const module of this.inferredModules.values()) {
            for (const program of module.programs) {
                this.checkProgram(program)
            }
        }
        return this.inferredModules
    }

    checkProgram(program: ProgramSymbol): ProgramSymbol {
        for (const fn of program.functions) {
            this.checkFunction(fn)
        }

        return program
    }

    checkFunction(fn: FunctionSymbol): void {
        const returnType = fn.returnType.type

        if (!returnType) {
            throw new Error(
                `return type of "${fn.name}" is unresolved`
            )
        }

        for (const expression of fn.expression.body) {
            this.expressions[expression.type]?.(
                expression,
                returnType
            )
        }
    }

    checkReturnExpression(
        e: Expression,
        expected?: TypeValue
    ): void {
        const r = e as ReturnExpression

        if (!expected) {
            throw new Error(`return type is unresolved`)
        }

        if (!r.inferredType) {
            throw new Error(`return expression type is unresolved`)
        }

        if (r.inferredType.kind !== expected.kind) {
            throw new Error(
                `function expects ${expected.kind}, but returned ${r.inferredType.kind}`
            )
        }
    }
}