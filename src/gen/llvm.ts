import vm from 'llvm-bindings';
import { ASTType, Expression, FnCallAST, FnDeclarationAST, FnParamAST, IdentifierAST, LiteralAST, MemberAccessAST, ProgramAST, ReturnExpressionAST } from '../parser/ast';
import { CodeGen } from './gen';

export class LLVMGen extends CodeGen {
    private ctx: vm.LLVMContext;
    private module: vm.Module;
    private builder: vm.IRBuilder;

    private types: Record<string, vm.Type>;
    private table: Partial<Record<ASTType, (e: Expression) => vm.Value | vm.Function>>;

    private currentParams: FnParamAST[] | null = null;

    constructor(name: string, ast: ProgramAST) {
        super(name, ast);

        this.ctx = new vm.LLVMContext();
        this.module = new vm.Module(name, this.ctx);
        this.builder = new vm.IRBuilder(this.ctx);

        this.types = {
            void: vm.Type.getVoidTy(this.ctx),

            string: vm.Type.getInt8PtrTy(this.ctx),
            "string[]": vm.Type.getInt8PtrTy(this.ctx).getPointerTo(), // char**

            int: vm.Type.getInt32Ty(this.ctx),
            "int[]": vm.Type.getInt32Ty(this.ctx).getPointerTo(), // int*
            number: vm.Type.getFloatTy(this.ctx),
        };

        this.table = {
            FnDeclaration: (e) => this.generateFnDeclaration(e),
        }
    }

    generate(): string {
        // register functions
        for (const node of this.ast.body) {
            if (node.type === "FnDeclaration") {
                this.generateFnDeclaration(node as FnDeclarationAST);
            }

            if (node.type === "ExternalFnDeclaration") {
                this.generateExternalFnDeclaration(node as FnDeclarationAST);
            }
        }

        for (const node of this.ast.body) {
            if (node.type === "FnDeclaration" || node.type === "ExternalFnDeclaration") continue;
            this.table[node.type]?.(node);
        }

        if (vm.verifyModule(this.module)) throw new Error('Module verification failed');

        return this.module.print();
    }

    private generateExternalFnDeclaration(e: FnDeclarationAST): vm.Function {
        const { name, returnType, params } = e;
        const realName = name === "io.printf" ? "printf" : name;
        const llvmRet  = this.types[returnType] || vm.Type.getVoidTy(this.ctx);
        const paramTs  = params.map(p => this.types[p.typeAnnotation]!);

        // mark it variadic so `printf("%s\n", s)` is legal
        const fnTy = vm.FunctionType.get(llvmRet, paramTs, /*isVarArg=*/true);
        return vm.Function.Create(fnTy,
            vm.Function.LinkageTypes.ExternalLinkage,
            realName,
            this.module
        );
    }

    private generateFnDeclaration(e: Expression): vm.Function {
        const { name, returnType, params, body } = e as FnDeclarationAST;
        this.currentParams = params;

        const llvmReturnType = this.types[returnType] || vm.Type.getVoidTy(this.ctx);
        const paramTypes = params.map(param => {
            const t = this.types[param.typeAnnotation];
            if (!t) throw new Error(`Unknown parameter type: ${param.typeAnnotation}`);
            return t;
        });

        const func = this.createFunction(name, llvmReturnType, paramTypes);
        const entry = this.createEntryBlock(func);

        const args = this.getFunctionArgs(func);
        const localVars: Record<string, vm.Value> = {};

        for (let i = 0; i < params.length; i++) {
            const param = params[i];
            const llvmType = this.types[param.typeAnnotation];
            if (!llvmType) throw new Error(`Unknown parameter type: ${param.typeAnnotation}`);
            const localVar = this.builder.CreateAlloca(llvmType, null, param.name);
            this.builder.SetInsertPoint(entry);
            this.builder.CreateStore(args[i], localVar);
            localVars[param.name] = localVar;
        }

        this.builder.SetInsertPoint(entry);
        
        let hasReturn = false;
        for (const expr of body) {
            const inst = this.generateExpression(expr, localVars);
            if (inst instanceof vm.ReturnInst) {
                hasReturn = true;
                break;
            }
        }

        if (!hasReturn) {
            // if the function returns void
            if (llvmReturnType.isVoidTy()) {
                this.builder.CreateRetVoid();
            } else {
                // default zero for non‐void
                const zeroConst = vm.Constant.getNullValue(llvmReturnType);
                this.builder.CreateRet(zeroConst);
            }
        }

        this.builder.ClearInsertionPoint();
        this.currentParams = null;
        return func;
    }
    
