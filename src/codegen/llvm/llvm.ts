<<<<<<< HEAD
import vm from "llvm-bindings";
import { Codegen } from "..";
import { BinaryExpression, BooleanLiteral, Expression, ExpressionType, FunctionCall, FunctionDeclaration, Identifier, IfExpression, NumberLiteral, ReturnExpression, StringLiteral, SwitchExpression, VariableDeclaration, WhileExpression } from "../../parser/ast";
import { LLVMHelper } from "./helper";

export class LLVMGen extends Codegen {
    helper: LLVMHelper = new LLVMHelper();
    scope: Record<string, vm.Value>[] = [{}];

    table: { [key in ExpressionType]?: (expr: any) => vm.Function | vm.Value | void } = {
        FunctionCall: this.genFunctionCall.bind(this),
        ReturnExpression: this.genReturnExpression.bind(this),
        VariableDeclaration: this.genVariableDeclaration.bind(this),
        IfExpression: this.genIfExpression.bind(this),
        WhileExpression: this.genWhileExpression.bind(this),
        SwitchExpression: this.genSwitchExpression.bind(this),
    }

    types: { [key: string]: vm.Type } = {
        "int": vm.Type.getInt32Ty(this.helper.context),
        "i8": vm.Type.getInt8Ty(this.helper.context),
        "i16": vm.Type.getInt16Ty(this.helper.context),
        "i32": vm.Type.getInt32Ty(this.helper.context),
        "i64": vm.Type.getInt64Ty(this.helper.context),

        "float": vm.Type.getFloatTy(this.helper.context),

        "string": vm.Type.getInt8PtrTy(this.helper.context),
        "char": vm.Type.getInt8Ty(this.helper.context),

        "void": vm.Type.getVoidTy(this.helper.context),
        "bool": vm.Type.getInt1Ty(this.helper.context),
    };
    
    private pushScope() {
        this.scope.push({});
    }

    private popScope() {
        this.scope.pop();
    }

    setVariable(name: string, ptr: vm.Value) {
        this.scope[this.scope.length - 1][name] = ptr;
    }

    getVariable(name: string): vm.Value | undefined {
        for (let i = this.scope.length - 1; i >= 0; i--) {
            if (name in this.scope[i]) {
                return this.scope[i][name];
            }
        }
        return undefined;
    }

    generate(): string {
        for (const expr of this.ast.body) {
            if (expr.type === "FunctionDeclaration") {
                this.declareFunctionSignature(expr as FunctionDeclaration);
            }
        }
        
        for (const expr of this.ast.body) {
            if (expr.type === "FunctionDeclaration") {
                this.genFunctionDeclaration(expr as FunctionDeclaration);
            }
        }

        for (const expr of this.ast.body) {
            if (expr.type in this.table) {
                const fnGen = this.table[expr.type];
                if (fnGen) fnGen(expr);
            }
        }
        
        return this.helper.print();
    }

    declareFunctionSignature(expr: FunctionDeclaration): vm.Function {
        const name = expr.name.value;
        const ty = expr.returnType?.value || expr.resolvedReturnType?.type;
        if (!ty || !(ty in this.types)) {
            throw new Error(`Unknown return type: ${ty}`);
        }
        const returnType = this.types[ty];
        
        return this.helper.fn(
            name,
            returnType,
            expr.params.map(p => this.types[p.paramType.value]),
            expr.modifiers.includes("pub") ? "external" : "internal"
        );
    }

