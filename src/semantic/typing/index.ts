import { BinaryExpression, Expression, ExpressionType, FunctionDeclaration, Identifier, NumberLiteral, ProgramExpression, ReturnExpression, VariableDeclaration } from "../../parser/ast"
import { similarType, Type } from "./types"

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
        if (this.types.has(name)) {
            throw new Error(`type ${name} already defined`)
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
        "FunctionDeclaration": (expr) => this.visitFunctionDeclaration(expr as FunctionDeclaration),

        "Identifier": (expr) => this.visitIdentifier(expr as Identifier),

        "BinaryExpression": (expr) => this.visitBinaryExpression(expr as BinaryExpression),
        "VariableDeclaration": (expr) => this.visitVariableDeclaration(expr as VariableDeclaration),
        "ReturnExpression": (expr) => this.visitReturnExpression(expr as ReturnExpression),

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

    private visitFunctionDeclaration(f: FunctionDeclaration) {
        this.env = this.env.createChild();

        for (const expr of f.body) {
            this.checkExpression(expr)
        }
        
        const restored = this.env.restoreParent();
        return undefined;
    }

    private visitIdentifier(id: Identifier): Type {
        const t = this.env.get(id.value)
        if (!t) throw new Error(`undefined symbol: ${id.value}`)
        return t
    }

    private visitBinaryExpression(b: BinaryExpression): Type {
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

    private visitVariableDeclaration(v: VariableDeclaration): Type | undefined {
        const name = v.name.value
        const type = this.checkExpression(v.value)
        if (!type) throw new Error(`undefined type for variable: ${name}`)
        this.env.define(name, type)
        return type
    }

    private visitReturnExpression(r: ReturnExpression): Type | undefined {
        if (r.value) {
            return this.checkExpression(r.value)
        }
        return undefined
    }
}