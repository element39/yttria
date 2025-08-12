export type CheckerSymbol =
    | "CheckerVariable"
    | "CheckerType"
    | "CheckerPlaceholder"

export type Checker =
    | CheckerVariable
    | CheckerType
    | CheckerFunction
    | CheckerPlaceholder

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
    value: string
}

export type CheckerPlaceholder = {
    type: "CheckerPlaceholder"
    id: number
}

export type ConstraintSymbol =
    | "BinaryConstraint"

export type Constraint =
    | BinaryConstraint

export type BinaryConstraint = {
    type: "BinaryConstraint"
    left: Checker
    right: Checker
    operator: "=="
}