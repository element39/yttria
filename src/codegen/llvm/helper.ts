import vm from "llvm-bindings";

export class LLVMHelper {
    context = new vm.LLVMContext();
    module = new vm.Module('yt-module', this.context);
    builder = new vm.IRBuilder(this.context);

    print(): string {
       this.verify()
        return this.module.print()
    }

    verify(v?: vm.Function) {
        if (v instanceof vm.Function) {
            if (vm.verifyFunction(v)) {
                throw new Error(`Function verification failed: ${v.getName()}`)
            }

            return;
        }
        
        if (vm.verifyModule(this.module)) {
            throw new Error(`Module verification failed: ${this.module.getName()}`)
        }
    }

    fn(options: {
        name: string
        linkage?: "external" | "internal"
    }): vm.Function {
        const linkage = options.linkage ?? "internal";
        const fnTy = vm.FunctionType.get(this.builder.getVoidTy(), [], false);
        const fn = vm.Function.Create(
            fnTy,
            linkage === "external"
                ? vm.Function.LinkageTypes.ExternalLinkage
                : vm.Function.LinkageTypes.InternalLinkage,
            options.name,
            this.module
        );

        return fn;
    }
}