import vm from "llvm-bindings";

export class LLVMHelper {
    context = new vm.LLVMContext();
    module = new vm.Module('yt-module', this.context);
    builder = new vm.IRBuilder(this.context);

    currentFunction: vm.Function | null = null;

    print(): string {
       this.verify()
        return this.module.print()
    }

    verify(v?: vm.Function): vm.Function | vm.Module | null {
        if (v instanceof vm.Function) {
            if (vm.verifyFunction(v)) {
                throw new Error(`Function verification failed: ${v.getName()}`)
            }

            return v;
        }
        
        if (vm.verifyModule(this.module)) {
            throw new Error(`Module verification failed: ${this.module.getName()}`)
        } else {
            return this.module;
        }
    }

    fn(name: string, type: vm.FunctionType,linkage: "internal" | "external" = "internal"): vm.Function {
        const fnTy = vm.FunctionType.get(type, [], false);
        const fn = vm.Function.Create(
            fnTy,
            linkage === "external"
                ? vm.Function.LinkageTypes.ExternalLinkage
                : vm.Function.LinkageTypes.InternalLinkage,
            name,
            this.module
        );

        this.currentFunction = fn;
        
        return fn;
    }

    block(name: string, body?: () => void): vm.BasicBlock {
        const currentFn = this.currentFunction;
        if (!currentFn) throw new Error("no current function set for block creation");

        const block = vm.BasicBlock.Create(this.context, name, currentFn);
        this.builder.SetInsertPoint(block);

        if (body) body();
        return block;
    }

    alloc(name: string, type: vm.Type): vm.AllocaInst {
        if (!this.currentFunction) throw new Error("No current function for allocation");
        const entry = this.currentFunction.getEntryBlock();

        const currentBlock = this.builder.GetInsertBlock();
        this.builder.SetInsertPoint(entry);

        const alloca = this.builder.CreateAlloca(type, null, name);
        if (currentBlock) this.builder.SetInsertPoint(currentBlock);

        return alloca;
    }

    store(ptr: vm.Value, value: vm.Value): void {
        if (!this.currentFunction) throw new Error("No current function for store operation");
        this.builder.CreateStore(value, ptr);
    }

    load(ptr: vm.Value, name: string): vm.Value {
        if (!this.currentFunction) throw new Error("No current function for load operation");
        return this.builder.CreateLoad(ptr.getType(), ptr, name);
    }

    variable(name: string, type: vm.Type, value?: vm.Value): { alloca: vm.AllocaInst, load: vm.Value } {
        const alloca = this.alloc(name, type);
        if (value) {
            this.store(alloca, value);
        }

        const load = this.load(alloca, name);
        return { alloca, load };
    }
}