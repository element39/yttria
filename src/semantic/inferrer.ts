import { BinaryExpression, ElseExpression, Expression, ExpressionType, FunctionCall, Identifier, IfExpression, MemberAccess, NumberLiteral, PreUnaryExpression, ReturnExpression, WhileExpression } from "../parser/ast"
import { FunctionSymbol, ModuleSymbol, ProgramSymbol, SemanticScope, Symbol, SymbolKind, VariableSymbol } from "./symbols"
import { FloatType, IntType, NullType, TypeValue } from "./types"

export class SemanticInferrer {
    resolvedModules: Map<string, ModuleSymbol>
    scope!: SemanticScope

    symbols: {
        [key in SymbolKind]?: (s: Symbol) => Symbol
    } = {
        function: this.inferFunction.bind(this),
        variable: this.inferVariable.bind(this),
    }

    expressions: {
        [key in ExpressionType]?: (e: Expression) => TypeValue
    } = {
        NumberLiteral: this.inferNumberLiteral.bind(this),
        BooleanLiteral: this.inferBooleanLiteral.bind(this),
        StringLiteral: this.inferStringLiteral.bind(this),
        NullLiteral: this.inferNullLiteral.bind(this),
        PreUnaryExpression: this.inferPreUnaryExpression.bind(this),
        PostUnaryExpression: this.inferPostUnaryExpression.bind(this),
        BinaryExpression: this.inferBinaryExpression.bind(this),
        Identifier: this.inferIdentifier.bind(this),
        IfExpression: this.inferIfExpression.bind(this),
        ElseExpression: this.inferElseExpression.bind(this),
        WhileExpression: this.inferWhileExpression.bind(this),
        ReturnExpression: this.inferReturnExpression.bind(this),
        FunctionCall: this.inferFunctionCall.bind(this),
        MemberAccess: this.inferMemberAccess.bind(this)
    }

    currentFunction?: FunctionSymbol

    constructor(resolvedModules: Map<string, ModuleSymbol>) {
        this.resolvedModules = resolvedModules
    }

    infer(): Map<string, ModuleSymbol> {
        for (const module of this.resolvedModules.values()) {
            for (const program of module.programs) {
                this.inferProgram(program)
            }
        }

        return this.resolvedModules
    }

    inferProgram(program: ProgramSymbol): ProgramSymbol {
        for (const fn of program.functions) {
            this.symbols[fn.kind]?.(fn)
        }

        return program
    }

    inferFunction(s: Symbol): Symbol {
        const fn = s as FunctionSymbol
        this.currentFunction = fn
        this.scope = fn.scope

        for (const symbol of fn.scope.symbols.values()) {
            this.symbols[symbol.kind]?.(symbol)
        }

        for (const expression of fn.expression.body) {
            const type = this.expressions[expression.type]?.(expression)
        }

        if (fn.returnType.type === undefined || fn.returnType.type.kind === "null") {
            fn.returnType.type = {
                kind: "null"
            }
        }

        this.scope = this.scope.pop()

        return fn
    }

    inferVariable(s: Symbol): Symbol {
        const v = s as VariableSymbol

        if (v.expression.type !== "VariableDeclaration") {
            return v
        }

        const type = this.expressions[v.expression.value.type]?.(
            v.expression.value
        )

        if (!type) {
            throw new Error(
                `cannot infer type of ${v.expression.value.type}`
            )
        }

        if (!v.expression.typeAnnotation) {
            v.typeHolder.type = type
        }

        return v
    }

    inferIdentifier(e: Expression): TypeValue {
        const id = e as Identifier

        const symbol = this.scope.find(id.value)

        if (!symbol) {
            throw new Error(`unknown identifier "${id.value}"`)
        }

        if (symbol.kind !== "variable") {
            throw new Error(`"${id.value}" is not a variable`)
        }

        const variable = symbol as VariableSymbol
        if (!variable.typeHolder.type) {
            throw new Error(`type of "${id.value}" is unresolved`)
        }

        e.inferredType = variable.typeHolder.type
        return variable.typeHolder.type
    }