    generateFunctionBody(expr: FunctionDeclaration): vm.Function | void {
        if (expr.modifiers.includes("extern")) return;
        const name = expr.name.value;
        const fn = this.helper.module.getFunction(name);
        if (!fn) {
            throw new Error(`Function "${name}" not found in module`);
        }
        this.helper.currentFunction = fn;
        this.pushScope();

        this.helper.block("entry", () => {
            for (const [i, p] of expr.params.entries()) {
                const name = p.name.value;
                const ty = this.types[p.paramType.value];
                if (!ty) {
                    throw new Error(`Unknown parameter type: ${p.paramType.value}`);
                }

                const alloca = this.helper.alloc(name, ty);
                const arg = fn.getArg(i);
                this.helper.builder.CreateStore(arg, alloca);
                this.setVariable(name, alloca);
            }
            
            let returned = false;

            for (const e of expr.body) {
                if (e.type in this.table) {
                    if (e.type === "ReturnExpression") returned = true;
                    const fnGen = this.table[e.type];
                    fnGen && fnGen(e);
                }
            }

            if (!returned && fn.getReturnType().isVoidTy()) {
                this.helper.builder.CreateRetVoid();
            }
        });

        this.popScope();

        this.helper.verify(fn);
        return fn;
    }

    genFunctionDeclaration(expr: FunctionDeclaration): vm.Function | void {
        const fn = this.helper.module.getFunction(expr.name.value);
        // if (fn) {
        //     return this.generateFunctionBody(expr);
        // } else {
        //     const fn = this.declareFunctionSignature(expr);
        //     return this.generateFunctionBody(expr);
        // }
        if (!fn) {
            const fn = this.declareFunctionSignature(expr);
            if (expr.modifiers.includes("extern")) return;
            return this.generateFunctionBody(expr)
        } else {
            return this.generateFunctionBody(expr);
        }
    }

    genExpression(expr: Expression): vm.Function | vm.Value | void {
        switch (expr.type) {
            case "StringLiteral":
                const s = expr as StringLiteral;
                return this.helper.builder.CreateGlobalStringPtr(s.value);
            case "NumberLiteral":
                const n = expr as NumberLiteral;
                return this.helper.builder.getInt32(n.value);
            case "BooleanLiteral":
                const bl = expr as BooleanLiteral;
                return this.helper.builder.getInt1(bl.value);
            case "Identifier":
                const name = (expr as Identifier).value;
                const ptr = this.getVariable(name);
                if (!ptr) throw new Error(`Variable "${name}" not found`);
                return this.helper.builder.CreateLoad(ptr.getType().getPointerElementType(), ptr, name);
            case "BinaryExpression":
                const b = expr as BinaryExpression;
                const left = this.genExpression(b.left);
                const right = this.genExpression(b.right);
                if (!left || !right) {
                    throw new Error("Invalid binary expression operands");
                }
                switch (b.operator) {
                    case "+":
                        return this.helper.builder.CreateAdd(left, right);
                    case "-":
                        return this.helper.builder.CreateSub(left, right);
                    case "*":
                        return this.helper.builder.CreateMul(left, right);
                    case "/":
                        return this.helper.builder.CreateSDiv(left, right);
                    case "%":
                        return this.helper.builder.CreateSRem(left, right);

                    case ">":
                        return this.helper.builder.CreateICmpSGT(left, right, "gt");
                    case "<":
                        return this.helper.builder.CreateICmpSLT(left, right, "lt");
                    case ">=":
                        return this.helper.builder.CreateICmpSGE(left, right, "ge");
                    case "<=":
                        return this.helper.builder.CreateICmpSLE(left, right, "le");
                    case "==":
                        return this.helper.builder.CreateICmpEQ(left, right, "eq");
                    case "!=":
                        return this.helper.builder.CreateICmpNE(left, right, "ne");
                    case "&&":
                        const and = this.helper.builder.CreateAnd(left, right, "and");
                        return this.helper.builder.CreateICmpNE(and, this.helper.builder.getInt32(0), "and_result");
                    case "||":
                        const or = this.helper.builder.CreateOr(left, right, "or");
                        return this.helper.builder.CreateICmpNE(or, this.helper.builder.getInt32(0), "or_result");
                    // case "^^":
                    //     const xor = this.helper.builder.CreateXor(left, right, "xor");
                    //     return this.helper.builder.CreateICmpNE(xor, this.helper.builder.getInt32(0), "xor_result");
                    default:
                        throw new Error(`Unknown binary operator: ${b.operator}`);
                }
        }

        const tbl = this.table[expr.type];
        if (tbl) return tbl(expr)

        return;
    }

