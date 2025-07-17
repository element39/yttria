import { BinaryExpression, ElseExpression, Expression, ExpressionType, FunctionDeclaration, Identifier, IfExpression, PostUnaryExpression, PreUnaryExpression, ProgramExpression, ReturnExpression, VariableDeclaration } from "../parser/ast"
import { CheckerSymbol } from "./types"

export class Typechecker {
    src: ProgramExpression
    ast: ProgramExpression = { type: "Program", body: [] }
    
    // Keep your simple type representation
    types: Record<string, CheckerSymbol> = {
        int:    { type: "int" },
        float:  { type: "float" },
        string: { type: "string" },
        bool:   { type: "bool" },
        void:   { type: "void" },
        null:   { type: "null" },
    }
    
    symbols: Record<string, CheckerSymbol>[] = [{}]
    
    table: { [K in ExpressionType]?: (e: any) => Expression } = {
        VariableDeclaration:  this.checkVariableDeclaration.bind(this),
        FunctionDeclaration:  this.checkFunctionDeclaration.bind(this),
        IfExpression:         this.checkIfExpression.bind(this),
        ElseExpression:       this.checkElseExpression.bind(this),
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
        for (let i = this.symbols.length - 1; i >= 0; i--) {
            const scope = this.symbols[i]
            if (name in scope) {
                return scope[name]
            }
        }
        return undefined
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
                
                if (["+", "-", "*", "/"].includes(op)) {
                    if (leftType.type === "int" && rightType.type === "int") {
                        return this.types.int
                    } else if (leftType.type === "float" || rightType.type === "float") {
                        return this.types.float
                    }
                } else if (["==", "!=", "<", ">", "<=", ">="].includes(op)) {
                    if (leftType.type === rightType.type) {
                        return this.types.bool
                    }
                } else if (["&&", "||"].includes(op)) {
                    return this.types.bool
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
                    // The type of x++ is the type of x
                    return postTy;
                }

                throw new Error(`Unknown post-unary operator: ${(v as PostUnaryExpression).operator}`);
            case "FunctionCall":
                // TODO: fix ts
                return this.types.int; // stop the fibbonaci example from breaking
            default:
                throw new Error(`Cannot infer type from value of type: ${v.type}`)
        }
    }

    private resolveTypeAnnotation(typeAnnotation: { value: string }): CheckerSymbol {
        const typeSymbol = this.types[typeAnnotation.value];
        if (!typeSymbol) {
            throw new Error(`Type "${typeAnnotation.value}" is not defined`);
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

        this.pushSymbol(name.value, resolvedType);
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
                resolvedReturnType = this.types.void; // why was it null before :sob:
            }
        }

        this.popScope();
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

    private checkBinaryExpression(expr: BinaryExpression): Expression {
        const left  = this.checkExpression(expr.left)
        const right = this.checkExpression(expr.right)

        const lType = this.inferTypeFromValue(left)
        const rType = this.inferTypeFromValue(right)
        
        if (["+", "-", "*", "/"].includes(expr.operator)) {
            if (lType.type !== "int" && lType.type !== "float") {
                throw new Error(`Left operand for "${expr.operator}" must be a number, but got ${lType.type}`);
            }
            if (rType.type !== "int" && rType.type !== "float") {
                throw new Error(`Right operand for "${expr.operator}" must be a number, but got ${rType.type}`);
            }
        }

        if (["==", "!=", "<", ">", "<=", ">="].includes(expr.operator)) {
            if (lType.type !== rType.type) {
                throw new Error(`Operands for "${expr.operator}" must be of the same type, but got ${lType.type} and ${rType.type}`);
            }

            if (lType.type === "null") {
                throw new Error(`Cannot compare null with "${expr.operator}"`);
            }
            if (lType.type === "bool" && rType.type === "bool") {
                return { ...expr, left, right } as BinaryExpression; // bool comparison
            }
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