    inferBinaryExpression(e: Expression): TypeValue {
        const b = e as BinaryExpression

        const left = this.expressions[b.left.type]?.(b.left)
        const right = this.expressions[b.right.type]?.(b.right)

        if (!left || !right) {
            throw new Error(`cannot infer binary expression`)
        }

        if (left.kind !== right.kind) {
            throw new Error(
                `cannot apply "${b.operator}" to ${left.kind} and ${right.kind}`
            )
        }

        let type: TypeValue

        switch (b.operator) {
            case "+":
            case "-":
            case "*":
            case "/":
                type = right
                break

            case "==":
            case "!=":
            case "<":
            case ">":
            case "<=":
            case ">=":
                type = {
                    kind: "bool"
                }
                break

            default:
                throw new Error(`unknown operator "${b.operator}"`)
        }

        e.inferredType = type

        return type
    }
    
    inferIfExpression(e: Expression): TypeValue {
        const i = e as IfExpression

        const cond = this.expressions[i.condition.type]?.(i.condition)
        if (!cond || cond.kind !== "bool") {
            throw new Error(`condition of if expression must be a boolean`)
        }
        i.inferredType = cond

        for (const expr of i.body) {
            const type = this.expressions[expr.type]?.(expr)
        }

        if (i.alternate) {
            const type = this.expressions[i.alternate.type]?.(i.alternate)
        }

        return cond
    }

    inferElseExpression(e: Expression): TypeValue {
        const i = e as ElseExpression

        for (const expr of i.body) {
            this.expressions[expr.type]?.(expr)
        }

        const type: NullType = {
            kind: "null"
        }

        e.inferredType = type
        return type
    }

    inferWhileExpression(e: Expression): TypeValue {
        const w = e as WhileExpression
        const cond = this.expressions[w.condition.type]?.(w.condition)
        if (!cond || cond.kind !== "bool") {
            throw new Error(`condition of while expression must be a boolean`)
        }
        w.inferredType = cond

        for (const expr of w.body) {
            const type = this.expressions[expr.type]?.(expr)
        }

        return cond
    }

    inferReturnExpression(e: Expression): TypeValue {
        const r = e as ReturnExpression
        const type = this.expressions[r.value.type]?.(r.value)

        if (!type) {
            throw new Error(
                `cannot infer return expression of type ${r.value.type}`
            )
        }

        e.inferredType = type

        if (this.currentFunction && !this.currentFunction.returnType.type) {
            this.currentFunction.returnType.type = type
        }

        return type
    }

    inferNumberLiteral(e: Expression): TypeValue {
        const n = e as NumberLiteral

        const type: TypeValue = Number.isInteger(n.value)
            ? {
                kind: "int",
            } as IntType
            : {
                kind: "float"
            } as FloatType

        e.inferredType = type
        return type
    }

    inferBooleanLiteral(e: Expression): TypeValue {
        const type: TypeValue = {
            kind: "bool"
        }

        e.inferredType = type
        return type
    }

    inferStringLiteral(e: Expression): TypeValue {
        const type: TypeValue = {
            kind: "string"
        }

        e.inferredType = type
        return type
    }

    inferNullLiteral(e: Expression): TypeValue {
        const type: NullType = {
            kind: "null"
        }

        e.inferredType = type
        return type
    }

