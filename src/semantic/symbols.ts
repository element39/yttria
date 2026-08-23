import { Expression, FunctionDeclaration, FunctionParam, ProgramExpression, VariableDeclaration } from "../parser/ast"
import { TypeHolder } from "./types"

export type SymbolKind =
    | "program"
    | "function"
    | "variable"
    | "module"

export type Symbol = {
    kind: SymbolKind
    expression: Expression
    name: string
}

export type ProgramSymbol = Symbol & {
    kind: "program"
    functions: FunctionSymbol[]
    expression: ProgramExpression    
}

export type FunctionSymbol = Symbol & {
    kind: "function"
    params: VariableSymbol[]
    // variables: VariableSymbol[]
    expression: FunctionDeclaration
    scope: SemanticScope
    returnType: TypeHolder
}

export type VariableSymbol = Symbol & {
    kind: "variable"
    typeHolder: TypeHolder
    expression: VariableDeclaration | FunctionParam
}

export type ModuleSymbol = Symbol & {
    kind: "module"
    exports: Map<string, Symbol>
    scope: SemanticScope
    programs: ProgramSymbol[]
}

export class SemanticScope {
    parent?: SemanticScope
    children: SemanticScope[] = []
    symbols: Map<string, Symbol> = new Map()

    constructor(parent?: SemanticScope) {
        this.parent = parent
    }

    pop(): SemanticScope {
        return this.parent || this
    }

    push(): SemanticScope {
        const child = new SemanticScope(this)
        this.children.push(child)
        return child
    }

    find(name: string): Symbol | undefined {
        if (this.symbols.has(name)) return this.symbols.get(name)
        if (this.parent) return this.parent.find(name)
    }

    set(s: Symbol, name = s.name): void {
        if (this.symbols.has(name)) throw new Error(`symbol "${name}" already exists in this scope`)
        this.symbols.set(name, s)
    }

    toJSON() {
        return {
            symbols: [...this.symbols.values()],
            children: this.children
        }
    }
}