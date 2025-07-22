import { BinaryExpression, CaseExpression, ElseExpression, Expression, ExpressionType, FunctionCall, FunctionDeclaration, Identifier, IfExpression, PostUnaryExpression, PreUnaryExpression, ProgramExpression, ReturnExpression, SwitchExpression, VariableDeclaration, WhileExpression } from "../parser/ast"
import { CheckerSymbol, CheckerType } from "./types"

export class Typechecker {
    src: ProgramExpression
    ast: ProgramExpression = { type: "Program", body: [] }
    
    types: Record<string, CheckerType> = {
        int:    { kind: "type", type: "int" },
        i8:     { kind: "type", type: "i8" },
        i16:    { kind: "type", type: "i16" },
        i32:    { kind: "type", type: "i32" },
        i64:    { kind: "type", type: "i64" },
        float:  { kind: "type", type: "float" },
        string: { kind: "type", type: "string" },
        bool:   { kind: "type", type: "bool" },
        void:   { kind: "type", type: "void" },
        null:   { kind: "type", type: "null" },
    }
    
    symbols: Record<string, CheckerSymbol>[] = [{}]
    
    table: { [K in ExpressionType]?: (e: any) => Expression } = {
        VariableDeclaration:  this.checkVariableDeclaration.bind(this),
        FunctionDeclaration:  this.checkFunctionDeclaration.bind(this),
        IfExpression:         this.checkIfExpression.bind(this),
        ElseExpression:       this.checkElseExpression.bind(this),
        SwitchExpression:     this.parseSwitchExpression.bind(this),
        WhileExpression:      this.checkWhileExpression.bind(this),
        Identifier:           this.checkIdentifier.bind(this),
        BinaryExpression:     this.checkBinaryExpression.bind(this),
        PreUnaryExpression:   this.checkPreUnaryExpression.bind(this),
        PostUnaryExpression:  this.checkPostUnaryExpression.bind(this),
        ReturnExpression:     this.checkReturnExpression.bind(this),
    }

    private pushScope() {
        this.symbols.push({})
    }

    private popScope() {
        this.symbols.pop()
    }

    private get currentScope(): Record<string, CheckerSymbol> {
        return this.symbols[this.symbols.length - 1]
    }

    private pushSymbol(name: string, symbol: CheckerSymbol) {
        this.currentScope[name] = symbol
    }

    private getSymbol(name: string): CheckerSymbol | undefined {
        // forgot about array.find()
        return this.symbols.find(scope => name in scope)?.[name]
    }

    private inferTypeFromValue(value: Expression): CheckerSymbol {
        const v = this.checkExpression(value)
        switch (v.type) {
            case "NumberLiteral":
                return this.types.int
            case "StringLiteral":
                return this.types.string
            case "BooleanLiteral":
                return this.types.bool
            case "NullLiteral":
                return this.types.null

            case "Identifier":
                const symbol = this.getSymbol((v as Identifier).value)
                if (!symbol) {
                    throw new Error(`Identifier "${(v as Identifier).value}" is not defined`)
                }
                return symbol

            case "BinaryExpression":
                const leftType = this.inferTypeFromValue((v as BinaryExpression).left)
                const rightType = this.inferTypeFromValue((v as BinaryExpression).right)

                const op = (v as BinaryExpression).operator
                const numericOps = ["+", "-", "*", "/"];
                if (numericOps.includes(op)) {
                    const validTypes = [
                        "int",
                        "i8",
                        "i16",
                        "i32",
                        "i64",

                        "float",
                    ]

                    if (!validTypes.includes(leftType.type) || !validTypes.includes(rightType.type)) {
                        throw new Error(`Invalid types for operator "${op}": ${leftType.type} and ${rightType.type}`);
                    }
                
                    if (leftType.type !== rightType.type) {
                        throw new Error(`Cannot perform "${op}" on different types: ${leftType.type} and ${rightType.type}`);
                    }

                    return leftType;
                }

                const comparisonOps = ["==", "!=", "<", ">", "<=", ">="];
                if (comparisonOps.includes(op)) {
                    if (leftType.type !== rightType.type) {
                        throw new Error(`Cannot compare different types: ${leftType.type} and ${rightType.type}`);
                    }
                    if (leftType.type === "null") {
                        throw new Error(`Cannot compare null with "${op}"`);
                    }
                    return this.types.bool;
                }

                throw new Error(`Cannot infer type for binary expression with operator "${op}" and types "${leftType.type}" and "${rightType.type}"`)
            
            case "PreUnaryExpression":
                const operandType = this.inferTypeFromValue((v as PreUnaryExpression).operand)
                if ((v as PreUnaryExpression).operator === "!") {
                    if (operandType.type !== "bool") {
                        throw new Error(`Operand for "!" must be a boolean, but got ${operandType.type}`);
                    }
                    return this.types.bool
                } else if ((v as PreUnaryExpression).operator === "-") {
                    if (operandType.type !== "int" && operandType.type !== "float") {
                        throw new Error(`Operand for "-" must be a number, but got ${operandType.type}`);
                    }
                    return operandType
                }
                throw new Error(`Unknown unary operator: ${(v as PreUnaryExpression).operator}`)
            
            case "PostUnaryExpression":
                const postTy = this.inferTypeFromValue((v as PostUnaryExpression).operand);
                if ((v as PostUnaryExpression).operator === "++" || (v as PostUnaryExpression).operator === "--") {
                    if (postTy.type !== "int" && postTy.type !== "float") {
                        throw new Error(`Operand for post-unary operator must be a number, but got ${postTy.type}`);
                    }
                    return postTy;
                }

                throw new Error(`Unknown post-unary operator: ${(v as PostUnaryExpression).operator}`);
            case "FunctionCall":
                const call = v as FunctionCall
                const funcSymbol = this.getSymbol(call.callee.value);
                if (!funcSymbol) {
                    throw new Error(`Function "${call.callee.value}" is not defined`);
                }
                if (funcSymbol.kind !== "function") {
                    throw new Error(`"${call.callee.value}" is not a function`);
                }
                return funcSymbol.returnType;
            default:
                throw new Error(`Cannot infer type from value of type: ${v.type}`)
        }
    }

