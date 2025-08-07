import { BasicBlock, Func, FunctionType, Linkage, Type, Value } from "../bindings";
import { ResolvedModule } from "../module/types";
import { BinaryExpression, Expression, ExpressionType, FunctionCall, FunctionDeclaration, Identifier, IfExpression, MemberAccess, NumberLiteral, ProgramExpression, ReturnExpression, SwitchExpression, VariableDeclaration } from "../parser/ast";
import { LLVMHelper } from "./helper";

export class Codegen {
    private name: string;
    private ast: ProgramExpression;
    private helper: LLVMHelper;

    private alias: string;
    private modules: { [key: string]: ResolvedModule };
    private voidCalls: Set<string> = new Set();
    private scopes: Array<Record<string, { value: Value, isPointer: boolean }>> = [];
    
    private table: { [key in ExpressionType]?: (e: any) => Value | null } = {
        ReturnExpression: this.genReturnExpression.bind(this),
        FunctionCall: this.genFunctionCall.bind(this),
        VariableDeclaration: this.genVariableDeclaration.bind(this),

        IfExpression: this.genIfExpression.bind(this),
        SwitchExpression: this.genSwitchExpression.bind(this),
    };

    private registerFunctionSignature(expr: FunctionDeclaration): void {
        const fnName = this.alias ? `${this.alias}.${expr.name.value}` : expr.name.value;
        const retName = expr.resolvedReturnType?.value ?? expr.returnType?.value ?? "void";
        const retTy = this.getType(retName);
        const paramTypes = expr.params.map(param => this.getType(param.paramType.value));
        const fnType = new FunctionType(paramTypes, retTy, false);

        if (!this.helper.mod.getFunction(fnName)) {
            this.helper.mod.createFunction(fnName, fnType, { linkage: Linkage.External });
        }
    }

    types: { [key: string]: Type }

    constructor(
        name: string,
        ast: ProgramExpression,
        modules: { [key: string]: ResolvedModule }
    ) {
        this.name = name;
        this.alias = name === "main" ? "" : name.split("/").pop()!;
        this.ast = ast;
        this.helper = new LLVMHelper(name);
        this.modules = modules;

        this.types = {
            "int": Type.int32(this.helper.ctx),
            "i8": Type.int8(this.helper.ctx),
            "i16": Type.int16(this.helper.ctx),
            "i32": Type.int32(this.helper.ctx),
            "i64": Type.int64(this.helper.ctx),

            "float": Type.float(this.helper.ctx),

            "string": Type.pointer(Type.int8(this.helper.ctx)),
            "char": Type.int8(this.helper.ctx),

            "void": Type.void(this.helper.ctx),
            "bool": Type.int1(this.helper.ctx),
        }
    }

    private currentReturnType: Type | null = null;

    private genFunctionDeclaration(expr: FunctionDeclaration): Value | null {
        const retName2 = expr.resolvedReturnType?.value ?? expr.returnType?.value ?? "void";
        const retTy2 = this.getType(retName2);
        this.currentReturnType = retTy2;

        if (expr.modifiers.includes("extern")) {
            this.currentReturnType = null;
            return null;
        }

        const fnName = this.alias ? `${this.alias}.${expr.name.value}` : expr.name.value;
        const paramTypes = expr.params.map(param => this.getType(param.paramType.value));
        const fnType = new FunctionType(paramTypes, retTy2, false);
        const fn = this.helper.fn(fnName, fnType);

        const scope: Record<string, { value: Value, isPointer: boolean }> = {};
        this.scopes.push(scope);

        expr.params.forEach((param, i) => {
            const paramName = param.name.value;
            scope[paramName] = { value: fn.getArg(i), isPointer: false };
        });

        let hasReturn = false;
        for (const e of expr.body) {
            if (e.type === "ReturnExpression") hasReturn = true;
            if (e.type in this.table) {
                const gen = this.table[e.type];
                gen && gen(e);
            }
        }

        if (!hasReturn && (expr.resolvedReturnType?.value ?? expr.returnType?.value) === "void") {
            this.helper.builder.ret();
        }

        this.scopes.pop();
        this.currentReturnType = null;
        return null;
    }

