// yttria is an expressive language so statements are NOT allowed
export type Expression = {
    type: ExpressionType
}

export type ExpressionType =
    | "Program"

    | "Identifier"

    | "FunctionDeclaration"

export type ProgramExpression = Expression & {
    type: "Program"
    body: Expression[]
}

export type Identifier = Expression & {
    type: "Identifier"
    value: string
}

export type FunctionDeclaration = Expression & {
    type: "FunctionDeclaration"
    name: Identifier
    params: FunctionParam[]
    returnType: Identifier
    body: Expression[]
}

export type FunctionParam = {
    name: Identifier
    type: Identifier
}