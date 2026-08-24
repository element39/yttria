import { Expression, ExpressionType, FunctionCall, Identifier, MemberAccess, NumberLiteral, ReturnExpression, VariableAssignment, VariableDeclaration } from "../parser/ast"
import { FunctionSymbol, ModuleSymbol, ProgramSymbol, SemanticScope, VariableSymbol } from "./symbols"
import { IntType, TypeValue } from "./types"

export class SemanticChecker {
    inferredModules: Map<string, ModuleSymbol>

    scope?: SemanticScope
    returnType?: TypeValue

    expressions: {
        [key in ExpressionType]?: (e: Expression) => void
    } = {
        ReturnExpression: this.checkReturnExpression.bind(this),
        VariableDeclaration: this.checkVariableDeclaration.bind(this),
        VariableAssignment: this.checkVariableAssignment.bind(this),
        FunctionCall: this.checkFunctionCall.bind(this)
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
        this.returnType = fn.returnType.type
        this.scope = fn.scope

        if (!this.returnType) {
            throw new Error(
                `return type of "${fn.name}" is unresolved`
            )
        }

        for (const expression of fn.expression.body) {
            this.expressions[expression.type]?.(expression)
        }

        this.scope = undefined
        this.returnType = undefined
    }

    checkReturnExpression(e: Expression): void {
        const r = e as ReturnExpression

        if (!this.returnType) {
            throw new Error(
                `return type is unresolved`
            )
        }

        if (!r.inferredType) {
            throw new Error(
                `return expression type is unresolved`
            )
        }

        if (!this.equals(r.inferredType, this.returnType)) {
            const expected =
                this.returnType.kind === "int"
                    ? `i${this.returnType.size ?? 32}`
                    : this.returnType.kind

            const actual =
                r.inferredType.kind === "int"
                    ? `i${r.inferredType.size ?? 32}`
                    : r.inferredType.kind

            throw new Error(
                `function expects ${expected}, but returned ${actual}`
            )
        }
    }

    checkVariableDeclaration(e: Expression): void {
        const v = e as VariableDeclaration

        if (!v.typeAnnotation) {
            return
        }

        if (!v.value.inferredType) {
            throw new Error(
                `type of "${v.name.value}" is unresolved`
            )
        }

        const actual = v.value.inferredType
        const expected = v.typeAnnotation.value

        if (
            v.value.type === "NumberLiteral" &&
            actual.kind === "int" &&
            (actual as IntType).size === undefined &&
            expected.startsWith("i")
        ) {
            const size = Number(expected.slice(1))
            const value = (v.value as NumberLiteral).value

            const min = -(2 ** (size - 1))
            const max = 2 ** (size - 1) - 1

            if (value < min || value > max) {
                throw new Error(
                    `integer literal ${value} does not fit in ${expected}`
                )
            }

            v.value.inferredType = {
                kind: "int",
                size,
            } as IntType

            return
        }

        if (actual.kind !== expected) {
            throw new Error(
                `"${v.name.value}" expects ${expected}, but got ${actual.kind}`
            )
        }
    }