    private genReturnExpression(expr: ReturnExpression): Value | null {
        const value = this.genExpression(expr.value, this.currentReturnType);
        if (!value) throw new Error("Failed to generate return value");

        this.helper.builder.ret(value);
        return null;
    }

    private genVariableDeclaration(expr: VariableDeclaration): Value | null {
        const varName = expr.name.value;
        const varType = this.getType(
            expr.typeAnnotation?.value ||
            (expr.resolvedType && "name" in expr.resolvedType ? (expr.resolvedType as any).name : undefined) ||
            "int"
        );

        const value = this.genExpression(expr.value, varType);
        if (!value) throw new Error(`Failed to generate value for variable ${expr.name.value}`);

        const alloca = this.helper.builder.alloca(varType, expr.name.value);
        this.helper.builder.store(value, alloca);

        this.scopes[this.scopes.length - 1][varName] = { value: alloca, isPointer: true };
        return null;
    }

    private genFunctionCall(expr: FunctionCall): Value | null {
        let fnName: string;
        const calleeExpr = expr.callee as Expression;
        if (calleeExpr.type === "MemberAccess") {
            // e.g. io.println
            const member = calleeExpr as MemberAccess;
            const obj = member.object as Identifier;
            const prop = member.property as Identifier;
            fnName = `${obj.value}.${prop.value}`;
        } else {
            const id = expr.callee as Identifier;
            fnName = id.value;
        }

        let fn = this.helper.mod.getFunction(fnName);
        if (!fn && this.alias) {
            const qualified = `${this.alias}.${fnName}`;
            fn = this.helper.mod.getFunction(qualified);
            if (fn) fnName = qualified;
        }

        if (!fn && calleeExpr.type === "MemberAccess") {
            const member = calleeExpr as MemberAccess;
            const aliasName = (member.object as Identifier).value;
            const propName = (member.property as Identifier).value;
            const modEntry = Object.entries(this.modules)
                .find(([modKey]) => modKey.split("/").pop() === aliasName);
            if (modEntry) {
                const [, { ast }] = modEntry;
                const decl = ast.body.find(e => e.type === "FunctionDeclaration" && (e as FunctionDeclaration).name.value === propName) as FunctionDeclaration | undefined;
                if (decl) {
                    const retName = decl.resolvedReturnType?.value ?? decl.returnType?.value ?? "void";
                    const retTy = this.getType(retName);
                    const paramT = decl.params.map(p => this.getType(p.paramType.value));
                    const fnType = new FunctionType(paramT, retTy, false);
                    const fullName = `${aliasName}.${propName}`;
                    this.helper.fn(fullName, fnType, { linkage: Linkage.External, extern: true });
                    if (retName === "void") this.voidCalls.add(fullName);
                    fn = this.helper.mod.getFunction(fullName)!;
                    fnName = fullName;
                }
            }
        }
        if (!fn) throw new Error(`function ${fnName} not found`);

        const args = expr.args.map((arg: Expression) => this.genExpression(arg)).filter((v): v is Value => v !== null);

        if (this.voidCalls.has(fnName)) {
            this.helper.builder.call(fn, args, "");
            return null;
        }
        return this.helper.builder.call(fn, args);
    }

