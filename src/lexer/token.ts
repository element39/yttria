export type TokenType =
    | "EOF"
    | "EOL"
    | "Unknown"

    | "Identifier"
    | "Keyword"

    | "Operator"
    | "Delimiter"

    | "Number"

export type Token = {
    type: TokenType;
    literal: string;
}

export const KEYWORDS: Record<string, TokenType> = {
    fn: "Keyword",
    return: "Keyword",
    const: "Keyword",
    let: "Keyword",
};