import {
    Expression,
    ExpressionType,
    FunctionDeclaration,
    NumberLiteral,
    ProgramExpression,
    VariableDeclaration
} from "../../parser/ast"

import {
    Symbol,
    ModuleSymbol,
    FunctionSymbol,
    VariableSymbol
} from "./symbols"
import { createEmptySlot, IntType } from "./types"

export class SemanticAnalyser {
    ast: ProgramExpression
    mod: ModuleSymbol

    table: {
        [key in ExpressionType]?: (e: Expression) => Symbol | undefined
    } = {
        FunctionDeclaration: this.analyseFunctionDeclaration.bind(this)
    }

    constructor(ast: ProgramExpression) {
        this.ast = ast

        this.mod = {
            kind: "module",
            name: "root",
            functions: []
        }
    }

    analyse() {
        for (const e of this.ast.body) {
            this.table[e.type]?.(e)
        }

        return this.mod
    }

    analyseFunctionDeclaration(e: Expression): FunctionSymbol {
        const fn = e as FunctionDeclaration

        const symbol: FunctionSymbol = {
            kind: "function",
            name: fn.name.value,
            params: [],
            variables: []
        }

        for (const p of fn.params) {
            const param: VariableSymbol = {
                kind: "variable",
                name: p.name.value,
                type: createEmptySlot()
            }

            symbol.params.push(param)
        }

        for (const expr of fn.body) {
            if (expr.type === "VariableDeclaration") {
                const v = expr as VariableDeclaration

                const slot = createEmptySlot()

                
                // switch (v.value.type) {
                //     case "NumberLiteral": {
                //         const num = v.value as NumberLiteral
                //         slot.type = {
                //             kind: "int",
                //             size: 32
                //         } as IntType
                //     }
                //     case "Identifier": {
                //         //.. ???? i need the scope what da fukkk
                //     }
                // }

                const variable: VariableSymbol = {
                    kind: "variable",
                    name: v.name.value,
                    type: slot
                }


                symbol.variables.push(variable)
            }
        }

        this.mod.functions.push(symbol)

        return symbol
    }
}