    genFunctionCall(expr: FunctionCall): vm.Value | void {
        const callee = expr.callee.value;
        const fn = this.helper.module.getFunction(callee);
        if (!fn) {
            throw new Error(`Function "${callee}" not found`);
        }

        const args: vm.Value[] = [];
        for (const arg of expr.args) {
            const value = this.genExpression(arg);
            if (!value) {
                throw new Error(`Invalid argument for function call: ${arg.type}`);
            }
            args.push(value);
        }

        if (fn.getReturnType().isVoidTy()) {
            this.helper.builder.CreateCall(fn, args);
            return;
        }

        return this.helper.builder.CreateCall(fn, args, `${callee}_result`);
    }

    genReturnExpression(expr: ReturnExpression): vm.Function {
        if (!this.helper.currentFunction) {
            throw new Error("No current function set for return expression");
        }
        const value = this.genExpression(expr.value);
        if (this.helper.currentFunction.getReturnType().isVoidTy()) {
            this.helper.builder.CreateRetVoid();
            return this.helper.currentFunction;
        }
        
        if (!value) {
            throw new Error(`return expression type unhandled, got ${expr.value.type}`);
        }
        this.helper.builder.CreateRet(value);
        return this.helper.currentFunction;
    }

    genVariableDeclaration(expr: VariableDeclaration): vm.Value {
        const name = expr.name.value;
        const ty = expr.typeAnnotation?.value ?? expr.resolvedType?.type;

        if (!ty || !(ty in this.types)) {
            throw new Error(`unknown variable type: ${ty}`);
        }
        const type = this.types[ty];
        const alloca = this.helper.alloc(name, type);
        const value = this.genExpression(expr.value);
        if (value) {
            this.helper.store(alloca, value);
        }
        this.setVariable(name, alloca);
        return alloca;
    }

    // the underlying logic was borrowed from Lioncat2002/HelixLang
    // https://github.com/Lioncat2002/HelixLang/blob/e4c51d952d0963b1b70de1353848a3ad673ae159/src/core/codegen/Codegen.cpp#L134
    
    // TODO: make this cleaner, its so clunky rn
    genIfExpression(expr: IfExpression): vm.Value | void {
        const currentFn = this.helper.currentFunction;
        if (!currentFn) throw new Error("no current function for if expression");

        const condition = this.genExpression(expr.condition);
        if (!condition) throw new Error("condition expression must return a value");

        const parent = this.helper.builder.GetInsertBlock();
        if (!parent) throw new Error("no current block for if expression");

        const ifTrue = this.helper.block("if_true");
        let ifEnd: vm.BasicBlock | null = null;
        let ifFalse: vm.BasicBlock;

        if (expr.alternate) {
            ifFalse = this.helper.block("if_false");
        } else {
            ifEnd = this.helper.block("if_end");
            ifFalse = ifEnd;
        }

        this.helper.builder.SetInsertPoint(parent);
        this.helper.builder.CreateCondBr(condition, ifTrue, ifFalse);

        this.helper.builder.SetInsertPoint(ifTrue);
        let trueReturned = false;
        for (const e of expr.body) {
            if (e.type in this.table) {
                if (e.type === "ReturnExpression") trueReturned = true;
                const fnGen = this.table[e.type];
                fnGen && fnGen(e);
            }
        }
        if (!trueReturned) {
            if (!ifEnd) ifEnd = this.helper.block("if_end");
            this.helper.builder.CreateBr(ifEnd);
        }

        let ifFalseReturned = false;
        if (expr.alternate) {
            this.helper.builder.SetInsertPoint(ifFalse);
            if (expr.alternate.type === "IfExpression") {
                this.genIfExpression(expr.alternate);
            } else if (expr.alternate.type === "ElseExpression") {
                for (const e of expr.alternate.body) {
                    if (e.type in this.table) {
                        if (e.type === "ReturnExpression") ifFalseReturned = true;
                        const fnGen = this.table[e.type];
                        fnGen && fnGen(e);
                    }
                }
                if (!ifFalse.getTerminator()) {
                    if (!ifEnd) ifEnd = this.helper.block("if_end");
                    this.helper.builder.CreateBr(ifEnd);
                }
            }
        }

        if (ifEnd && (!trueReturned || !ifFalseReturned)) {
            this.helper.builder.SetInsertPoint(ifEnd);
        } else if (ifEnd && trueReturned && ifFalseReturned) {
            ifEnd.eraseFromParent();
        }
    }

