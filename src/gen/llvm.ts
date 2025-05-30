import vm from 'llvm-bindings';
import { ASTType, Expression, FnCallAST, FnDeclarationAST, IdentifierAST, LiteralAST, MemberAccessAST, ProgramAST, ReturnExpressionAST } from '../parser/ast';
import { CodeGen } from './gen';

export class LLVMGen extends CodeGen {
    private ctx: vm.LLVMContext;
    private module: vm.Module;
    private builder: vm.IRBuilder;

    private types: Record<string, vm.Type>;
    private table: Partial<Record<ASTType, (e: Expression) => vm.Value | vm.Function>>;

    constructor(name: string, ast: ProgramAST) {
        super(name, ast);

        this.ctx = new vm.LLVMContext();
        this.module = new vm.Module(name, this.ctx);
        this.builder = new vm.IRBuilder(this.ctx);

        this.types = {
            string: vm.Type.getInt8PtrTy(this.ctx),
            "string[]": vm.Type.getInt8PtrTy(this.ctx).getPointerTo(), // char**
            number: vm.Type.getFloatTy(this.ctx),
            void: vm.Type.getVoidTy(this.ctx),
        };

        this.table = {
            FnDeclaration: (e) => this.generateFnDeclaration(e),
        }
    }

    generate(): string {
        for (const node of this.ast.body) {
            this.table[node.type]?.(node);
        }

        if (vm.verifyModule(this.module)) throw new Error('Module verification failed');

        return this.module.print();
    }

    private generateFnDeclaration(e: Expression): vm.Function {
        const { name, returnType, params, body } = e as FnDeclarationAST;
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
            const vmExpr = this.generateExpression(expr, localVars);
            if (vmExpr instanceof vm.ReturnInst) {
                hasReturn = true;
                break;
            }
        }   

        return func;
    }
    
    private generateExpression(expr: Expression, localVars: Record<string, vm.Value>): vm.Value | vm.Function {
        switch (expr.type) {
            case "ReturnExpression":
                const { argument } = expr as ReturnExpressionAST;
                const value = this.generateExpression(argument, localVars);
                if (!(value instanceof vm.Value)) {
                    throw new Error(`Expected a value for return, got ${value}`);
                }
                return this.builder.CreateRet(value);
            case "FnCall":
                const { args, callee } = expr as FnCallAST;
                const funcName = this.resolveCalleeName(callee);
                const func = this.module.getFunction(funcName);
                if (!func) {
                    throw new Error(`Function ${funcName} not found`);
                }
                const argsMap = args.map((arg: Expression) => {
                    const val = this.generateExpression(arg, localVars);
                    if (!(val instanceof vm.Value)) throw new Error("Invalid argument value");
                    return val;
                });
                return this.builder.CreateCall(func, argsMap, "calltmp");
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
            return (expr as IdentifierAST).value;
        }
        if (expr.type === "MemberAccess") {
            const member = expr as MemberAccessAST;
            return `${this.resolveCalleeName(member.object)}.${member.property}`;
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