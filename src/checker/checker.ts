import {
    BinaryExpression,
    ConstDeclaration,
    Expression,
    FunctionDeclaration,
    Identifier,
    ProgramExpression,
    ReturnExpression
} from "../parser/ast";

export class TypeChecker {
    private ast: ProgramExpression;
    private symbols = new Map<string, string>();
    private currentFunctionReturnType: string | undefined;

    constructor(ast: ProgramExpression) {
        this.ast = ast;
    }

    public check(): ProgramExpression {
        for (const expr of this.ast.body) {
            this.visit(expr);
        }
        return this.ast;
    }

    private visit(expr: Expression): string | void {
        switch (expr.type) {
            case "ConstDeclaration":
                return this.visitConstDeclaration(expr as ConstDeclaration);
            case "FunctionDeclaration":
                return this.visitFunctionDeclaration(expr as FunctionDeclaration);
            case "ReturnExpression":
                return this.visitReturnExpression(expr as ReturnExpression);
            case "BinaryExpression":
                return this.visitBinaryExpression(expr as BinaryExpression);
            case "NumberLiteral":
                expr.inferredType = "int";
                return "int";
            case "Identifier":
                return this.visitIdentifier(expr as Identifier);
            default:
                throw new Error(`Unknown expression type: ${expr.type}`);
        }
    }

    private visitConstDeclaration(expr: ConstDeclaration): string {
        const name = expr.name.name;
        if (this.symbols.has(name)) {
            throw new Error(`Variable ${name} already declared.`);
        }
        let valueType = this.visit(expr.value);
        if (expr.typeAnnotation) {
            const annotatedType = expr.typeAnnotation.name;
            if (valueType && valueType !== annotatedType) {
                throw new Error(`Type mismatch in const declaration '${name}': expected ${annotatedType}, got ${valueType}`);
            }
            valueType = annotatedType;
        }
        this.symbols.set(name, valueType || "unknown");
        expr.inferredType = valueType || "unknown";
        return expr.inferredType;
    }

    private visitFunctionDeclaration(expr: FunctionDeclaration): void {
        const externalSymbols = this.symbols;
        this.symbols = new Map(externalSymbols);

        this.currentFunctionReturnType = expr.returnType?.name;

        // todo: params
        // for (const param of expr.parameters) {
        //     this.symbols.set(param.name, "unknown");
        // }

        for (const stmt of expr.body) {
            this.visit(stmt);
        }

        expr.inferredType = this.currentFunctionReturnType || "unknown";

        this.symbols = externalSymbols;
        this.currentFunctionReturnType = undefined;
    }

    private visitReturnExpression(expr: ReturnExpression): void {
        const valueType = this.visit(expr.value);
        if (typeof valueType === "string") expr.inferredType = valueType;
        if (this.currentFunctionReturnType && valueType !== this.currentFunctionReturnType) {
            throw new Error(`Return type mismatch: expected ${this.currentFunctionReturnType}, got ${valueType}`);
        }
    }

    private visitBinaryExpression(expr: BinaryExpression): string {
        const leftType = this.visit(expr.left);
        const rightType = this.visit(expr.right);
        if (leftType !== rightType) {
            throw new Error(`Type mismatch in binary expression: ${leftType} ${expr.operator} ${rightType}`);
        }
        
        // todo: support more types
        if (leftType !== "int") {
            throw new Error(`Operator '${expr.operator}' not supported for type '${leftType}'`);
        }
        expr.inferredType = leftType;
        return leftType;
    }

    private visitIdentifier(expr: Identifier): string {
        const name = expr.name;
        const type = this.symbols.get(name);
        if (!type) {
            throw new Error(`Undefined variable: ${name}`);
        }
        expr.inferredType = type;
        return type;
    }
}