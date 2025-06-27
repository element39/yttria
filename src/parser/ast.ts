export type ExpressionType =
    | "Program"
    
    | "ConstDeclaration"
    | "LetDeclaration"
    | "AssignmentDeclaration"
    | "FunctionDeclaration"
    | "ReturnExpression"
    
    | "BinaryExpression"
    | "IntegerLiteral"
    | "FloatLiteral"
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

export type LetDeclaration = Expression & {
    type: "LetDeclaration";
    name: Identifier;
    value: Expression;
    typeAnnotation?: Identifier;
};

export type AssignmentDeclaration = Expression & {
    type: "AssignmentDeclaration";
    name: Identifier;
    value: Expression;
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

export type IntegerLiteral = Expression & {
    type: "IntegerLiteral";
    value: number;
};

export type FloatLiteral = Expression & {
    type: "FloatLiteral";
    value: number;
};

export type Identifier = Expression & {
    type: "Identifier";
    name: string;
};