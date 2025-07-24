import { BinaryExpression, CaseExpression, ElseExpression, Expression, ExpressionType, FunctionCall, FunctionDeclaration, Identifier, IfExpression, MemberAccess, PostUnaryExpression, PreUnaryExpression, ProgramExpression, ReturnExpression, SwitchExpression, VariableDeclaration, WhileExpression } from "../parser/ast"
import { ResolvedModule } from "../module/types"
import { CheckerSymbol, CheckerType } from "./types"

export class Typechecker {
    src: ProgramExpression
    modules: Record<string, ResolvedModule>
    ast: ProgramExpression = { type: "Program", body: [] }
    
    types: Record<string, CheckerType> = {
        int:    { kind: "type", type: "int" },
        i8:     { kind: "type", type: "i8" },
        i16:    { kind: "type", type: "i16" },
        i32:    { kind: "type", type: "i32" },
        i64:    { kind: "type", type: "i64" },
        float:  { kind: "type", type: "float" },
        string: { kind: "type", type: "string" },
        str:    { kind: "type", type: "string" }, // alias for string
        bool:   { kind: "type", type: "bool" },
        void:   { kind: "type", type: "void" },
        null:   { kind: "type", type: "null" },
    }
    
    symbols: Record<string, CheckerSymbol>[] = [{}]
    
