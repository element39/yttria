import { ImportExpression } from "../parser/ast"
import { FunctionSymbol, ModuleSymbol, Symbol, SymbolKind, VariableSymbol } from "./symbols"
import { BoolType, FloatType, IntType, TypeHolder, TypeValue } from "./types"

export class SemanticResolver {
    analyzedModules: Map<string, ModuleSymbol>

    table: {
        [key in SymbolKind]?: (s: Symbol) => Symbol
    } = {
        function: this.resolveFunction.bind(this),
        variable: this.resolveVariable.bind(this)
    }

    constructor(modules: Map<string, ModuleSymbol>) {
        this.analyzedModules = modules
    }

    resolve(): Map<string, ModuleSymbol> {
        for (const module of this.analyzedModules.values()) {
            this.resolveModule(module)
        }

        return this.analyzedModules
    }

    resolveModule(module: ModuleSymbol): void {
        for (const program of module.programs) {
            for (const expression of program.expression.body) {
                if (expression.type !== "ImportExpression") continue

                const imp = expression as ImportExpression
                const imported = this.analyzedModules.get(imp.path)

                if (!imported) {
                    throw new Error(`module "${imp.path}" not found`)
                }

                const name =
                    imp.alias ??
                    imp.path.split("/").pop()!

                module.scope.set(imported, name)
            }
        }

        for (const program of module.programs) {
            for (const fn of program.functions) {
                this.table[fn.kind]?.(fn)
            }
        }
    }

    resolveFunction(s: Symbol): Symbol {
        const fn = s as FunctionSymbol

        for (const param of fn.params) {
            this.table[param.kind]?.(param)
        }

        if (fn.expression.returnType) {
            this.resolveType(
                fn.returnType,
                fn.expression.returnType.value
            )
        }

        return fn
    }

    resolveVariable(s: Symbol): Symbol {
        const v = s as VariableSymbol

        if (v.expression.type === "FunctionParam") {
            this.resolveType(
                v.typeHolder,
                v.expression.paramType.value
            )
        }

        if (v.expression.type === "VariableDeclaration") {
            if (v.expression.typeAnnotation) {
                this.resolveType(
                    v.typeHolder,
                    v.expression.typeAnnotation.value
                )
            }
        }

        return v
    }

    resolveType(type: TypeHolder, name: string): void {
        switch (name) {
            case "int":
                type.type = {
                    kind: "int",
                    size: 32
                } as IntType
                break

            case "float":
                type.type = {
                    kind: "float"
                } as FloatType
                break

            case "bool":
                type.type = {
                    kind: "bool"
                } as BoolType
                break

            default:
                throw new Error(`unknown type "${name}"`)
        }
    }

    get(type: TypeHolder): TypeValue {
        if (!type.type) {
            throw new Error(`type ${type.id} is unresolved`)
        }

        return type.type
    }

    equal(ah: TypeHolder, bh: TypeHolder): boolean {
        const a = this.get(ah)
        const b = this.get(bh)

        return a.kind === b.kind
    }
}   