    genWhileExpression(expr: WhileExpression): vm.BasicBlock {
        const currentFn = this.helper.currentFunction;
        if (!currentFn) throw new Error("no current function for while expression");

        const parent = this.helper.builder.GetInsertBlock();
        if (!parent) throw new Error("no current block for while expression");

        const whileCond = this.helper.block("while_cond");
        const whileBody = this.helper.block("while_body");
        const whileEnd = this.helper.block("while_end");

        this.helper.builder.SetInsertPoint(parent);
        this.helper.builder.CreateBr(whileCond);

        this.helper.builder.SetInsertPoint(whileCond);
        const cond = this.genExpression(expr.condition);
        if (!cond) throw new Error("condition expression must return a value");
        this.helper.builder.CreateCondBr(cond, whileBody, whileEnd);

        this.helper.builder.SetInsertPoint(whileBody);
        for (const e of expr.body) {
            if (e.type in this.table) {
                const fnGen = this.table[e.type];
                fnGen && fnGen(e);
            }
        }
        this.helper.builder.CreateBr(whileCond);

        this.helper.builder.SetInsertPoint(whileEnd);
        return whileEnd;
    }

    // TODO: strings wont work bcz technically pointers are different
    genSwitchExpression(expr: SwitchExpression): vm.Value | void {
        const currentFn = this.helper.currentFunction;
        if (!currentFn) throw new Error("no current function for switch expression");

        const switchValue = this.genExpression(expr.value);
        if (!switchValue) throw new Error("switch value must return a value");

        const parent = this.helper.builder.GetInsertBlock();
        if (!parent) throw new Error("no current block for switch expression");

        const end = this.helper.block("switch_end")

        const caseBlocks = expr.cases.map((_, i) => this.helper.block(`switch_case_${i}`));
        const condBlocks = expr.cases.map((_, i) => this.helper.block(`switch_cond_${i}`));
        const defaultIdx = expr.cases.findIndex(c => c.value === "default");

        this.helper.builder.SetInsertPoint(parent);
        this.helper.builder.CreateBr(condBlocks[0]);

        expr.cases.forEach((caseExpr, i) => {
            this.helper.builder.SetInsertPoint(caseBlocks[i]);
            for (const stmt of caseExpr.body) {
                if (stmt.type in this.table) {
                    const fnGen = this.table[stmt.type];
                    fnGen && fnGen(stmt);
                }
            }

            if (!caseBlocks[i].getTerminator()) {
                this.helper.builder.CreateBr(end);
            }
        });
        

        expr.cases.forEach((caseExpr, i) => {
            this.helper.builder.SetInsertPoint(condBlocks[i]);
            const caseValue = caseExpr.value === "default" ? "default" : this.genExpression(caseExpr.value);
            if (!caseValue) {
                const valueType = caseExpr.value === "default" ? "default" : (caseExpr.value as Expression).type;
                throw new Error(`case value must return a value, got ${valueType}`);
            }

            if (caseExpr.value === "default") {
                this.helper.builder.CreateBr(caseBlocks[i]);
                return;
            }
            
            const eq = this.helper.builder.CreateICmpEQ(switchValue, caseValue as vm.Value, `case_cmp_${i}`);
            this.helper.builder.CreateCondBr(eq, caseBlocks[i], i === defaultIdx ? end : condBlocks[i + 1]);
            if (i === expr.cases.length - 1 && defaultIdx === -1) {
                this.helper.builder.CreateBr(end);
            }
        });

        this.helper.builder.SetInsertPoint(end);
    }
=======
import vm from "llvm-bindings";
import { Codegen } from "..";
import { BinaryExpression, BooleanLiteral, Expression, ExpressionType, FunctionCall, FunctionDeclaration, Identifier, IfExpression, NumberLiteral, ReturnExpression, StringLiteral, SwitchExpression, VariableDeclaration, WhileExpression } from "../../parser/ast";
import { LLVMHelper } from "./helper";

export class LLVMGen extends Codegen {
    helper: LLVMHelper = new LLVMHelper();
    scope: Record<string, vm.Value>[] = [{}];

