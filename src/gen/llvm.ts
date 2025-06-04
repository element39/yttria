import vm from "llvm-bindings";
import { ASTType, ExternalFnDeclarationAST, FnCallAST, FnDeclarationAST, FnParamAST, ProgramAST } from "../parser/ast";
import { CodeGen } from "./gen";

export class LLVMGen extends CodeGen {
    private ctx: vm.LLVMContext;
    private module: vm.Module;
    private builder: vm.IRBuilder;
    private types: Partial<Record<string, vm.Type>>
    private table: Partial<Record<ASTType, (e: any) => vm.Value | vm.Function>>;
    private currentParams: FnParamAST[] | null = null;
    private localVars: Map<string, vm.Value> = new Map();

    constructor(name: string, ast: ProgramAST) {
        super(name, ast);

        this.ctx = new vm.LLVMContext();
        this.module = new vm.Module(name, this.ctx);
        this.builder = new vm.IRBuilder(this.ctx);
        this.types = {
            void: vm.Type.getVoidTy(this.ctx),
            string: vm.Type.getInt8PtrTy(this.ctx),
            int: vm.Type.getInt32Ty(this.ctx),
            number: vm.Type.getFloatTy(this.ctx),
        };
        
        Object.entries(this.types).forEach(([key, type]) => {
            if (key.endsWith("[]") || key === "void" || !type) return;
            this.types[key + "[]"] = type.getPointerTo();
        });

        this.table = {
            FnDeclaration: this.visitFnDeclaration,
            ExternalFnDeclaration: this.visitExternalFnDecl,
            FnCall: this.visitFnCall,

            Literal: this.visitLiteral,
        };
    }

    generate(): string {
        for (const node of this.ast.body) this.table[node.type]?.(node);
        if (vm.verifyModule(this.module)) throw new Error("Module verification failed");

        return this.module.print();
    }

    private visitFnDeclaration = (e: FnDeclarationAST): vm.Function => {
        const returnType = this.getLLVMType(e.returnType);

        const paramTypes: vm.Type[] = [];
        this.currentParams = e.params;
        this.localVars.clear();

        for (const param of e.params) {
            const type = this.types[param.typeAnnotation];
            if (!type) {
                throw new Error(`Unknown parameter type: ${param.type}`);
            }
            paramTypes.push(type);
        }

        const fn = this.createFunction(e.name, returnType, paramTypes);
        const entry = this.createEntryBlock(fn);
        const args = this.getFunctionArgs(fn);

        this.builder.SetInsertPoint(entry);

        for (let i = 0; i < args.length; i++) {
        const param = this.currentParams?.[i];
        if (param) {
            const type = this.types[param.typeAnnotation];
            if (!type) {
                throw new Error(`Unknown parameter type: ${param.typeAnnotation}`);
            }
            const alloca = this.builder.CreateAlloca(type, null, param.name);
            this.builder.CreateStore(args[i], alloca);
            this.localVars.set(param.name, alloca);
        }
    }

        let returned = false;
        for (const bxpr of e.body) {
            const value = this.table[bxpr.type]?.(bxpr);
            if (bxpr.type === "ReturnExpression") {
                if (value) this.builder.CreateRet(value);
                else this.builder.CreateRetVoid();

                returned = true
                break;
            }
        }

        if (!returned) {
            if (returnType.isVoidTy()) this.builder.CreateRetVoid();
            if (e.name === "main" && returnType.isIntegerTy(32)) this.builder.CreateRet(vm.ConstantInt.get(returnType, 0));
        }

        if (this.builder.GetInsertBlock()?.getTerminator() === null) {
            throw new Error(`Function ${e.name} does not end with a return statement`);
        }

        this.currentParams = null;
        return fn;
    };

    private visitExternalFnDecl = (e: ExternalFnDeclarationAST): vm.Function => {
        const returnType = this.getLLVMType(e.returnType);

        const paramTypes: vm.Type[] = [];
        for (const param of e.params) {
            const type = this.types[param.typeAnnotation];
            if (!type) {
                throw new Error(`Unknown parameter type: ${param.typeAnnotation}`);
            }
            paramTypes.push(type);
        }

        return this.createFunction(e.name, returnType, paramTypes, vm.Function.LinkageTypes.ExternalLinkage);
    };

    private visitFnCall = (e: FnCallAST): vm.Value => {
        //console.log(e)
    };

    private visitLiteral = (e: { value: string | number }): vm.Value => {
        if (typeof e.value === "number") {
            return vm.ConstantFP.get(this.getLLVMType("number"), e.value);
        } else if (typeof e.value === "string") {
            return vm.ConstantDataArray.getString(this.ctx, e.value, true);
        }
        throw new Error(`Unsupported literal type: ${typeof e.value}`);
    };

    private createFunction(
        name: string,
        returnType: vm.Type,
        paramTypes: vm.Type[],
        linkage: number = vm.Function.LinkageTypes.ExternalLinkage
    ): vm.Function {
        return vm.Function.Create(vm.FunctionType.get(returnType, paramTypes, false), linkage, name, this.module);
    }

    private createEntryBlock(func: vm.Function, name = "entry"): vm.BasicBlock {
        const entryBB = vm.BasicBlock.Create(this.ctx, name, func);
        this.builder.SetInsertPoint(entryBB);
        return entryBB;
    }

    private getFunctionArgs(func: vm.Function): vm.Value[] {
        const args: vm.Value[] = [];
        for (let i = 0; i < func.arg_size(); i++) {
            args.push(func.getArg(i));
        }
        return args;
    }

    private getLLVMType(typeName: keyof typeof this.types): vm.Type {
    const type = this.types[typeName];
    if (!type) throw new Error(`Unknown type: ${typeName}`);
    return type;
    }
}