export type CheckerSymbol =
    | "CheckerVariable"
    | "CheckerType"

export type CheckerVariable = {
    type: "CheckerVariable"
    varType: CheckerType
}

export type CheckerFunction = {
    type: "CheckerFunction"
    returnType: CheckerSymbol
    paramTypes: CheckerSymbol[]
}

export type CheckerType = {
    type: "CheckerType"
    name: string
}