    private resolveTypeAnnotation(identifier: Identifier): CheckerType {
        const typeSymbol = this.types[identifier.value];
        if (!typeSymbol) {
            throw new Error(`Type "${identifier.value}" is not defined`);
        }
        return typeSymbol;
    }

    constructor(program: ProgramExpression) {
        this.src = program
    }

    public check(): ProgramExpression {
        for (const expr of this.src.body) {
            const checked = this.checkExpression(expr)
            this.ast.body.push(checked)
        }
        
        return this.ast
    }

    private checkExpression(expr: Expression): Expression {
        if (expr.type in this.table) {
            const e = this.table[expr.type]!(expr)
            return e
        }
        
        return expr
    }

    private checkVariableDeclaration(expr: VariableDeclaration): Expression {
        const { name, value, typeAnnotation, mutable } = expr;

        if (this.getSymbol(name.value)) {
            throw new Error(`Variable "${name.value}" is already declared`)
        }

        if (!typeAnnotation && !value) {
            throw new Error(`Variable "${name.value}" must have a type annotation or an initial value`)
        }

        let resolvedType: CheckerSymbol;
        if (typeAnnotation) {
            resolvedType = this.resolveTypeAnnotation(typeAnnotation);
        } else {
            if (!value) {
                throw new Error(`Variable "${name.value}" must have a type annotation or an initial value`)
            }
            const valueType = this.inferTypeFromValue(value);
            resolvedType = valueType;
        }

        this.pushSymbol(name.value, { kind: "variable", type: resolvedType.type });
        return { ...expr, resolvedType, mutable } as VariableDeclaration;
    }