    table: { [K in ExpressionType]?: (e: any) => Expression } = {
        MemberAccess:         this.checkMemberAccess.bind(this),
        VariableDeclaration:  this.checkVariableDeclaration.bind(this),
        FunctionDeclaration:  this.checkFunctionDeclaration.bind(this),
        FunctionCall:         this.checkFunctionCall.bind(this),
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
                let funcSymbol: CheckerSymbol | undefined;
                let functionName: string;
                
                if (call.callee.type === "Identifier") {
                    const identifier = call.callee as Identifier;
                    functionName = identifier.value;
                    funcSymbol = this.getSymbol(identifier.value);
                } else if (call.callee.type === "MemberAccess") {
                    const memberAccess = call.callee as MemberAccess;
                    if (memberAccess.object.type === "Identifier" && memberAccess.property.type === "Identifier") {
                        const objectName = (memberAccess.object as Identifier).value;
                        const propertyName = (memberAccess.property as Identifier).value;
                        functionName = `${objectName}.${propertyName}`;
                        
                        // Look up the module symbol
                        const moduleSymbol = this.getSymbol(objectName);
                        if (moduleSymbol && moduleSymbol.kind === "module") {
                            const moduleSymbolTyped = moduleSymbol as any; // CheckerModule
                            funcSymbol = moduleSymbolTyped.exports.get(propertyName);
                            if (!funcSymbol) {
                                throw new Error(`Module "${objectName}" does not export function "${propertyName}"`);
                            }
                        } else {
                            throw new Error(`"${objectName}" is not a module`);
                        }
                    } else {
                        throw new Error(`Invalid member access in function call`);
                    }
                } else {
                    throw new Error(`Invalid callee type in function call: ${call.callee.type}`);
                }
                
                if (!funcSymbol) {
                    throw new Error(`Function "${functionName}" is not defined`);
                }
                if (funcSymbol.kind !== "function") {
                    throw new Error(`"${functionName}" is not a function`);
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

    constructor(program: ProgramExpression, modules: Record<string, ResolvedModule> = {}) {
        this.src = program
        this.modules = modules
        this.setupModuleSymbols()
    }

    private setupModuleSymbols() {
        // Set up module namespace symbols for imported modules
        for (const expr of this.src.body) {
            if (expr.type === "ImportExpression") {
                const importExpr = expr as any; // ImportExpression type
                const modulePath = importExpr.path;
                const module = this.modules[modulePath];
                
                if (module) {
                    // Create a namespace symbol for the module
                    // For now, we'll use the last part of the path as the namespace name
                    const namespaceName = modulePath.split('/').pop() || modulePath;
                    
                    // Create a module symbol that contains all exported functions
                    const moduleSymbol: CheckerSymbol = {
                        kind: "module",
                        type: "module",
                        exports: new Map()
                    };
                    
                    // Add exported functions to the module symbol
                    for (const exportedExpr of module.exports) {
                        if (exportedExpr.type === "FunctionDeclaration") {
                            const funcDecl = exportedExpr as FunctionDeclaration;
                            const paramTypes = funcDecl.params.map(p => {
                                if (!p.paramType) throw new Error(`Parameter "${p.name.value}" missing type annotation`);
                                return this.resolveTypeAnnotation(p.paramType);
                            });
                            const returnType = funcDecl.returnType
                                ? this.resolveTypeAnnotation(funcDecl.returnType)
                                : this.types.void;
                            
                            moduleSymbol.exports.set(funcDecl.name.value, {
                                kind: "function",
                                type: "function",
                                paramTypes,
                                returnType
                            });
                        }
                    }
                    
                    this.pushSymbol(namespaceName, moduleSymbol);
                }
            }
        }
    }

    public check(): ProgramExpression {
        for (const expr of this.src.body) {
            if (expr.type === "FunctionDeclaration") {
                this.declareFunctionSignature(expr as FunctionDeclaration);
            }
        }

        for (const expr of this.src.body) {
            const checked = this.checkExpression(expr)
            this.ast.body.push(checked)
        }
        return this.ast
    }

    private declareFunctionSignature(expr: FunctionDeclaration): void {
        const name = expr.name.value;
        if (this.getSymbol(name)) {
            throw new Error(`Function "${name}" is already declared`);
        }
        const paramTypes = expr.params.map(p => {
            if (!p.paramType) throw new Error(`Parameter "${p.name.value}" missing type annotation`);
            return this.resolveTypeAnnotation(p.paramType);
        });
        const returnType = expr.returnType
            ? this.resolveTypeAnnotation(expr.returnType)
            : this.types.void;
        this.pushSymbol(name, {
            kind: "function",
            type: "function",
            paramTypes,
            returnType
        });
    }

    private checkExpression(expr: Expression): Expression {
        if (expr.type in this.table) {
            const e = this.table[expr.type]!(expr)
            return e
        }
        return expr
    }

    private checkMemberAccess(expr: MemberAccess): Expression {
        const object = this.checkExpression(expr.object);
        
        // Handle module member access
        if (object.type === "Identifier") {
            const identifier = object as Identifier;
            const symbol = this.getSymbol(identifier.value);
            
            if (symbol && symbol.kind === "module") {
                const moduleSymbol = symbol as any; // CheckerModule
                const property = expr.property;
                
                if (property.type === "Identifier") {
                    const propertyName = (property as Identifier).value;
                    const exportedSymbol = moduleSymbol.exports.get(propertyName);
                    
                    if (!exportedSymbol) {
                        throw new Error(`Module "${identifier.value}" does not export "${propertyName}"`);
                    }
                    
                    // Return the member access as-is, it will be handled properly in function calls
                    return { ...expr, object, property } as MemberAccess;
                } else {
                    throw new Error(`Invalid property access on module "${identifier.value}"`);
                }
            }
        }

        // Handle regular object member access
        const objectType = this.inferTypeFromValue(object);
        if (!["object", "array", "struct", "module"].includes(objectType.type)) {
            throw new Error(`Member access on non-object type: ${objectType.type}`);
        }

        const property = this.checkExpression(expr.property);
        return { ...expr, object, property } as MemberAccess;
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
        return { ...expr, resolvedReturnType, body: checkedBody } as FunctionDeclaration;
    }

    private checkFunctionCall(expr: FunctionCall): Expression {
        const callee = this.checkExpression(expr.callee);
        
        // Handle different callee types
        let fnSy: CheckerSymbol | undefined;
        let functionName: string;
        
        if (callee.type === "Identifier") {
            const identifier = callee as Identifier;
            functionName = identifier.value;
            fnSy = this.getSymbol(identifier.value);
        } else if (callee.type === "MemberAccess") {
            const memberAccess = callee as MemberAccess;
            if (memberAccess.object.type === "Identifier" && memberAccess.property.type === "Identifier") {
                const objectName = (memberAccess.object as Identifier).value;
                const propertyName = (memberAccess.property as Identifier).value;
                functionName = `${objectName}.${propertyName}`;
                
                // Look up the module symbol
                const moduleSymbol = this.getSymbol(objectName);
                if (moduleSymbol && moduleSymbol.kind === "module") {
                    const moduleSymbolTyped = moduleSymbol as any; // CheckerModule
                    fnSy = moduleSymbolTyped.exports.get(propertyName);
                    if (!fnSy) {
                        throw new Error(`Module "${objectName}" does not export function "${propertyName}"`);
                    }
                } else {
                    throw new Error(`"${objectName}" is not a module`);
                }
            } else {
                throw new Error(`Invalid member access in function call`);
            }
        } else {
            throw new Error(`Invalid callee type in function call: ${callee.type}`);
        }

        if (!fnSy) {
            throw new Error(`Function "${functionName}" is not defined`);
        }

        if (fnSy.kind !== "function") {
            throw new Error(`"${functionName}" is not a function`);
        }

        const args = expr.args.map(arg => this.checkExpression(arg));
        if (args.length !== fnSy.paramTypes.length) {
            throw new Error(`Function "${functionName}" expects ${fnSy.paramTypes.length} arguments, but got ${args.length}`);
        }
        
        args.forEach((arg, i) => {
            const paramType = fnSy.paramTypes[i];
            const argType = this.inferTypeFromValue(arg);
            if (paramType.type !== argType.type) {
                throw new Error(`Argument ${i + 1} of function "${functionName}" expects type ${paramType.type}, but got ${argType.type}`);
            }
        });

        return { ...expr, callee, args } as FunctionCall;
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