    table: { [key in ExpressionType]?: (expr: any) => vm.Function | vm.Value | void } = {
        FunctionCall: this.genFunctionCall.bind(this),
        ReturnExpression: this.genReturnExpression.bind(this),
        VariableDeclaration: this.genVariableDeclaration.bind(this),
        IfExpression: this.genIfExpression.bind(this),
        WhileExpression: this.genWhileExpression.bind(this),
        SwitchExpression: this.genSwitchExpression.bind(this),
    }

    types: { [key: string]: vm.Type } = {
        "int": vm.Type.getInt32Ty(this.helper.context),
        "i8": vm.Type.getInt8Ty(this.helper.context),
        "i16": vm.Type.getInt16Ty(this.helper.context),
        "i32": vm.Type.getInt32Ty(this.helper.context),
        "i64": vm.Type.getInt64Ty(this.helper.context),

        "float": vm.Type.getFloatTy(this.helper.context),

        "string": vm.Type.getInt8PtrTy(this.helper.context),
        "char": vm.Type.getInt8Ty(this.helper.context),

        "void": vm.Type.getVoidTy(this.helper.context),
        "bool": vm.Type.getInt1Ty(this.helper.context),
    };
    
    private pushScope() {
        this.scope.push({});
    }

    private popScope() {
        this.scope.pop();
    }

    setVariable(name: string, ptr: vm.Value) {
        this.scope[this.scope.length - 1][name] = ptr;
    }

    getVariable(name: string): vm.Value | undefined {
        for (let i = this.scope.length - 1; i >= 0; i--) {
            if (name in this.scope[i]) {
                return this.scope[i][name];
            }
        }
        return undefined;
    }

    generate(): string {
        for (const expr of this.ast.body) {
            if (expr.type === "FunctionDeclaration") {
                this.declareFunctionSignature(expr as FunctionDeclaration);
            }
        }
        
        for (const expr of this.ast.body) {
            if (expr.type === "FunctionDeclaration") {
                this.genFunctionDeclaration(expr as FunctionDeclaration);
            }
        }

        for (const expr of this.ast.body) {
            if (expr.type in this.table) {
                const fnGen = this.table[expr.type];
                if (fnGen) fnGen(expr);
            }
        }
        
        return this.helper.print();
    }

    declareFunctionSignature(expr: FunctionDeclaration): vm.Function {
        const name = expr.name.value;
        const ty = expr.returnType?.value || expr.resolvedReturnType?.type;
        if (!ty || !(ty in this.types)) {
            throw new Error(`Unknown return type: ${ty}`);
        }
        const returnType = this.types[ty];
        
        return this.helper.fn(
            name,
            returnType,
            expr.params.map(p => this.types[p.paramType.value]),
            (expr.modifiers.includes("pub") || expr.modifiers.includes("extern")) ? "external" : "internal"
        );
    }

