import vm from 'llvm-bindings';
import { ProgramAST } from '../parser/ast';
import { CodeGen } from './gen';

export class LLVMGen extends CodeGen {
    private ctx: vm.LLVMContext;
    private module: vm.Module;
    private builder: vm.IRBuilder;

    private types: Record<string, vm.Type>;

    constructor(name: string, ast: ProgramAST) {
        super(name, ast);

        this.ctx = new vm.LLVMContext();
        this.module = new vm.Module(name, this.ctx);
        this.builder = new vm.IRBuilder(this.ctx);

        this.types = {
            i32: vm.Type.getInt32Ty(this.ctx),
            void: vm.Type.getVoidTy(this.ctx),
        };
    }

    generate(): string {
        const func = this.createFunction('add', this.types.i32, [this.types.i32, this.types.i32]);

        this.createEntryBlock(func);
        const [a, b] = this.getFunctionArgs(func);

        const result = this.builder.CreateAdd(a, b);
        this.builder.CreateRet(result);

        if (vm.verifyFunction(func)) throw new Error('Function verification failed');
        if (vm.verifyModule(this.module)) throw new Error('Function verification failed');

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