import { BinaryExpression, Expression, ExpressionType, FunctionDeclaration, Identifier, NumberLiteral, ProgramExpression, ReturnExpression, VariableDeclaration } from "../parser/ast"
import { newPlaceholderType, similarType, Type } from "./types"

export class TypeEnvironment {
    private types: Map<string, Type> = new Map()
    private parent?: TypeEnvironment

    constructor(parent?: TypeEnvironment) {
        this.parent = parent

        if (!parent) {
            this.types.set("int", { kind: "int" })
            this.types.set("float", { kind: "float" })
            this.types.set("bool", { kind: "bool" })
            this.types.set("string", { kind: "string" })
        }
    }

    define(name: string, type: Type) {
        const existing = this.types.get(name)
        if (existing) {
            if (existing.kind === "placeholder") {
                this.types.set(name, type)
                return
            }

            if (!similarType(existing, type)) {
                throw new Error(`type mismatch for ${name}: ${existing.kind} vs ${type.kind}`)
            }

            throw new Error(`name ${name} with type ${existing.kind} already defined`)
        }

        this.types.set(name, type)
    }

    get(name: string): Type | undefined {
        return this.types.get(name) ?? this.parent?.get(name)
    }

    createChild(): TypeEnvironment {
        return new TypeEnvironment(this)
    }

    restoreParent(): TypeEnvironment {
        if (!this.parent) throw new Error("no parent environment to restore to");
        return this.parent
    }
}

export class TypeChecker {
    private env: TypeEnvironment
    private ast: ProgramExpression

    private table: { [key in ExpressionType]?: (expr: Expression) => Type | undefined } = {
        "FunctionDeclaration": (expr) => this.checkFunctionDeclaration(expr as FunctionDeclaration),

        "Identifier": (expr) => this.checkIdentifier(expr as Identifier),

        "BinaryExpression": (expr) => this.checkBinaryExpression(expr as BinaryExpression),
        "VariableDeclaration": (expr) => this.checkVariableDeclaration(expr as VariableDeclaration),
        "ReturnExpression": (expr) => this.checkReturnExpression(expr as ReturnExpression),

        "NumberLiteral": (expr) => { return Number.isInteger((expr as NumberLiteral).value) ? { kind: "int" } : { kind: "float" } },
        "BooleanLiteral": (expr) => { return { kind: "bool" } },
    }

    constructor(ast: ProgramExpression, env?: TypeEnvironment) {
        this.ast = ast
        this.env = env ?? new TypeEnvironment()
    }

    check() {
        for (const expr of this.ast.body) {
            this.checkExpression(expr)
        }

        return this.ast
    }

    private checkExpression(expr: Expression): Type | undefined {
        const fn = this.table[expr.type]
        if (!fn) throw new Error(`no type rule for ${expr.type}`)
        return fn(expr)
    }

    private checkFunctionDeclaration(f: FunctionDeclaration) {
        this.env = this.env.createChild();

        for (const param of f.params) {

            if (!param.paramType) this.env.define(param.name.value, newPlaceholderType())
            else {
                const paramType = this.env.get(param.paramType.value)

                if (!paramType) this.env.define(param.name.value, newPlaceholderType())
                else this.env.define(param.name.value, paramType)
            }
        }

        for (const expr of f.body) {
            this.checkExpression(expr)
        }
        
        this.env = this.env.restoreParent();
        return undefined;
    }

    private checkIdentifier(id: Identifier): Type {
        const t = this.env.get(id.value)
        if (!t) throw new Error(`undefined symbol: ${id.value}`)
        return t
    }

    private checkBinaryExpression(b: BinaryExpression): Type {
        const leftType = this.checkExpression(b.left)
        const rightType = this.checkExpression(b.right)

        if (!leftType) {
            throw new Error("Left side of binary expression has undefined type")
        }
        if (!rightType) {
            throw new Error("Right side of binary expression has undefined type")
        }

        if (!similarType(leftType, rightType)) {
            throw new Error(
                `type mismatch in binary expression: ${leftType.kind} vs ${rightType.kind}`
            )
        }

        return leftType
    }

    private checkVariableDeclaration(v: VariableDeclaration): Type | undefined {
        const name = v.name.value;
        if (this.env.get(name)) throw new Error(`variable ${name} already declared`);

        let finalType: Type | undefined;

        if (v.typeAnnotation) {
            const annotatedType = this.env.get(v.typeAnnotation.value);
            if (!annotatedType) throw new Error(`unknown type annotation: ${v.typeAnnotation.value}`);

            const rhsType = this.checkExpression(v.value);
            if (!rhsType) throw new Error(`undefined type for variable: ${name}`);

            if (!similarType(annotatedType, rhsType)) {
                throw new Error(
                    `type mismatch for '${name}': annotated ${annotatedType.kind} vs inferred ${rhsType.kind}`
                );
            }

            finalType = annotatedType;
        } else {
            finalType = this.checkExpression(v.value);
            if (!finalType) throw new Error(`undefined type for variable: ${name}`);
        }

        this.env.define(name, finalType);
        return finalType;
    }

    private checkReturnExpression(r: ReturnExpression): Type | undefined {
        if (r.value) {
            return this.checkExpression(r.value)
        }
        return undefined
    }
}