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
}