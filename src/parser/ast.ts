import { Modifier } from "../lexer/token"
import { CheckerPlaceholder, CheckerType } from "../typing/types"

export type Expression = {
    type: ExpressionType
}

export type ExpressionType =
    | "Program"

    | "Identifier"
    | "MemberAccess"
    | "ImportExpression"

    | "FunctionDeclaration"
    | "FunctionParam"
    | "FunctionCall"
    | "ReturnExpression"
    
    | "IfExpression"
    | "ElseExpression"

    | "WhileExpression"

    | "SwitchExpression"
    | "CaseExpression"

    | "BinaryExpression" // n > 1
    | "PreUnaryExpression" // -n
    | "PostUnaryExpression" // x++

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

// foo.bar.baz or foo.bar() etc
export type MemberAccess = Expression & {
    type: "MemberAccess"
    object: Expression
    property: Expression
}

export type ImportExpression = Expression & {
    type: "ImportExpression"
    path: string // e.g std/io
    alias?: string // use std/io as aliased_name
}

export type FunctionDeclaration = Expression & {
    type: "FunctionDeclaration"
    name: Identifier
    params: FunctionParam[]
    returnType?: Identifier
    resolvedReturnType?: CheckerType | CheckerPlaceholder
    body: Expression[]
    modifiers: Modifier[]
}

export type FunctionCall = Expression & {
    type: "FunctionCall"
    callee: Identifier// | MemberAccess
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

export type WhileExpression = Expression & {
    type: "WhileExpression"
    condition: Expression
    body: Expression[]
}

export type SwitchExpression = Expression & {
    type: "SwitchExpression"
    value: Expression
    cases: CaseExpression[]
}

export type CaseExpression = Expression & {
    type: "CaseExpression"
    value: Expression | "default"
    body: Expression[]
}

export type ReturnExpression = Expression & {
    type: "ReturnExpression"
    value: Expression
}

export type VariableDeclaration = Expression & {
    type: "VariableDeclaration"
    name: Identifier
    value: Expression
    typeAnnotation?: Identifier
    resolvedType?: CheckerType | CheckerPlaceholder
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

export type BaseUnaryExpression = Expression & {
    operator: string
    operand: Expression
}

export type PreUnaryExpression = BaseUnaryExpression & {
    type: "PreUnaryExpression"
}

export type PostUnaryExpression = BaseUnaryExpression & {
    type: "PostUnaryExpression"
}

export type UnaryExpression = PreUnaryExpression | PostUnaryExpression

export type CommentExpression = Expression & {
    type: "CommentExpression"
    value: string
}