    private genIfExpression(expr: IfExpression): Value | null {
        const block = this.helper.builder.getInsertBlock();
        if (!block || !block.parent) throw new Error("no current block for if expression");

        const condBB = block.parent.addBlock("if_cond");
        const trueBB = block.parent.addBlock("if_true");
        let falseBB: BasicBlock;
        let endBB: BasicBlock | undefined;

        if (expr.alternate) {
            falseBB = block.parent.addBlock("if_false");
            endBB = block.parent.addBlock("if_end");
        } else {
            endBB = block.parent.addBlock("if_end");
            falseBB = endBB;
        }

        this.helper.builder.insertInto(block);
        this.helper.builder.br(condBB);

        this.helper.builder.insertInto(condBB);
        const condition = this.genExpression(expr.condition);
        if (!condition) throw new Error("condition expression must return a value");
        this.helper.builder.condBr(condition, trueBB, falseBB);

        this.helper.builder.insertInto(trueBB);
        let trueReturned = false;
        for (const e of expr.body) {
            if (!(e.type in this.table)) continue;
            if (e.type === "ReturnExpression") trueReturned = true;
            const fnGen = this.table[e.type];
            fnGen && fnGen(e);
        }

        if (!trueReturned) {
            this.helper.builder.br(endBB);
        }

        let falseReturned = false;
        
        if (expr.alternate) {
            this.helper.builder.insertInto(falseBB);

            if (expr.alternate.type === "IfExpression") {
                this.genIfExpression(expr.alternate);
            } else if (expr.alternate.type === "ElseExpression") {
                for (const e of expr.alternate.body) {
                    if (!(e.type in this.table)) continue;
                        
                    if (e.type === "ReturnExpression") falseReturned = true;
                    const fnGen = this.table[e.type];
                    fnGen && fnGen(e);
                }
            }

            if (!falseReturned) {
                this.helper.builder.br(endBB);
            }
        }

        if (endBB && (!trueReturned || !falseReturned)) {
            this.helper.builder.insertInto(endBB);
        } else if (endBB && trueReturned && falseReturned) {
            endBB.erase();
        }

        return null;
    }

    private genSwitchExpression(expr: SwitchExpression): Value | null {
        const block = this.helper.builder.getInsertBlock();
        if (!block || !block.parent) throw new Error("no current block for switch expression");

        const switchValue = this.genExpression(expr.value);
        if (!switchValue) throw new Error("switch value must return a value");

        const parentFunc = block.parent;
        
        const endBB = parentFunc.addBlock("switch_end");
        
        this.helper.builder.insertInto(block);
        
        const regularCases = expr.cases.filter(e => e.value !== "default");
        
        const defaultCase = expr.cases.find(e => e.value === "default");
        const defaultBB = defaultCase ? parentFunc.addBlock("switch_default") : null;
        
        const conditionBlocks: BasicBlock[] = [];
        const caseBlocks: BasicBlock[] = [];
        
        for (let i = 0; i < regularCases.length; i++) {
            conditionBlocks.push(parentFunc.addBlock(`switch_cond_${i}`));
            caseBlocks.push(parentFunc.addBlock(`switch_case_${i}`));
        }
        
        if (conditionBlocks.length > 0) {
            this.helper.builder.br(conditionBlocks[0]);
        } else if (defaultBB) {
            this.helper.builder.br(defaultBB);
        } else {
            this.helper.builder.br(endBB);
        }
        
        let isStringType = false;
        if (expr.value.type === "Identifier") {
            // Look up the variable in scopes to get its inferred type
            const identifier = expr.value as Identifier;
            const found = [...this.scopes].reverse().find(scope => identifier.value in scope);
            if (found) {
                const switchTy = switchValue.getType();
                isStringType = switchTy.isPointer() || false;
            }
        } else {
            const switchTy = switchValue.getType();
            isStringType = (switchTy.isPointer() && 
                typeof switchTy.getElementType === 'function' && 
                switchTy.getElementType()?.isInt(8)) || false;
        }
                
        let strcmpFn: Func | undefined;
        if (isStringType) {
            strcmpFn = this.helper.mod.getFunction("strcmp");
            if (!strcmpFn) {
                throw new Error("builtin strcmp function not found");
            }
        }
        
        for (let i = 0; i < regularCases.length; i++) {
            const caseValue = regularCases[i];
            
            this.helper.builder.insertInto(conditionBlocks[i]);
            
            const caseExpr = this.genExpression(caseValue.value as Expression);
            if (!caseExpr) throw new Error(`case value must return a value: ${caseValue.value}`);
            
            let cond;
            if (isStringType && strcmpFn) {
                const cmpResult = this.helper.builder.call(strcmpFn, [switchValue, caseExpr]);
                cond = this.helper.builder.icmpEQ(cmpResult, Value.constInt(Type.int32(this.helper.ctx), 0));
            } else {
                cond = this.helper.builder.icmpEQ(switchValue, caseExpr);
            }
            
            const nextBlock = (i < regularCases.length - 1) 
                ? conditionBlocks[i + 1]
                : defaultBB || endBB;
                
            this.helper.builder.condBr(cond, caseBlocks[i], nextBlock);
            
            this.helper.builder.insertInto(caseBlocks[i]);
            caseValue.body.forEach(bodyExpr => {
                if (!(bodyExpr.type in this.table)) return;
                const fnGen = this.table[bodyExpr.type];
                fnGen && fnGen(bodyExpr);
            });
            
            this.helper.builder.br(endBB);
        }
        
        if (defaultBB && defaultCase) {
            this.helper.builder.insertInto(defaultBB);
            defaultCase.body.forEach(bodyExpr => {
                if (!(bodyExpr.type in this.table)) return;
                const fnGen = this.table[bodyExpr.type];
                fnGen && fnGen(bodyExpr);
            });
            this.helper.builder.br(endBB);
        }
        
        this.helper.builder.insertInto(endBB);
        
        return null;
    }

