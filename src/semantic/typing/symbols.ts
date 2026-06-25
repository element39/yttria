import { TypeSlot } from "./types"

export type SymbolKind =
    | "module"
    | "function"
    | "variable"

export type Symbol =
    | ModuleSymbol
    | FunctionSymbol
    | VariableSymbol

export type ModuleSymbol = {
    kind: "module"
    name: string
    functions: FunctionSymbol[]
}

export type FunctionSymbol = {
    kind: "function"
    name: string
    params: VariableSymbol[]
    variables: VariableSymbol[]
}

export type VariableSymbol = {
    kind: "variable"
    name: string
    type: TypeSlot
}

// export type Scope = {
//     parent?: Scope
//     variables: Map<string, VariableSymbol>
// }

export class Scope {
    parent?: Scope
    variables: Map<string, VariableSymbol>

    constructor(parent?: Scope) {
        this.parent = parent
        this.variables = new Map()
    }

    lookup(name: string): VariableSymbol | undefined {
        if (this.variables.has(name)) return this.variables.get(name)
        if (this.parent) return this.parent.lookup(name)
    }
}