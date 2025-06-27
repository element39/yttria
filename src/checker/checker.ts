import {
    AssignmentDeclaration,
    BinaryExpression,
    ConstDeclaration,
    Expression,
    FloatLiteral,
    FunctionDeclaration,
    Identifier,
    LetDeclaration,
    ProgramExpression,
    ReturnExpression
} from "../parser/ast";

export class TypeChecker {
    private ast: ProgramExpression;
    private symbols = new Map<string, { type: string; mutable: boolean }>();
    private fnRet: string | undefined;

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
            case "LetDeclaration":
                return this.visitLetDeclaration(expr as LetDeclaration);
            case "AssignmentDeclaration":
                return this.visitAssignmentDeclaration(expr as AssignmentDeclaration);
            case "FunctionDeclaration":
                return this.visitFunctionDeclaration(expr as FunctionDeclaration);
            case "ReturnExpression":
                return this.visitReturnExpression(expr as ReturnExpression);
            case "BinaryExpression":
                return this.visitBinaryExpression(expr as BinaryExpression);
            case "IntegerLiteral":
                expr.inferredType = "int";
                return "int";
            case "FloatLiteral":
                (expr as FloatLiteral).inferredType = "float";
                return "float";
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
                throw new Error(
                    `Type mismatch in const declaration "${name}": expected ${annotatedType}, got ${valueType}`
                );
            }
            valueType = annotatedType;
        }
        const finalType = valueType || "unknown";
        this.symbols.set(name, { type: finalType, mutable: false });
        expr.inferredType = finalType;
        return finalType;
    }

    private visitLetDeclaration(expr: LetDeclaration): string {
        const name = expr.name.name;
        if (this.symbols.has(name)) {
            throw new Error(`Variable ${name} already declared.`);
        }
        let valueType = this.visit(expr.value);
        if (expr.typeAnnotation) {
            const annotatedType = expr.typeAnnotation.name;
            if (valueType && valueType !== annotatedType) {
                throw new Error(
                    `Type mismatch in let declaration "${name}": expected ${annotatedType}, got ${valueType}`
                );
            }
            valueType = annotatedType;
        }
        const finalType = valueType || "unknown";
        this.symbols.set(name, { type: finalType, mutable: true });
        expr.inferredType = finalType;
        return finalType;
    }

    private visitAssignmentDeclaration(expr: AssignmentDeclaration): string {
        const name = expr.name.name;
        const info = this.symbols.get(name);
        if (!info) {
            throw new Error(`Undefined variable in assignment: ${name}`);
        }
        if (!info.mutable) {
            throw new Error(`Cannot assign to constant "${name}"`);
        }
        const valueType = this.visit(expr.value);
        if (valueType !== info.type) {
            throw new Error(
                `Type mismatch in assignment to "${name}": expected ${info.type}, got ${valueType}`
            );
        }
        expr.inferredType = info.type;
        return info.type;
    }

    private visitFunctionDeclaration(expr: FunctionDeclaration): void {
        const savedSymbols = this.symbols;
        this.symbols = new Map(savedSymbols);
        this.fnRet = expr.returnType?.name;

        // TODO: handle parameters here

        for (const stmt of expr.body) {
            this.visit(stmt);
        }
        expr.inferredType = this.fnRet || "unknown";

        this.symbols = savedSymbols;
        this.fnRet = undefined;
    }

    private visitReturnExpression(expr: ReturnExpression): void {
        const valueType = this.visit(expr.value);
        if (typeof valueType === "string") {
            expr.inferredType = valueType;
        }
        if (this.fnRet && valueType !== this.fnRet) {
            throw new Error(
                `Return type mismatch: expected ${this.fnRet}, got ${valueType}`
            );
        }
    }

    private visitBinaryExpression(expr: BinaryExpression): string {
        const leftType  = this.visit(expr.left);
        const rightType = this.visit(expr.right);

        const numeric = new Set(["int", "float"]);
        if (!numeric.has(leftType!) || !numeric.has(rightType!)) {
            throw new Error(
                `Operator "${expr.operator}" not supported for types "${leftType}" and "${rightType}"`
            );
        }

        const resultType = leftType === "float" || rightType === "float" 
            ? "float" 
            : "int";

        expr.inferredType = resultType;
        return resultType;
    }

    private visitIdentifier(expr: Identifier): string {
        const name = expr.name;
        const info = this.symbols.get(name);
        if (!info) {
            throw new Error(`Undefined variable: ${name}`);
        }
        expr.inferredType = info.type;
        return info.type;
    }
}