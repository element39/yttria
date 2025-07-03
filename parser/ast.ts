// yttria is an expressive language so statements are NOT allowed
export type Expression = {
    type: ExpressionType
}

export type ExpressionType =
    | "Program"

    | "Identifier"

    | "FunctionDeclaration"
    | "FunctionParam"
    | "ReturnExpression"

    | "NumberLiteral"

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
    type: "FunctionParam"
    name: Identifier
    paramType: Identifier
}

export type ReturnExpression = Expression & {
    type: "ReturnExpression"
    value: Expression | null
}

export type NumberLiteral = Expression & {
    type: "NumberLiteral"
    value: number
}