    private checkFunctionDeclaration(expr: FunctionDeclaration): Expression {
        const { name, params, returnType, body } = expr;
        if (this.getSymbol(name.value)) {
            throw new Error(`Function "${name.value}" is already declared`);
        }

        this.pushScope();

        for (const param of params) {
            if (this.getSymbol(param.name.value)) {
                throw new Error(`Parameter "${param.name.value}" is already declared`);
            }
            if (!param.paramType) {
                throw new Error(`Parameter "${param.name.value}" must have a type annotation`);
            }
            const pType = this.resolveTypeAnnotation(param.paramType);
            this.pushSymbol(param.name.value, pType);
        }

        const checkedBody: Expression[] = [];

        for (const stmt of body) {
            if (stmt.type === "VariableDeclaration") {
                checkedBody.push(this.checkVariableDeclaration(stmt as VariableDeclaration));
            } else if (stmt.type === "ReturnExpression") {
                const r = stmt as ReturnExpression;
                r.value = this.checkExpression(r.value);
                checkedBody.push(r);
            } else {
                checkedBody.push(this.checkExpression(stmt));
            }
        }

        const hoistVars = (exprs: Expression[]) => {
            for (const e of exprs) {
                if (e.type === "VariableDeclaration") {
                    const vd = e as VariableDeclaration;
                    this.pushSymbol(vd.name.value, vd.resolvedType!);
                }
                else if (e.type === "IfExpression") {
                    const ie = e as IfExpression;
                    hoistVars(ie.body);
                    if (ie.alternate) {
                        if (ie.alternate.type === "IfExpression") {
                            hoistVars([(ie.alternate as IfExpression)]);
                        } else {
                            hoistVars((ie.alternate as ElseExpression).body);
                        }
                    }
                }
            }
        };
        hoistVars(checkedBody);

        let resolvedReturnType: CheckerSymbol;
        const findReturns = (stmts: Expression[]): ReturnExpression[] => {
            let outs: ReturnExpression[] = [];
            for (const s of stmts) {
                if (s.type === "ReturnExpression") {
                    outs.push(s as ReturnExpression);
                } else if (s.type === "IfExpression") {
                    const ie = s as IfExpression;
                    outs = outs.concat(findReturns(ie.body));
                    if (ie.alternate) {
                        outs = outs.concat(findReturns(ie.alternate.body));
                    }
                }
            }
            return outs;
        };

        const returns = findReturns(checkedBody);

        if (returnType) {
            resolvedReturnType = this.resolveTypeAnnotation(returnType);
            returns.forEach((ret) => {
                const retType = this.inferTypeFromValue(ret.value);
                if (retType.type !== resolvedReturnType.type) {
                    throw new Error(`Return type mismatch: expected ${resolvedReturnType.type}, got ${retType.type}`);
                }
            });
        } else {
            if (returns.length > 0) {
                const firstReturnType = this.inferTypeFromValue(returns[0].value);
                for (const ret of returns.slice(1)) {
                    const retType = this.inferTypeFromValue(ret.value);
                    if (retType.type !== firstReturnType.type) {
                        throw new Error(`Return type mismatch: expected ${firstReturnType.type}, got ${retType.type}`);
                    }
                }
                resolvedReturnType = firstReturnType;
            } else {
                resolvedReturnType = this.types.void;
            }
        }

        this.popScope();
        this.pushSymbol(name.value, {
            kind: "function",
            type: "function",
            returnType: resolvedReturnType,
            paramTypes: params.map(p => this.resolveTypeAnnotation(p.paramType))
        });
        return { ...expr, resolvedReturnType, body: checkedBody } as FunctionDeclaration;
    }

    private checkIdentifier(expr: Identifier): Expression {
        const symbol = this.getSymbol(expr.value);
        if (!symbol) {
            throw new Error(`Identifier "${expr.value}" is not defined`);
        }
        
        return expr;
    }

    private checkIfExpression(expr: IfExpression): Expression {
        const condition = this.checkExpression(expr.condition)
        const conditionType = this.inferTypeFromValue(condition)

        if (conditionType.type !== "bool") {
            throw new Error(`If-condition must be boolean, got ${conditionType.type}`)
        }

        this.pushScope()
            const body = expr.body.map((s) => this.checkExpression(s))
        this.popScope()

        let alternate: IfExpression["alternate"]
        if (expr.alternate) {
            alternate = this.checkExpression(expr.alternate) as typeof alternate
        }

        return {
            type: "IfExpression",
            condition,
            body,
            alternate
        } as IfExpression
    }

    private checkElseExpression(expr: ElseExpression): Expression {
        this.pushScope()
        const body = expr.body.map(s => this.checkExpression(s))
        this.popScope()
        return { ...expr, body } as ElseExpression
    }

    private checkWhileExpression(expr: WhileExpression): Expression {
        const condition = this.checkExpression(expr.condition)
        const conditionType = this.inferTypeFromValue(condition)

        if (conditionType.type !== "bool") {
            throw new Error(`While condition must be boolean, got ${conditionType.type}`)
        }

        this.pushScope()
            const body = expr.body.map((s) => this.checkExpression(s))
        this.popScope()

        return { ...expr, condition, body } as WhileExpression
    }

