import { ExpressionType, FunctionDeclaration, Identifier, ProgramExpression, VariableDeclaration } from "../parser/ast";
import { CheckerType, CheckerPlaceholder } from "./types";

export class TypeChecker {
    private ast: ProgramExpression;
    private errors: string[] = [];

    private table: { [key in ExpressionType]?: (expr: any) => void } = {
        VariableDeclaration: this.checkVariableDeclaration.bind(this),
    };

    private typeEnvironment = new Map<string, { resolvedType: CheckerType | CheckerPlaceholder, typeAnnotation?: Identifier }>();

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
        console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
        console.log(expr.name, expr.resolvedType)
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

        if (expr.value && expr.value.type === "Identifier") {
            const refName = (expr.value as Identifier).value;
            const refInfo = this.typeEnvironment.get(refName);
            if (
                refInfo &&
                refInfo.typeAnnotation &&
                refInfo.resolvedType.type === "CheckerType" &&
                refInfo.typeAnnotation.value !== refInfo.resolvedType.value
            ) {
                this.errors.push(
                    `type mismatch for variable '${expr.name.value}': referenced variable '${refName}' has type mismatch (expected ${refInfo.typeAnnotation.value}, got ${refInfo.resolvedType.value})`
                );
            }
        }

        this.typeEnvironment.set(expr.name.value, {
            resolvedType: expr.resolvedType,
            typeAnnotation: expr.typeAnnotation
        });
    }
}