    generateFunctionBody(expr: FunctionDeclaration): vm.Function | void {
        if (expr.modifiers.includes("extern")) return;
        const name = expr.name.value;
        const fn = this.helper.module.getFunction(name);
        if (!fn) {
            throw new Error(`Function "${name}" not found in module`);
        }
        this.helper.currentFunction = fn;
        this.pushScope();

        this.helper.block("entry", () => {
            for (const [i, p] of expr.params.entries()) {
                const name = p.name.value;
                const ty = this.types[p.paramType.value];
                if (!ty) {
                    throw new Error(`Unknown parameter type: ${p.paramType.value}`);
                }

                const alloca = this.helper.alloc(name, ty);
                const arg = fn.getArg(i);
                this.helper.builder.CreateStore(arg, alloca);
                this.setVariable(name, alloca);
            }
            
            let returned = false;

            for (const e of expr.body) {
                if (e.type in this.table) {
                    if (e.type === "ReturnExpression") returned = true;
                    const fnGen = this.table[e.type];
                    fnGen && fnGen(e);
                }
            }

            if (!returned && fn.getReturnType().isVoidTy()) {
                this.helper.builder.CreateRetVoid();
            }
        });

        this.popScope();

        this.helper.verify(fn);
        return fn;
    }

    genFunctionDeclaration(expr: FunctionDeclaration): vm.Function | void {
        const fn = this.helper.module.getFunction(expr.name.value);
        // if (fn) {
        //     return this.generateFunctionBody(expr);
        // } else {
        //     const fn = this.declareFunctionSignature(expr);
        //     return this.generateFunctionBody(expr);
        // }
        if (!fn) {
            const fn = this.declareFunctionSignature(expr);
            if (expr.modifiers.includes("extern")) return;
            return this.generateFunctionBody(expr)
        } else {
            return this.generateFunctionBody(expr);
        }
    }

    genExpression(expr: Expression): vm.Function | vm.Value | void {
        switch (expr.type) {
            case "StringLiteral":
                const s = expr as StringLiteral;
                return this.helper.builder.CreateGlobalStringPtr(s.value);
            case "NumberLiteral":
                const n = expr as NumberLiteral;
                return this.helper.builder.getInt32(n.value);
            case "BooleanLiteral":
                const bl = expr as BooleanLiteral;
                return this.helper.builder.getInt1(bl.value);
            case "Identifier":
                const name = (expr as Identifier).value;
                const ptr = this.getVariable(name);
                if (!ptr) throw new Error(`Variable "${name}" not found`);
                return this.helper.builder.CreateLoad(ptr.getType().getPointerElementType(), ptr, name);
            case "BinaryExpression":
                const b = expr as BinaryExpression;
                const left = this.genExpression(b.left);
                const right = this.genExpression(b.right);
                if (!left || !right) {
                    throw new Error("Invalid binary expression operands");
                }
                switch (b.operator) {
                    case "+":
                        return this.helper.builder.CreateAdd(left, right);
                    case "-":
                        return this.helper.builder.CreateSub(left, right);
                    case "*":
                        return this.helper.builder.CreateMul(left, right);
                    case "/":
                        return this.helper.builder.CreateSDiv(left, right);
                    case "%":
                        return this.helper.builder.CreateSRem(left, right);

                    case ">":
                        return this.helper.builder.CreateICmpSGT(left, right, "gt");
                    case "<":
                        return this.helper.builder.CreateICmpSLT(left, right, "lt");
                    case ">=":
                        return this.helper.builder.CreateICmpSGE(left, right, "ge");
                    case "<=":
                        return this.helper.builder.CreateICmpSLE(left, right, "le");
                    case "==":
                        return this.helper.builder.CreateICmpEQ(left, right, "eq");
                    case "!=":
                        return this.helper.builder.CreateICmpNE(left, right, "ne");
                    case "&&":
                        const and = this.helper.builder.CreateAnd(left, right, "and");
                        return this.helper.builder.CreateICmpNE(and, this.helper.builder.getInt32(0), "and_result");
                    case "||":
                        const or = this.helper.builder.CreateOr(left, right, "or");
                        return this.helper.builder.CreateICmpNE(or, this.helper.builder.getInt32(0), "or_result");
                    // case "^^":
                    //     const xor = this.helper.builder.CreateXor(left, right, "xor");
                    //     return this.helper.builder.CreateICmpNE(xor, this.helper.builder.getInt32(0), "xor_result");
                    default:
                        throw new Error(`Unknown binary operator: ${b.operator}`);
                }
        }

        const tbl = this.table[expr.type];
        if (tbl) return tbl(expr)

        return;
    }

