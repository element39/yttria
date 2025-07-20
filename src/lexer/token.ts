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
    "return",

    "switch",
    "case",
    "default",
    
    "if",
    "else",

    "while",
    "for",
    "break",
    "continue",
    
    "let",
    "const",
] as const