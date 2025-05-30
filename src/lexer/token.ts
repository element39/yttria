export type TokenType =
    | "EOF"
    | "EOL"
    | "Unknown"

    | "Identifier"
    | "Keyword"

    | "Operator"
    | "Delimiter"

    | "Number"
    | "String"

export type Token = {
    type: TokenType;
    literal: string;
}

export const KEYWORDS: Record<string, TokenType> = {
    fn: "Keyword",
    use: "Keyword",
    if: "Keyword",
    as: "Keyword",
    return: "Keyword",
    extern: "Keyword",
};