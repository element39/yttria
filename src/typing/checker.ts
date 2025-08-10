import { ExpressionType, FunctionDeclaration, ProgramExpression, VariableDeclaration } from "../parser/ast";

export class TypeChecker {
    private ast: ProgramExpression;
    private errors: string[] = [];

    private table: { [key in ExpressionType]?: (expr: any) => void } = {
        VariableDeclaration: this.checkVariableDeclaration.bind(this),
    };

    constructor(ast: ProgramExpression) {
        this.ast = ast;
    }

    check() {
        for (const expr of this.ast.body) {
            if (expr.type in this.table) {
                this.table[expr.type]!(expr);
            }
        }
        return this.errors;
    }

    private checkVariableDeclaration(expr: VariableDeclaration) {
        if (!expr.resolvedType) {
            this.errors.push(`could not resolve type for variable "${expr.name.value}"`);
            return;
        }

        if (expr.typeAnnotation && expr.resolvedType.type === "CheckerType") {
            if (expr.typeAnnotation.value !== expr.resolvedType.value) {
                this.errors.push(
                    `type mismatch for variable '${expr.name.value}': expected ${expr.typeAnnotation.value}, got ${expr.resolvedType.value}`
                );
            }
        }

        if (expr.resolvedType.type === "CheckerPlaceholder") {
            this.errors.push(`type inference failed for variable '${expr.name.value}'`);
        }
    }
}