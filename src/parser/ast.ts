export type ASTType =
    | "Program"
    | "Identifier"

    | "UseDeclaration"

    | "FnDeclaration"
    | "ExternalFnDeclaration"
    | "FnParam"
    | "FnCall"

    | "MemberAccess"
    | "Literal"
    | "TemplateLiteral"
    | "BinaryExpression"
    | "UnaryExpression"

    | "ReturnExpression";

// we ONLY got expressions here fr
export type Expression = {
    type: ASTType;
}

export type IdentifierAST = {
    type: "Identifier";
    value: string;
}

export type ProgramAST = Expression & {
    type: "Program";
    body: Expression[];
}

export type UseDeclarationAST = Expression & {
    type: "UseDeclaration";
    name: string;
    alias?: string;
};

export type FnDeclarationAST = Expression & {
    type: "FnDeclaration";
    name: string;
    params: FnParamAST[];
    returnType: string;
    body: Expression[];
};

export type ExternalFnDeclarationAST = Omit<FnDeclarationAST, "body" | "type"> & {
    type: "ExternalFnDeclaration";
};

export type FnParamAST = Expression & {
    type: "FnParam";
    name: string;
    typeAnnotation: string;
    isArray: boolean;
};

export type FnCallAST = Expression & {
    type: "FnCall";
    callee: Expression;
    args: Expression[];
};

export type MemberAccessAST = Expression & {
    type: "MemberAccess";
    object: Expression;
    property: string;
};

export type LiteralAST = Expression & {
    type: "Literal";
    value: string | number;
};

export type TemplateLiteralAST = Expression & {
    type: "TemplateLiteral";
    parts: (string | Expression)[]; // eg ["5+3= ", { type: "BinaryExpression", operator: "+", ... }]
};

export type BinaryExpressionAST = Expression & {
    type: "BinaryExpression";
    operator: string;
    left: Expression;
    right: Expression;
};

export type ReturnExpressionAST = Expression & {
    type: "ReturnExpression";
    argument: Expression | null;
};

export type UnaryExpressionAST = Expression & {
    type: "UnaryExpression";
    operator: string;
    argument: Expression;
};