    genFunctionCall(expr: FunctionCall): vm.Value | void {
        const callee = expr.callee.value;
        const fn = this.helper.module.getFunction(callee);
        if (!fn) {
            throw new Error(`Function "${callee}" not found`);
        }

        const args: vm.Value[] = [];
        for (const arg of expr.args) {
            const value = this.genExpression(arg);
            if (!value) {
                throw new Error(`Invalid argument for function call: ${arg.type}`);
            }
            args.push(value);
        }

        if (fn.getReturnType().isVoidTy()) {
            this.helper.builder.CreateCall(fn, args);
            return;
        }

        return this.helper.builder.CreateCall(fn, args, `${callee}_result`);
    }

    genReturnExpression(expr: ReturnExpression): vm.Function {
        if (!this.helper.currentFunction) {
            throw new Error("No current function set for return expression");
        }
        const value = this.genExpression(expr.value);
        if (this.helper.currentFunction.getReturnType().isVoidTy()) {
            this.helper.builder.CreateRetVoid();
            return this.helper.currentFunction;
        }
        
        if (!value) {
            throw new Error(`return expression type unhandled, got ${expr.value.type}`);
        }
        this.helper.builder.CreateRet(value);
        return this.helper.currentFunction;
    }

    genVariableDeclaration(expr: VariableDeclaration): vm.Value {
        const name = expr.name.value;
        const ty = expr.typeAnnotation?.value ?? expr.resolvedType?.type;

        if (!ty || !(ty in this.types)) {
            throw new Error(`unknown variable type: ${ty}`);
        }
        const type = this.types[ty];
        const alloca = this.helper.alloc(name, type);
        const value = this.genExpression(expr.value);
        if (value) {
            this.helper.store(alloca, value);
        }
        this.setVariable(name, alloca);
        return alloca;
    }

    // the underlying logic was borrowed from Lioncat2002/HelixLang
    // https://github.com/Lioncat2002/HelixLang/blob/e4c51d952d0963b1b70de1353848a3ad673ae159/src/core/codegen/Codegen.cpp#L134
    
    // TODO: make this cleaner, its so clunky rn
    genIfExpression(expr: IfExpression): vm.Value | void {
        const currentFn = this.helper.currentFunction;
        if (!currentFn) throw new Error("no current function for if expression");

        const condition = this.genExpression(expr.condition);
        if (!condition) throw new Error("condition expression must return a value");

        const parent = this.helper.builder.GetInsertBlock();
        if (!parent) throw new Error("no current block for if expression");

        const ifTrue = this.helper.block("if_true");
        let ifEnd: vm.BasicBlock | null = null;
        let ifFalse: vm.BasicBlock;

        if (expr.alternate) {
            ifFalse = this.helper.block("if_false");
        } else {
            ifEnd = this.helper.block("if_end");
            ifFalse = ifEnd;
        }

        this.helper.builder.SetInsertPoint(parent);
        this.helper.builder.CreateCondBr(condition, ifTrue, ifFalse);

        this.helper.builder.SetInsertPoint(ifTrue);
        let trueReturned = false;
        for (const e of expr.body) {
            if (e.type in this.table) {
                if (e.type === "ReturnExpression") trueReturned = true;
                const fnGen = this.table[e.type];
                fnGen && fnGen(e);
            }
        }
        if (!trueReturned) {
            if (!ifEnd) ifEnd = this.helper.block("if_end");
            this.helper.builder.CreateBr(ifEnd);
        }

        let ifFalseReturned = false;
        if (expr.alternate) {
            this.helper.builder.SetInsertPoint(ifFalse);
            if (expr.alternate.type === "IfExpression") {
                this.genIfExpression(expr.alternate);
            } else if (expr.alternate.type === "ElseExpression") {
                for (const e of expr.alternate.body) {
                    if (e.type in this.table) {
                        if (e.type === "ReturnExpression") ifFalseReturned = true;
                        const fnGen = this.table[e.type];
                        fnGen && fnGen(e);
                    }
                }
                if (!ifFalse.getTerminator()) {
                    if (!ifEnd) ifEnd = this.helper.block("if_end");
                    this.helper.builder.CreateBr(ifEnd);
                }
            }
        }

        if (ifEnd && (!trueReturned || !ifFalseReturned)) {
            this.helper.builder.SetInsertPoint(ifEnd);
        } else if (ifEnd && trueReturned && ifFalseReturned) {
            ifEnd.eraseFromParent();
        }
    }

