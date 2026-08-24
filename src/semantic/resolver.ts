import { ImportExpression } from "../parser/ast"
import { FunctionSymbol, ModuleSymbol, Symbol, SymbolKind, VariableSymbol } from "./symbols"
import { TypeHolder, TypeValue } from "./types"

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
        if (name.startsWith("i") || name === "int") {
            type.type = {
                kind: "int",
                size: name === "int" ? 32 : parseInt(name.slice(1), 10) as 8 | 16 | 32 | 64
            }
            return
        }

        switch (name) {
            case "string":
                type.type = {
                    kind: "string"
                }
                break
            // case "i8":
            //     type.type = {
            //         kind: "int",
            //         size: 8
            //     }
            //     break

            // case "i16":
            //     type.type = {
            //         kind: "int",
            //         size: 16
            //     }
            //     break
            
            // case "int":
            // case "i32":
            //     type.type = {
            //         kind: "int",
            //         size: 32
            //     }
            //     break

            // case "i64":
            //     type.type = {
            //         kind: "int",
            //         size: 64
            //     }
            //     break

            case "float":
                type.type = {
                    kind: "float"
                }
                break

            case "bool":
                type.type = {
                    kind: "bool"
                }
                break
            case "any":
                type.type = {
                    kind: "any"
                }
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

    equals(ah: TypeHolder, bh: TypeHolder): boolean {
        const a = this.get(ah)
        const b = this.get(bh)

        if (a.kind !== b.kind) return false
        if (a.kind === "int" && b.kind === "int") return (a.size ?? 32) === (b.size ?? 32)

        return true
    }
}   