    checkFunctionCall(e: Expression): void {
        const f = e as FunctionCall

        let fn: FunctionSymbol

        if (f.callee.type === "Identifier") {
            const name = (f.callee as Identifier).value
            const symbol = this.scope?.find(name)

            if (!symbol) {
                throw new Error(`unknown function "${name}"`)
            }

            if (symbol.kind !== "function") {
                throw new Error(`"${name}" is not a function`)
            }

            fn = symbol as FunctionSymbol
        } else {
            const m = f.callee as MemberAccess

            if (m.object.type !== "Identifier") {
                throw new Error(
                    `unsupported member access target ${m.object.type}`
                )
            }

            const moduleName = (m.object as Identifier).value
            const symbol = this.scope?.find(moduleName)

            if (!symbol) {
                throw new Error(`unknown module "${moduleName}"`)
            }

            if (symbol.kind !== "module") {
                throw new Error(`"${moduleName}" is not a module`)
            }

            const module = symbol as ModuleSymbol
            const exported = module.exports.get(m.property.value)

            if (!exported) {
                throw new Error(
                    `"${m.property.value}" is not exported by "${module.name}"`
                )
            }

            if (exported.kind !== "function") {
                throw new Error(
                    `"${m.property.value}" is not a function`
                )
            }

            fn = exported as FunctionSymbol
        }

        if (f.args.length !== fn.params.length) {
            throw new Error(
                `"${fn.name}" expects ${fn.params.length} argument(s), got ${f.args.length}`
            )
        }

        for (const [i, arg] of f.args.entries()) {
            if (!arg.inferredType) {
                throw new Error(
                    `type of argument ${i + 1} to "${fn.name}" is unresolved`
                )
            }

            const expected = fn.params[i].typeHolder.type

            if (!expected) {
                throw new Error(
                    `type of parameter "${fn.params[i].name}" is unresolved`
                )
            }

            const actual = arg.inferredType

            if (
                arg.type === "NumberLiteral" &&
                actual.kind === "int" &&
                actual.size === undefined &&
                expected.kind === "int"
            ) {
                const value = (arg as NumberLiteral).value

                if (expected.size !== undefined) {
                    const min = -(2 ** (expected.size - 1))
                    const max = 2 ** (expected.size - 1) - 1

                    if (value < min || value > max) {
                        throw new Error(
                            `integer literal ${value} does not fit in i${expected.size}`
                        )
                    }

                    arg.inferredType = {
                        kind: "int",
                        size: expected.size,
                    }

                    continue
                }
            }

            if (!this.equals(actual, expected)) {
                throw new Error(
                    `argument ${i + 1} to "${fn.name}" expects ${expected.kind}, got ${actual.kind}`
                )
            }
        }
    }

    checkVariableAssignment(e: Expression): void {
        const v = e as VariableAssignment

        if (!this.scope) {
            throw new Error(
                `scope is unresolved`
            )
        }

        const symbol = this.scope.find(v.name.value)

        if (!symbol) {
            throw new Error(
                `unknown variable "${v.name.value}"`
            )
        }

        if (symbol.kind !== "variable") {
            throw new Error(
                `"${v.name.value}" is not a variable`
            )
        }

        const variable = symbol as VariableSymbol

        if (!variable.typeHolder.type) {
            throw new Error(
                `type of "${v.name.value}" is unresolved`
            )
        }

        if (!v.value.inferredType) {
            throw new Error(
                `type of assigned value "${v.name.value}" is unresolved`
            )
        }

        const expected = variable.typeHolder.type
        const actual = v.value.inferredType

        if (
            v.value.type === "NumberLiteral" &&
            actual.kind === "int" &&
            actual.size === undefined &&
            expected.kind === "int"
        ) {
            const value = (v.value as NumberLiteral).value

            if (expected.size !== undefined) {
                const min = -(2 ** (expected.size - 1))
                const max = 2 ** (expected.size - 1) - 1

                if (value < min || value > max) {
                    throw new Error(
                        `integer literal ${value} does not fit in i${expected.size}`
                    )
                }

                v.value.inferredType = {
                    kind: "int",
                    size: expected.size,
                } as IntType

                return
            }
        }

        if (
            actual.kind !== expected.kind ||
            (
                actual.kind === "int" &&
                expected.kind === "int" &&
                actual.size !== expected.size
            )
        ) {
            const expectedName =
                expected.kind === "int" && expected.size
                    ? `i${expected.size}`
                    : expected.kind

            const actualName =
                actual.kind === "int" && actual.size
                    ? `i${actual.size}`
                    : actual.kind

            throw new Error(
                `"${v.name.value}" expects ${expectedName}, but got ${actualName}`
            )
        }
    }

    equals(a: TypeValue, b: TypeValue): boolean {
        if (a.kind === "any" || b.kind === "any") return true
        if (a.kind !== b.kind) return false
        if (a.kind === "int" && b.kind === "int") return (a.size ?? 32) === (b.size ?? 32)

        return true
    }
}