    genWhileExpression(expr: WhileExpression): vm.BasicBlock {
        const currentFn = this.helper.currentFunction;
        if (!currentFn) throw new Error("no current function for while expression");

        const parent = this.helper.builder.GetInsertBlock();
        if (!parent) throw new Error("no current block for while expression");

        const whileCond = this.helper.block("while_cond");
        const whileBody = this.helper.block("while_body");
        const whileEnd = this.helper.block("while_end");

        this.helper.builder.SetInsertPoint(parent);
        this.helper.builder.CreateBr(whileCond);

        this.helper.builder.SetInsertPoint(whileCond);
        const cond = this.genExpression(expr.condition);
        if (!cond) throw new Error("condition expression must return a value");
        this.helper.builder.CreateCondBr(cond, whileBody, whileEnd);

        this.helper.builder.SetInsertPoint(whileBody);
        for (const e of expr.body) {
            if (e.type in this.table) {
                const fnGen = this.table[e.type];
                fnGen && fnGen(e);
            }
        }
        this.helper.builder.CreateBr(whileCond);

        this.helper.builder.SetInsertPoint(whileEnd);
        return whileEnd;
    }

    // TODO: strings wont work bcz technically pointers are different
    genSwitchExpression(expr: SwitchExpression): vm.Value | void {
        const currentFn = this.helper.currentFunction;
        if (!currentFn) throw new Error("no current function for switch expression");

        const switchValue = this.genExpression(expr.value);
        if (!switchValue) throw new Error("switch value must return a value");

        const parent = this.helper.builder.GetInsertBlock();
        if (!parent) throw new Error("no current block for switch expression");

        const end = this.helper.block("switch_end")

        const caseBlocks = expr.cases.map((_, i) => this.helper.block(`switch_case_${i}`));
        const condBlocks = expr.cases.map((_, i) => this.helper.block(`switch_cond_${i}`));
        const defaultIdx = expr.cases.findIndex(c => c.value === "default");

        this.helper.builder.SetInsertPoint(parent);
        this.helper.builder.CreateBr(condBlocks[0]);

        expr.cases.forEach((caseExpr, i) => {
            this.helper.builder.SetInsertPoint(caseBlocks[i]);
            for (const stmt of caseExpr.body) {
                if (stmt.type in this.table) {
                    const fnGen = this.table[stmt.type];
                    fnGen && fnGen(stmt);
                }
            }

            if (!caseBlocks[i].getTerminator()) {
                this.helper.builder.CreateBr(end);
            }
        });
        

        expr.cases.forEach((caseExpr, i) => {
            this.helper.builder.SetInsertPoint(condBlocks[i]);
            const caseValue = caseExpr.value === "default" ? "default" : this.genExpression(caseExpr.value);
            if (!caseValue) {
                const valueType = caseExpr.value === "default" ? "default" : (caseExpr.value as Expression).type;
                throw new Error(`case value must return a value, got ${valueType}`);
            }

            if (caseExpr.value === "default") {
                this.helper.builder.CreateBr(caseBlocks[i]);
                return;
            }
            
            const eq = this.helper.builder.CreateICmpEQ(switchValue, caseValue as vm.Value, `case_cmp_${i}`);
            this.helper.builder.CreateCondBr(eq, caseBlocks[i], i === defaultIdx ? end : condBlocks[i + 1]);
            if (i === expr.cases.length - 1 && defaultIdx === -1) {
                this.helper.builder.CreateBr(end);
            }
        });

        this.helper.builder.SetInsertPoint(end);
    }
>>>>>>> import-resolver
}