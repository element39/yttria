import { Expression, FunctionDeclaration, ProgramExpression, VariableDeclaration } from "../../parser/ast"
import { TypeSlot } from "./types"

export type SymbolKind =
    | "program"
    | "function"
    | "variable"

export type Symbol = {
    kind: SymbolKind
    expression: Expression
}

export type ProgramSymbol = {
    kind: "program"
    name: string
    functions: FunctionSymbol[]
    expression: ProgramExpression    
}

export type FunctionSymbol = {
    kind: "function"
    name: string
    params: VariableSymbol[]
    // variables: VariableSymbol[]
    expression: FunctionDeclaration
    scope: Scope
}

export type VariableSymbol = {
    kind: "variable"
    name: string
    slot: TypeSlot
    expression: VariableDeclaration
}

export class Scope {
    parent?: Scope
    children: Scope[] = []
    variables: Map<string, VariableSymbol>

    constructor(parent?: Scope) {
        this.parent = parent
        this.variables = new Map()
    }

    pop(): Scope {
        return this.parent || this
    }

    push(): Scope {
        const child = new Scope(this)
        this.children.push(child)
        return child
    }

    find(name: string): VariableSymbol | undefined {
        if (this.variables.has(name)) return this.variables.get(name)
        if (this.parent) return this.parent.find(name)
    }

    setVariable(symbol: VariableSymbol): void {
        this.variables.set(symbol.name, symbol)
    }

    toJSON() {
        return {
            variables: [...this.variables.values()],
            children: this.children
        }
    }
}