    private genExpression(expr: Expression, expectedType?: Type | null): Value | null {
        const tbl: { [key in ExpressionType]?: (expr: any, expectedType?: Type | null) => Value | null } = {

            NumberLiteral: (expr, expectedType) => {
                const t = expectedType ?? Type.int32(this.helper.ctx);
                if (t.isFloat()) {
                    return Value.constFloat(t, expr.value);
                }
                if (!Number.isInteger(expr.value)) {
                    throw new Error(`can't assign float literal ${expr.value} to integer type`);
                }
                return Value.constInt(t, expr.value);
            },

            BooleanLiteral: (expr, expectedType) => {
                return Value.constInt(Type.int1(this.helper.ctx), expr.value ? 1 : 0);
            },

            // TODO: there gotta be a better way of doing this
            StringLiteral: (expr, expectedType) => {
                const val = this.helper.mod.addGlobalString(expr.value);
                return this.helper.builder.bitcast(val, this.types["string"]);
            },

            Identifier: (expr: any) => {
                const found = [...this.scopes].reverse().find(scope => expr.value in scope);
                if (found) {
                    const entry = found[expr.value];
                    if (entry.isPointer) {
                        return this.helper.builder.load(entry.value);
                    } else {
                        return entry.value;
                    }
                }
                throw new Error(`Undefined variable: ${expr.value}`);
            },

            BinaryExpression: (expr: BinaryExpression, expectedType) => {
                let resultType: Type;
                if (expectedType?.isFloat && expectedType.isFloat()) {
                    resultType = expectedType;
                } else {
                    const leftIsFloatLit = expr.left.type === "NumberLiteral" && !Number.isInteger((expr.left as NumberLiteral).value);
                    const rightIsFloatLit = expr.right.type === "NumberLiteral" && !Number.isInteger((expr.right as NumberLiteral).value);
                    resultType = (leftIsFloatLit || rightIsFloatLit)
                        ? Type.float(this.helper.ctx)
                        : Type.int32(this.helper.ctx);
                }

                const left = this.genExpression(expr.left, resultType);
                const right = this.genExpression(expr.right, resultType);
                if (!left || !right) throw new Error(`failed to generate binary expression: ${expr.operator}`);

                switch (expr.operator) {
                    case "+":
                        return resultType.isFloat()
                            ? this.helper.builder.fadd(left, right)
                            : this.helper.builder.add(left, right);
                    case "-":
                        return resultType.isFloat()
                            ? this.helper.builder.fsub(left, right)
                            : this.helper.builder.sub(left, right);
                    case "*":
                        return resultType.isFloat()
                            ? this.helper.builder.fmul(left, right)
                            : this.helper.builder.mul(left, right);
                    case "/":
                        return resultType.isFloat()
                            ? this.helper.builder.fdiv(left, right)
                            : this.helper.builder.sdiv(left, right);

                    case "==":
                        return this.helper.builder.icmpEQ(left, right);
                    case "!=":
                        return this.helper.builder.icmpNE(left, right);
                    case "<":
                        return this.helper.builder.icmpSLT(left, right);
                    case "<=":
                        return this.helper.builder.icmpSLE(left, right);
                    case ">":
                        return this.helper.builder.icmpSGT(left, right);
                    case ">=":
                        return this.helper.builder.icmpSGE(left, right);
                    case "&&":
                        const andResult = this.helper.builder.alloca(Type.int1(this.helper.ctx), "and_result");
                        this.helper.builder.store(left, andResult);
                        const andRight = this.helper.builder.load(right);
                        this.helper.builder.store(andRight, andResult);
                        return this.helper.builder.load(andResult);
                    case "||":
                        const orResult = this.helper.builder.alloca(Type.int1(this.helper.ctx), "or_result");
                        this.helper.builder.store(left, orResult);
                        const orRight = this.helper.builder.load(right);
                        this.helper.builder.store(orRight, orResult);
                        return this.helper.builder.load(orResult);
                    default:
                        throw new Error(`Unknown binary operator: ${expr.operator}`);
                }
            },
        };

        const visitor = tbl[expr.type];
        if (!visitor) {
            if (expr.type in this.table) {
                const gen = this.table[expr.type];
                return gen ? gen(expr) : null;
            }

            throw new Error(`genExpression: Unhandled expression type: ${expr.type}`);
        }
        const res = visitor(expr, expectedType);
        return res;
    }

