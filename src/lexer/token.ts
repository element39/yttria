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
    | "TemplateLiteral"

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
    vararg: "Keyword",
};