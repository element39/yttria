export type CheckerSymbol = {
    type: string
}

export type CheckerPrimitive = {
    type: "int" | "float" | "string" | "bool" | "null"
    value: string | number | boolean | null
}