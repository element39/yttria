import vm from "llvm-bindings";
import { ASTType, BinaryExpressionAST, FnCallAST, FnDeclarationAST, LiteralAST, MemberAccessAST, ProgramAST, ReturnExpressionAST } from "../parser/ast";
import { CodeGen } from "./gen";
import { LLVMWrapper } from "./llvmwrapper";

export class LLVMGen extends CodeGen {
    private wrapper: LLVMWrapper;
    private table: Partial<Record<ASTType, (ast: any) => vm.Value | vm.Function | void>> = {};

    constructor(name: string, ast: ProgramAST) {
        super(name, ast);
        this.wrapper = new LLVMWrapper(name);

        this.table = {
            ExternalFnDeclaration: this.genExternalFnDeclaration,
            FnDeclaration: this.genFnDeclaration,
            FnCall: this.wrapper.genFnCall,
            MemberAccess: this.wrapper.genMemberAccess,
            ReturnExpression: this.genReturnExpression,

            Literal: this.genLiteral,
            BinaryExpression: this.genBinaryExpression,
        }
    }
    
    override generate(): string {        
        this.ast.body.forEach((e) => this.table[e.type]?.call(this, e));
        return this.wrapper.print();
    }

    private genExternalFnDeclaration(ast: FnDeclarationAST): vm.Function {
        const fn = this.wrapper.createFunction(
            ast.name,
            this.wrapper.getType(ast.returnType),
            ast.params.map((p) => this.wrapper.getType(p.typeAnnotation)),
            vm.Function.LinkageTypes.ExternalLinkage
        );

        return fn;
    }

    private genFnDeclaration(ast: FnDeclarationAST): vm.Function {
        const fn = this.wrapper.createFunction(
            ast.name,
            this.wrapper.getType(ast.returnType),
            ast.params.map((p) => this.wrapper.getType(p.typeAnnotation)),
            vm.Function.LinkageTypes.InternalLinkage
        );

        const entry = this.wrapper.entryBlock(fn);
        
        // body
        let ret = false;
        for (const e of ast.body) {
            this.table[e.type]?.call(this, e)

            if (e.type === "ReturnExpression") {
                ret = true;
                break;
            }
        }

        if (!ret) {
            if (this.wrapper.getType(ast.returnType).isVoidTy()) {
                this.wrapper.ret();
            } else if (ast.name === "main" && ast.returnType === "int") {
                this.wrapper.ret(this.wrapper.constInt(0));
            } else {
                throw new Error(`Function ${ast.name} must return a value of type ${ast.returnType}`);
            }
        }

        this.wrapper.verify(fn);
        return fn;
    }

    private genReturnExpression(ast: ReturnExpressionAST): void {
        const arg = ast.argument;
        if (arg) {
            const a = this.table[arg.type]?.call(this, arg);
            if (a) this.wrapper.ret(a);
        } else {
            this.wrapper.ret()
        }
    }

    private genLiteral(ast: LiteralAST): vm.Value {
        switch (typeof ast.value) {
            case "number":
                return this.wrapper.constInt(ast.value);
            case "string":
                return this.wrapper.constStringPtr(ast.value);
            default:
                throw new Error(`Unsupported literal type: ${typeof ast.value}`);
        }
    }

    private genBinaryExpression(ast: BinaryExpressionAST): vm.Value {
        const left = this.table[ast.left.type]?.call(this, ast.left);
        const right = this.table[ast.right.type]?.call(this, ast.right);

        if (!left || !right) {
            throw new Error(`Binary expression requires both left and right operands`);
        }

        switch (ast.operator) {
            case "+":
                return this.wrapper.builder.CreateAdd(left, right, "addtmp");
            case "-":
                return this.wrapper.builder.CreateSub(left, right, "subtmp");
            case "*":
                return this.wrapper.builder.CreateMul(left, right, "multmp");
            case "/":
                return this.wrapper.builder.CreateSDiv(left, right, "divtmp");
            default:
                throw new Error(`Unsupported binary operator: ${ast.operator}`);
        }
    }

    private genFnCall(ast: FnCallAST): vm.Value {
        const callee = this.table[ast.callee.type]?.call(this, ast.callee);
        if (!callee || !(callee instanceof vm.Function)) {
            throw new Error(`Function call requires a valid function as callee`);
        }

        const args = ast.args.map(arg => {
            const value = this.table[arg.type]?.call(this, arg);
            if (!value) {
                throw new Error(`Function call argument must be a valid value`);
            }
            return value;
        });

        return this.wrapper.call(callee, args, (ast.callee as LiteralAST).value as string || "");
    }

    private genMemberAccess(ast: MemberAccessAST): vm.Value {
        const object = this.table[ast.object.type]?.call(this, ast.object);
        if (!object) {
            throw new Error(`Member access requires a valid object`);
        }

        c
    }
}