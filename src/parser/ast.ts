export type ExpressionType =
    | "Program"
    
    | "ConstDeclaration"
    | "FunctionDeclaration"
    | "ReturnExpression"
    
    | "BinaryExpression"
    | "NumberLiteral"
    | "Identifier"
;

export type Expression = {
    type: ExpressionType;
    inferredType?: string;
}

export type ProgramExpression = Expression & {
    type: "Program";
    body: Expression[];
};

export type ConstDeclaration = Expression & {
    type: "ConstDeclaration";
    name: Identifier;
    value: Expression;
    typeAnnotation?: Identifier;
};

export type FunctionDeclaration = Expression & {
    type: "FunctionDeclaration";
    name: Identifier;
    parameters: Identifier[];
    returnType?: Identifier;
    body: Expression[];
};

export type ReturnExpression = Expression & {
    type: "ReturnExpression";
    value: Expression;
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