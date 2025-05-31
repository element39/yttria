import vm from 'llvm-bindings';
import { ASTType, Expression, FnParamAST, ProgramAST } from '../parser/ast';
import { CodeGen } from './gen';

export class LLVMGen extends CodeGen {
    private ctx: vm.LLVMContext;
    private module: vm.Module;
    private builder: vm.IRBuilder;
    private types: Partial<Record<string, vm.Type>>
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
            int: vm.Type.getInt32Ty(this.ctx),
            number: vm.Type.getFloatTy(this.ctx),
        };
        
        Object.entries(this.types).forEach(([key, type]) => {
            if (key.endsWith('[]') || key === 'void' || !type) return;
            this.types[key + '[]'] = type.getPointerTo();
        });

        this.table = {};
    }

    generate(): string {
        for (const node of this.ast.body) this.table[node.type]?.(node);
        if (vm.verifyModule(this.module)) throw new Error('Module verification failed');

        return this.module.print();
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