    generate() {
        if (this.name === "main") {
            for (const [modName, { ast }] of Object.entries(this.modules)) {
                if (modName.startsWith("builtin/")) {
                    for (const expr of ast.body) {
                        if (expr.type === "FunctionDeclaration") {
                            const fnDecl = expr as FunctionDeclaration;
                            const fnName = fnDecl.name.value;
                            const retName = fnDecl.resolvedReturnType?.value ?? fnDecl.returnType?.value ?? "void";
                            const retTy = this.getType(retName);
                            const paramT = fnDecl.params.map(p => this.getType(p.paramType.value));
                            const fnType = new FunctionType(paramT, retTy, false);
                            if (!this.helper.mod.getFunction(fnName)) {
                                this.helper.fn(fnName, fnType, { linkage: Linkage.External, extern: true });
                            }
                            if (retName === "void") this.voidCalls.add(fnName);
                        }
                    }
                }
            }
        }

        for (const expr of this.ast.body) {
            if (expr.type === "FunctionDeclaration" && (expr as FunctionDeclaration).modifiers.includes("extern")) {
                const fnDecl = expr as FunctionDeclaration;

                const fnName = fnDecl.name.value;
                const retName = fnDecl.resolvedReturnType?.value ?? fnDecl.returnType?.value ?? "void";
                const retTy = this.getType(retName);
                const paramT = fnDecl.params.map(p => this.getType(p.paramType.value));
                const fnType = new FunctionType(paramT, retTy, false);
                this.helper.fn(fnName, fnType, { linkage: Linkage.External, extern: true });
                if (retName === "void") this.voidCalls.add(fnName);
            }
        }

        for (const [modName, { ast }] of Object.entries(this.modules)) {
            if (modName === this.name) continue;
            const alias = modName.includes("/") ? modName.split("/").pop()! : modName;
            for (const expr of ast.body) {
                if (expr.type === "FunctionDeclaration" && !(expr as FunctionDeclaration).modifiers.includes("extern")) {
                    const fnDecl = expr as FunctionDeclaration;
                    const retName = fnDecl.resolvedReturnType?.value ?? fnDecl.returnType?.value ?? "void";
                    const retTy = this.getType(retName);
                    const paramT = fnDecl.params.map(p => this.getType(p.paramType.value));
                    const fnType = new FunctionType(paramT, retTy, false);
                    this.helper.fn(`${alias}.${fnDecl.name.value}`, fnType, { linkage: Linkage.External, extern: true });
                    if (retName === "void") this.voidCalls.add(`${alias}.${fnDecl.name.value}`);
                }
            }
        }

        for (const expr of this.ast.body) {
            if (expr.type === "FunctionDeclaration") {
                this.genFunctionDeclaration(expr as FunctionDeclaration);
            } else if (expr.type in this.table) {
                const gen = this.table[expr.type as ExpressionType];
                gen && gen(expr);
            }
        }
        return this.helper.toString();
    }

    private getType(name?: string): Type {
        const key = name ?? "void";
        const type = this.types[key];
        
        if (!type) {
            const available = Object.keys(this.types).join(", ");
            throw new Error(
                `unknown type: '${key}'.\navailable types: [${available}]\n` +
                `this probably meant a type annotation or inference failed.`
            );
        }
        return type;
    }
}