    private generateExpression(expr: Expression, localVars: Record<string, vm.Value>): vm.Value | vm.Function {
        switch (expr.type) {
            case "Literal":
                const lit = expr as LiteralAST;
                switch (typeof lit.value) {
                    case "number":
                        if (Number.isInteger(lit.value)) {
                            return vm.ConstantInt.get(this.types.int, lit.value);
                        } else {
                            return vm.ConstantFP.get(this.types.number, lit.value);
                        }
                    case "string":
                        const str = vm.ConstantDataArray.getString(this.ctx, lit.value, true);
                        const global = new vm.GlobalVariable(
                            this.module,
                            str.getType(),
                            true,
                            vm.GlobalValue.LinkageTypes.PrivateLinkage,
                            str,
                            ".str"
                        );
                        return this.builder.CreatePointerCast(global, this.types.string, "strptr");
                    default:
                        throw new Error(`Unsupported literal value: ${lit.value}`);
                }
            case "Identifier":
                const id = expr as IdentifierAST;
                const local = localVars[id.value];
                if (!local) throw new Error(`Unknown identifier: ${id.value}`);
                // Use the correct type for the identifier
                // Find the type from the localVars or params
                let llvmType = null;
                // Try to get type from params if available
                if (this.currentParams) {
                    const param = this.currentParams.find(p => p.name === id.value);
                    if (param) llvmType = this.types[param.typeAnnotation];
                }
                // Fallback: try to infer from alloca type (not always possible)
                if (!llvmType) llvmType = local.getType() || vm.Type.getInt8PtrTy(this.ctx);
                return this.builder.CreateLoad(llvmType, local, id.value);
            case "ReturnExpression":
                const { argument } = expr as ReturnExpressionAST;
                if (!argument) {
                    return this.builder.CreateRetVoid();
                }
                const value = this.generateExpression(argument, localVars);
                if (!(value instanceof vm.Value)) {
                    throw new Error(`Expected a value for return, got ${value}`);
                }
                return this.builder.CreateRet(value);
            case "FnCall":
                const { args, callee } = expr as FnCallAST;
                const funcName = this.resolveCalleeName(callee);
                const func = this.module.getFunction(funcName);
                if (!func) throw new Error(`Function ${funcName} not found`);

                const llvmArgs = args.map(arg => {
                    const v = this.generateExpression(arg, localVars);
                    if (!(v instanceof vm.Value)) throw new Error("Invalid arg");
                    return v;
                });

                // if return type is void, give no name; otherwise use "calltmp"
                const isVoid = func.getReturnType().isVoidTy();
                const name   = isVoid ? "" : "calltmp";

                return this.builder.CreateCall(func, llvmArgs, name);
            default:
                if (this.table[expr.type]) {
                    return this.table[expr.type]!(expr);
                } else {
                    throw new Error(`Unknown expression type: ${expr.type}`);
                }
        }
    }

    private resolveCalleeName(expr: Expression): string {
        if (expr.type === "Identifier") {
            const name = (expr as IdentifierAST).value;
            // Special-case: map "io.printf" identifier to "printf"
            if (name === "io.printf") return "printf";
            return name;
        }
        if (expr.type === "MemberAccess") {
            const member = expr as MemberAccessAST;
            const obj = this.resolveCalleeName(member.object);
            // Special-case: map io.printf to printf
            if (obj === "io" && member.property === "printf") return "printf";
            return `${obj}.${member.property}`;
        }
        if (expr.type === "Literal") {
            return String((expr as LiteralAST).value);
        }
        throw new Error(`Unsupported callee type: ${expr.type}`);
    }

    private createFunction(
        name: string,
        returnType: vm.Type,
        paramTypes: vm.Type[],
        linkage: number = vm.Function.LinkageTypes.ExternalLinkage
    ): vm.Function {
        return vm.Function.Create(vm.FunctionType.get(returnType, paramTypes, false), linkage, name, this.module);
    }

    private createEntryBlock(func: vm.Function, name = 'entry'): vm.BasicBlock {
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
}