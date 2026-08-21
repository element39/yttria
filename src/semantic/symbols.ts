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
    scope: Scope
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
}

export class Scope {
    parent?: Scope
    children: Scope[] = []
    symbols: Map<string, Symbol>

    constructor(parent?: Scope) {
        this.parent = parent
        this.symbols = new Map()
    }

    pop(): Scope {
        return this.parent || this
    }

    push(): Scope {
        const child = new Scope(this)
        this.children.push(child)
        return child
    }

    find(name: string): Symbol | undefined {
        if (this.symbols.has(name)) return this.symbols.get(name)
        if (this.parent) return this.parent.find(name)
    }

    set(s: Symbol): void {
        if (this.symbols.has(s.name)) throw new Error(`symbol "${s.name}" already exists in this scope`)
        this.symbols.set(s.name, s)
    }

    toJSON() {
        return {
            symbols: [...this.symbols.values()],
            children: this.children
        }
    }
}