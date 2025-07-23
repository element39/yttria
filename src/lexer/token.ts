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
    "default",
    
    "if",
    "else",

    "while",
    "for",
    "break",
    "continue",
    
    "use",
    "as",
    "let",
    "const",
] as const

export type Keyword = (typeof Keywords)[number]

export const Modifiers = [
    "pub",
    "extern",
    "foreign",
] as const

export type Modifier = (typeof Modifiers)[number] // i didnt even know you could do this

export const MultiCharDelimiters = [
    ":="
]

export const SingleCharDelimiters = [
    "(",
    ")",
    "{",
    "}",
    ",",
    ";",
    ":",
    "."
]

export const SingleCharOperators = [
    "<",
    ">",
    "!",
    "=",
    "+",
    "-",
    "*",
    "/",
    "&",
    "|"
]

export const MultiCharOperators = [
    "==",
    "!=",
    "<=",
    ">=",
    "->",
    "=>",
    "&&",
    "||",
    "++",
    "--",
    "+=",
    "-=",
    "*=",
    "/="
]