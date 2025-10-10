import { BinaryExpression, Expression, ExpressionType, FunctionDeclaration, Identifier, ProgramExpression, VariableDeclaration } from "../parser/ast";

type Symbol =
    | { type: "variable"; name: Identifier, value: Expression }
    | { type: "function"; name: Identifier, body: Expression[] }

export class SemanticAnalyzer {
    private symbols: Map<string, Symbol> = new Map()
    private ast: ProgramExpression

    private table: { [key in ExpressionType]?: (e: Expression) => Symbol | undefined } = {
        "FunctionDeclaration": (e) => this.visitFunctionDeclaration(e as FunctionDeclaration),
        "VariableDeclaration": (e) => this.visitVariableDeclaration(e as VariableDeclaration),
    }

    constructor(ast: ProgramExpression) {
        this.ast = ast
    }

    analyze() {
        for (const expr of this.ast.body) {
            this.table[expr.type]?.(expr)
        }

        return this.ast
    }

    private visitVariableDeclaration(v: VariableDeclaration): Symbol | undefined {
        const name = (v.name as Identifier).value
        const symbol: Symbol = { type: "variable", name: v.name as Identifier, value: v.value }

        if (this.symbols.has(name)) {
            throw new Error(`variable ${name} is already declared`)
        } else {
            this.symbols.set(name, symbol)
        }

        this.visitExpression(v.value)
        
        return symbol
    }

    private visitFunctionDeclaration(f: FunctionDeclaration): Symbol | undefined {
        const name = (f.name as Identifier).value
        const symbol: Symbol = { type: "function", name: f.name as Identifier, body: f.body }

        if (this.symbols.has(name)) {
            throw new Error(`function ${name} is already declared`)
        }
        
        this.symbols.set(name, symbol)
        for (const expr of f.body) {
            this.visitExpression(expr)
        }

        return symbol
    }

    private visitExpression(e: Expression): Symbol | undefined {
        switch (e.type) {
            case "BinaryExpression": {
                this.visitExpression((e as BinaryExpression).left)
                this.visitExpression((e as BinaryExpression).right)
                return undefined
            }
            
            case "Identifier": {
                const name = (e as Identifier).value
                if (!this.symbols.has(name)) {
                    throw new Error(`symbol "${name}" is not defined`)
                }
                return undefined
            }
        }

        return this.table[e.type]?.(e)
    }
}