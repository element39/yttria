import { Expression, ExpressionType, FunctionDeclaration, ProgramExpression, VariableDeclaration } from "../parser/ast";
import { FunctionSymbol, ModuleSymbol, ProgramSymbol, SemanticScope, Symbol, VariableSymbol } from "./symbols";
import { createTypeHolder } from "./types";

export class SemanticAnalyser {
    asts: ProgramExpression[]
    moduleName: string

    moduleScope: SemanticScope = new SemanticScope()
    scope: SemanticScope = this.moduleScope

    table: { [key in ExpressionType]?: (t: Expression) => Symbol | null } = {
            FunctionDeclaration: this.visitFunctionDeclaration.bind(this),
            VariableDeclaration: this.visitVariableDeclaration.bind(this),
    }

    constructor(asts: ProgramExpression[], moduleName: string) {
        this.asts = asts
        this.moduleName = moduleName
    }

    analyse(): ModuleSymbol {
        const module: ModuleSymbol = {
            kind: "module",
            name: this.moduleName,
            expression: this.asts[0],
            exports: new Map(),
            scope: this.moduleScope,
            programs: []
        };

        for (const [index, ast] of this.asts.entries()) {
            const program = this.analyseProgram(ast, `file_${index}`);

            module.programs.push(program);

            for (const fn of program.functions) {
                if (fn.expression.modifiers.includes("pub")) {
                    module.exports.set(fn.name, fn);
                }
            }
        }

        for (const program of module.programs) {
            for (const fn of program.functions) {
                this.analyseFunction(fn)
            }
        }

        return module;
    }

    analyseProgram(ast: ProgramExpression, name: string): ProgramSymbol {
        const program: ProgramSymbol = {
            kind: "program",
            functions: [],
            expression: ast,
            name
        }

        this.scope = this.moduleScope

        for (const expr of ast.body) {
            const symbol = this.table[expr.type]?.(expr)

            if (symbol) {
                this.scope.set(symbol)
            }

            switch (symbol?.kind) {
                case "function":
                    program.functions.push(symbol as FunctionSymbol)
                    break
            }
        }

        return program
    }

    analyseFunction(fn: FunctionSymbol): void {
        this.scope = fn.scope

        for (const ex of fn.expression.body) {
            const symbol = this.table[ex.type]?.(ex)

            switch (symbol?.kind) {
                case "variable": {
                    this.scope.set(symbol)
                    break
                }
            }
        }

        this.scope = this.scope.pop()
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

        // for (const ex of fn.body) {
        //     const symbol = this.table[ex.type]?.(ex)

        //     switch (symbol?.kind) {
        //         case "variable": {
        //             const variable = symbol as VariableSymbol
        //             this.scope.set(variable)
        //             //fns.variables.push(variable)
        //         }
        //     }
        // }

        this.scope = this.scope.pop()
        return fns
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
}