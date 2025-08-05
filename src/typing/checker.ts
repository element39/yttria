import { ExpressionType, FunctionDeclaration, ProgramExpression, VariableDeclaration } from "../parser/ast";

export class TypeChecker {
    private ast: ProgramExpression;
    private errors: string[] = [];

    private table: { [key in ExpressionType]?: (expr: any) => void } = {
        FunctionDeclaration: this.checkFunctionDeclaration.bind(this),
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

    private checkFunctionDeclaration(fn: FunctionDeclaration) {
        for (const xpr of fn.body) {
            if (xpr.type in this.table) {
                this.table[xpr.type]!(xpr);
            }
        }
    }

    // TODO: make this better
    private checkVariableDeclaration(v: VariableDeclaration) {
        if (v.typeAnnotation && v.resolvedType) {
            const ints = ["int", "i8", "i16", "i32", "i64"];
            if (
                v.typeAnnotation.value !== v.resolvedType.name &&
                !(ints.includes(v.typeAnnotation.value) && ints.includes(v.resolvedType.name)) &&
                v.resolvedType.name !== "unknown"
            ) {
                this.errors.push(
                    `type mismatch in variable "${v.name.value}": expected ${v.typeAnnotation.value}, got ${v.resolvedType.name}`
                );
            }
        } else if (!v.typeAnnotation && !v.resolvedType) {
            this.errors.push(`cannot resolve type for variable "${v.name.value}"`);
        }
    }
}