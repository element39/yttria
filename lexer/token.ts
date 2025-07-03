export type Token = {
    type: TokenType
    literal: string
}

export type TokenType =
    | "EOF"
    | "EOL"
    | "Unknown"

    | "Comment"

    | "Identifier"
    | "Keyword"

    | "Operator"
    | "Delimiter"

    | "Null"
    | "Number"
    | "String"
    | "Boolean"

export const Keywords = [
    "fn",
    "if",
    "else",
    "return"
]