export type Token = {
    type: TokenType;
    literal: string;
}

export type TokenType =
    | "EOF"
    | "EOL"
    | "Unknown"

    | "Identifier"
    | "Keyword"

    | "Operator"
    | "Delimiter"

    | "Number"

export const Keywords = [
    "fn",
    "return"
]