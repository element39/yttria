export type ExpressionType =
    | "Program"

    | "BinaryExpression"

    | "NumberLiteral"
    | "Identifier"
;

export type Expression = {
    type: ExpressionType;
    // [key: string]: any;
}

export type ProgramExpression = Expression & {
    type: "Program";
    body: Expression[];
};

export type BinaryExpression = Expression & {
    type: "BinaryExpression";
    operator: "+" | "-" | "*" | "/";
    left: Expression;
    right: Expression;
};

export type NumberLiteral = Expression & {
    type: "NumberLiteral";
    value: number;
};

export type Identifier = Expression & {
    type: "Identifier";
    name: string;
};