    inferFunctionCall(e: Expression): TypeValue {
        const c = e as FunctionCall

        let fn: FunctionSymbol

        if (c.callee.type === "Identifier") {
            const name = (c.callee as Identifier).value
            const symbol = this.scope.find(name)

            if (!symbol) {
                throw new Error(`unknown function "${name}"`)
            }

            if (symbol.kind !== "function") {
                throw new Error(`"${name}" is not a function`)
            }

            fn = symbol as FunctionSymbol
        } else {
            const m = c.callee as MemberAccess

            if (m.object.type !== "Identifier") {
                throw new Error(
                    `unsupported member access target ${m.object.type}`
                )
            }

            const moduleName = (m.object as Identifier).value
            const symbol = this.scope.find(moduleName)

            if (!symbol) {
                throw new Error(`unknown module "${moduleName}"`)
            }

            if (symbol.kind !== "module") {
                throw new Error(`"${moduleName}" is not a module`)
            }

            const module = symbol as ModuleSymbol
            const exported = module.exports.get(m.property.value)

            if (!exported) {
                throw new Error(
                    `"${m.property.value}" is not exported by "${module.name}"`
                )
            }

            if (exported.kind !== "function") {
                throw new Error(
                    `"${m.property.value}" is not a function`
                )
            }

            fn = exported as FunctionSymbol
        }

        for (const arg of c.args) {
            const type = this.expressions[arg.type]?.(arg)

            if (!type) {
                throw new Error(
                    `cannot infer argument of type ${arg.type}`
                )
            }
        }

        if (!fn.returnType.type) {
            const currentScope = this.scope;
            this.inferFunction(fn);
            this.scope = currentScope;
        }

        if (!fn.returnType.type) { // ugh hate u typescript
            throw new Error(
                `could not infer return type of "${fn.name}"`
            )
        }

        e.inferredType = fn.returnType.type
        return fn.returnType.type
    }

    inferMemberAccess(e: Expression): TypeValue {
        const m = e as MemberAccess;

        if (m.object.type !== "Identifier") {
            throw new Error(`unsupported member access target ${m.object.type}`);
        }

        const moduleName = (m.object as Identifier).value;
        const symbol = this.scope.find(moduleName);

        if (!symbol) {
            throw new Error(`unknown module "${moduleName}"`);
        }

        if (symbol.kind !== "module") {
            throw new Error(`"${moduleName}" is not a module`);
        }

        const module = symbol as ModuleSymbol;
        const member = module.exports.get(m.property.value);

        if (!member) {
            throw new Error(
                `"${m.property.value}" is not exported by "${module.name}"`
            );
        }

        if (member.kind !== "function") {
            throw new Error(
                `"${m.property.value}" is not a function`
            );
        }

        const fn = member as FunctionSymbol;

        if (!fn.returnType.type) {
            throw new Error(
                `return type of "${m.property.value}" is unresolved`
            );
        }

        e.inferredType = fn.returnType.type;
        return fn.returnType.type;
    }

    inferPreUnaryExpression(e: Expression): TypeValue {
        const u = e as PreUnaryExpression
        const type = this.expressions[u.operand.type]?.(u.operand)

        if (!type) {
            throw new Error(`cannot infer type of ${u.operand.type}`)
        }

        switch (u.operator) {
            case "-":
                if (type.kind !== "int" && type.kind !== "float") {
                    throw new Error(`cannot apply "${u.operator}" to ${type.kind}`)
                }
                break
            case "!":
                if (type.kind !== "bool") {
                    throw new Error(`cannot apply "${u.operator}" to ${type.kind}`)
                }
                break
            default:
                throw new Error(`unknown operator "${u.operator}"`)
        }

        e.inferredType = type
        return type
    }
    
    inferPostUnaryExpression(e: Expression): TypeValue {
        const u = e as PreUnaryExpression
        const type = this.expressions[u.operand.type]?.(u.operand)

        if (!type) {
            throw new Error(`cannot infer type of ${u.operand.type}`)
        }

        switch (u.operator) {
            case "++":
            case "--":
                if (type.kind !== "int" && type.kind !== "float") {
                    throw new Error(`cannot apply "${u.operator}" to ${type.kind}`)
                }
                break
            default:
                throw new Error(`unknown operator "${u.operator}"`)
        }

        e.inferredType = type
        return type
    }
}