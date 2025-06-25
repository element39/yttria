import vm from "llvm-bindings";
import { ASTType, ExternalFnDeclarationAST, FnCallAST, FnDeclarationAST, IdentifierAST, LiteralAST, MemberAccessAST, ProgramAST, ReturnExpressionAST } from "../../parser/ast";
import { CodeGen } from "../gen";
import { LLVMWrapper } from "./wrapper";

export class LLVMGen extends CodeGen {
    private wrapper: LLVMWrapper;
    private table: Partial<Record<ASTType, (ast: any) => vm.Value | vm.Function | void>> = {};

    constructor(name: string, ast: ProgramAST) {
        super(name, ast);
        this.wrapper = new LLVMWrapper(name, this.table);

        this.table = {
            FnDeclaration: this.genFnDeclaration,
            ExternalFnDeclaration: this.genExternalFnDeclaration,
            FnCall: this.genFnCall,

            Literal: this.genLiteral,

            ReturnExpression: this.genReturnExpression,
        }
    }
    
    override generate(): string {        
        this.ast.body.forEach((e) => this.table[e.type]?.call(this, e));
        return this.wrapper.print();
    }

    private genFnDeclaration(ast: FnDeclarationAST): vm.Function | void {
        const argTy = ast.params.map(p =>
            p.typeAnnotation + (p.isArray ? "[]" : "")
        );

        const fn = this.wrapper.fn(ast.name, argTy, ast.returnType);
        const entry = this.wrapper.createBlock(fn, "entry");
		this.wrapper.builder.SetInsertPoint(entry);
        const isMain = ast.name === "main";

        let returned = false;
        for (const expr of ast.body) {
            this.table[expr.type]?.call(this, expr);
            if (expr.type === "ReturnExpression") {
                returned = true;
                break;
            }
        }

        if (!returned) {
            if (isMain) this.wrapper.ret(this.wrapper.literal(0));
            else if (ast.returnType === "void") this.wrapper.ret();
            else throw new Error(`Function ${ast.name} must return a value of type ${ast.returnType}`);
        }

        return fn;
    }

    private genExternalFnDeclaration(ast: ExternalFnDeclarationAST): vm.Function | void {
        const argTy = ast.params.map(p =>
            p.typeAnnotation + (p.isArray ? "[]" : "")
        );
        return this.wrapper.fn(ast.name, argTy, ast.returnType, vm.Function.LinkageTypes.ExternalLinkage, ast.isVariadic || false);
    }

    private genReturnExpression(ast: ReturnExpressionAST): vm.Value | void {
        const arg = ast.argument ? this.table[ast.argument.type]?.call(this, ast.argument) : null;

        if (!arg) {
            return this.wrapper.ret(); // Handle void return
        } else {
            return this.wrapper.ret(arg); // Return the evaluated value
        }
    }

    private genFnCall(ast: FnCallAST): vm.Value | undefined {
        const { args, callee } = ast
        // callee could be memberaccess or identifier or sum else
        switch (callee.type) {
            case "Identifier":
                const i = callee as IdentifierAST;
                const fn = this.wrapper.module.getFunction(i.value);
                if (!fn) {
                    throw new Error(`Function ${i.value} not found`);
                }
                return this.wrapper.fnCall(
                    fn,
                    args.map(arg => this.table[arg.type]?.call(this, arg)).filter((v): v is vm.Value => v !== undefined),
                    fn.getReturnType()
                );
            case "MemberAccess":
                const { object, property } = callee as MemberAccessAST;
                switch (object.type) {
                    case "Identifier":
                        const { value } = object as IdentifierAST;
                        const objFn = this.wrapper.module.getFunction(`${value}.${property}`);
                        if (!objFn) {
                            throw new Error(`Function ${value} not found`);
                        }

                        return this.wrapper.fnCall(
                            objFn,
                            args.map(arg => this.table[arg.type]?.call(this, arg)).filter((v): v is vm.Value => v !== undefined),
                            objFn.getReturnType()
                        );
                }
                break;
        }
        return undefined;
    }

    private genLiteral(ast: LiteralAST): vm.Value {
        return this.wrapper.literal(ast.value);
    }
}