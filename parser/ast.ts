// yttria is an expressive language so statements are NOT allowed
export type Expression = {
    type: ExpressionType
}

export type ExpressionType =
    | "Program"

    | "Identifier"

    | "FunctionDeclaration"
    | "FunctionParam"
    | "FunctionCall"
    | "ReturnExpression"
    
    | "IfExpression"
    | "ElseExpression"

    | "BinaryExpression" // n > 1
    | "UnaryExpression" // -n

    | "VariableDeclaration"

    | "NumberLiteral"
    | "StringLiteral"
    | "BooleanLiteral"
    | "NullLiteral"

    | "CommentExpression"

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

export type FunctionCall = Expression & {
    type: "FunctionCall"
    callee: Identifier
    args: Expression[]
}

export type FunctionParam = {
    type: "FunctionParam"
    name: Identifier
    paramType: Identifier
}

export type IfExpression = Expression & {
    type: "IfExpression"
    condition: Expression
    body: Expression[]
    alternate?: IfExpression | ElseExpression
}

export type ElseExpression = Expression & {
    type: "ElseExpression"
    body: Expression[]
}

export type ReturnExpression = Expression & {
    type: "ReturnExpression"
    value: Expression | null
}

export type VariableDeclaration = Expression & {
    type: "VariableDeclaration"
    name: Identifier
    value: Expression
    typeAnnotation?: Identifier
    mutable: boolean
}

export type NumberLiteral = Expression & {
    type: "NumberLiteral"
    value: number
}

export type StringLiteral = Expression & {
    type: "StringLiteral"
    value: string
}

export type BooleanLiteral = Expression & {
    type: "BooleanLiteral"
    value: boolean
}

export type NullLiteral = Expression & {
    type: "NullLiteral"
    value: null
}

export type BinaryExpression = Expression & {
    type: "BinaryExpression"
    left: Expression
    operator: string
    right: Expression
}

export type UnaryExpression = Expression & {
    type: "UnaryExpression"
    operator: string
    operand: Expression
}

export type CommentExpression = Expression & {
    type: "CommentExpression"
    value: string
}