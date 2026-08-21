import { Expression, ExpressionType, FunctionCall, FunctionDeclaration, Identifier, ProgramExpression, VariableDeclaration } from "../parser/ast";
import { FunctionSymbol, ProgramSymbol, Scope, Symbol, VariableSymbol } from "./symbols";
import { createTypeHolder } from "./types";

export class SemanticAnalyser {
    ast: ProgramExpression
    scope: Scope = new Scope()


    table: { [key in ExpressionType]?: (t: Expression) => Symbol | null } = {
            FunctionDeclaration: this.visitFunctionDeclaration.bind(this),
            VariableDeclaration: this.visitVariableDeclaration.bind(this),
            FunctionCall: this.visitFunctionCall.bind(this)
    }

    constructor(ast: ProgramExpression) {
        this.ast = ast
    }

    analyse(): ProgramSymbol {
        const program: ProgramSymbol = {
            kind: "program",
            functions: [],
            expression: this.ast,
            name: "main"
        }

        for (const expr of this.ast.body) {
            const symbol = this.table[expr.type]?.(expr)

            if (symbol) this.scope.set(symbol)

            switch (symbol?.kind) {
                case "function":
                    program.functions.push(symbol as FunctionSymbol)
            }
        }

        return program
    }

    visitFunctionDeclaration(e: Expression): FunctionSymbol {
        this.scope = this.scope.push()
        const fn = e as FunctionDeclaration

        const fns: FunctionSymbol = {
            kind: "function",
            name: fn.name.value,
            expression: fn,
            scope: this.scope,
            params: [],
            returnType: createTypeHolder()
        }

        for (const param of fn.params) {
            const variable: VariableSymbol = {
                kind: "variable",
                name: param.name.value,
                expression: param,
                typeHolder: createTypeHolder()
            }

            this.scope.set(variable)
            fns.params.push(variable)
        }

        for (const ex of fn.body) {
            const symbol = this.table[ex.type]?.(ex)

            switch (symbol?.kind) {
                case "variable": {
                    const variable = symbol as VariableSymbol
                    this.scope.set(variable)
                    //fns.variables.push(variable)
                }
            }
        }

        this.scope = this.scope.pop() as Scope
        return fns as FunctionSymbol
    }

    visitVariableDeclaration(e: Expression): VariableSymbol {
        const v = e as VariableDeclaration
        const symbol: VariableSymbol = {
            kind: "variable",
            name: v.name.value,
            typeHolder: createTypeHolder(),
            expression: v
        }

        return symbol
    }

    visitFunctionCall(e: Expression) {
        const call = e as FunctionCall

        const callee = call.callee as Identifier

        const symbol = this.scope.find(callee.value)
        if (!symbol) throw new Error(`unknown function "${callee.value}"`)

        console.log(`found symbol for ${callee.value}:`, symbol)
        return null
    }
}