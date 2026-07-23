import { Expression, ExpressionType, FunctionDeclaration, ProgramExpression, VariableDeclaration } from "../../parser/ast";
import { FunctionSymbol, ProgramSymbol, Scope, Symbol, VariableSymbol } from "./symbols";
import { createEmptySlot } from "./types";

export class SemanticAnalyser {
    ast: ProgramExpression
    scope: Scope = new Scope()


    table: { [key in ExpressionType]?: (t: Expression) => Symbol | null } = {
            FunctionDeclaration: this.visitFunctionDeclaration.bind(this),
            VariableDeclaration: this.visitVariableDeclaration.bind(this)
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
            returnType: createEmptySlot()
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
            slot: createEmptySlot(),
            expression: v
        }

        return symbol
    }
}