    private parseSwitchExpression(expr: SwitchExpression): Expression {
        const value = this.checkExpression(expr.value);
        const valueType = this.inferTypeFromValue(value);

        if (valueType.type === "null") {
            throw new Error("Switch expression cannot switch on null");
        }

        const cases: CaseExpression[] = [];
        for (const caseExpr of expr.cases) {
            const value = caseExpr.value === "default" ? "default" : this.checkExpression(caseExpr.value);
            const body = caseExpr.body.map(s => this.checkExpression(s));

            if (value !== "default" && this.inferTypeFromValue(value).type !== valueType.type) {
                throw new Error(`Case value type mismatch: expected ${valueType.type}, got ${this.inferTypeFromValue(value).type}`);
            }

            cases.push({ ...caseExpr, value, body } as CaseExpression);
        }

        return { ...expr, value, cases } as SwitchExpression;
    }

    private checkBinaryExpression(expr: BinaryExpression): Expression {
        const left  = this.checkExpression(expr.left)
        const right = this.checkExpression(expr.right)

        const lType = this.inferTypeFromValue(left)
        const rType = this.inferTypeFromValue(right)
        
        const numericOps = ["+", "-", "*", "/"];
        const comparisonOps = ["==", "!=", "<", ">", "<=", ">="];
        if (numericOps.includes(expr.operator)) {
            const validTypes = [
                "int",
                "i8",
                "i16",
                "i32",
                "i64",

                "float",
            ]

            if (!validTypes.includes(lType.type) || !validTypes.includes(rType.type)) {
                throw new Error(`Invalid types for operator "${expr.operator}": ${lType.type} and ${rType.type}`);
            }
        
            if (lType.type !== rType.type) {
                throw new Error(`Cannot perform "${expr.operator}" on different types: ${lType.type} and ${rType.type}`);
            }

            return { ...expr, left, right } as BinaryExpression;
        }

        if (comparisonOps.includes(expr.operator)) {
            if (lType.type !== rType.type) {
                throw new Error(`Cannot compare different types: ${lType.type} and ${rType.type}`);
            }
            if (lType.type === "null") {
                throw new Error(`Cannot compare null with "${expr.operator}"`);
            }
            return { ...expr, left, right } as BinaryExpression;
        }

        if (["&&", "||"].includes(expr.operator)) {
            if (lType.type !== "bool") {
                throw new Error(`Left operand for "${expr.operator}" must be a boolean, but got ${lType.type}`);
            }
            if (rType.type !== "bool") {
                throw new Error(`Right operand for "${expr.operator}" must be a boolean, but got ${rType.type}`);
            }
        }

        if (expr.operator === "++" || expr.operator === "--") {
            if (lType.type !== "int") {
                throw new Error(`Operand for "${expr.operator}" must be an integer, but got ${lType.type}`);
            }
        }

        return { ...expr, left, right } as BinaryExpression
    }

    private checkPreUnaryExpression(expr: PreUnaryExpression): Expression {
        const operand = this.checkExpression(expr.operand)
        const ty = this.inferTypeFromValue(operand)

        if (expr.operator === "!") {
            if (ty.type !== "bool") {
                throw new Error(`Operand for "!" must be a boolean, but got ${ty.type}`);
            }
            return { ...expr, operand } as Expression
        }

        if (expr.operator === "-") {
            if (ty.type !== "int" && ty.type !== "float") {
                throw new Error(`Operand for "-" must be a number, but got ${ty.type}`);
            }
            return { ...expr, operand } as Expression
        }

        throw new Error(`Unknown unary operator: ${expr.operator}`);
    }

    private checkPostUnaryExpression(expr: PostUnaryExpression): Expression {
        const operand = this.checkExpression(expr.operand);
        const ty = this.inferTypeFromValue(operand);

        if (expr.operator === "++" || expr.operator === "--") {
            if (ty.type !== "int" && ty.type !== "float") {
                throw new Error(`Operand for "${expr.operator}" must be a number, but got ${ty.type}`);
            }

            if (operand.type !== 'Identifier') {
                 throw new Error(`Operand for "${expr.operator}" must be an assignable identifier.`);
            }
            return { ...expr, operand } as Expression;
        }

        throw new Error(`Unknown post-unary operator: ${expr.operator}`);
    }

    private checkReturnExpression(expr: ReturnExpression): Expression {
        expr.value = this.checkExpression(expr.value)
        return expr
    }
}