import vm from "llvm-bindings";

export class LLVMWrapper {
    public ctx: vm.LLVMContext;
    public module: vm.Module;
    public builder: vm.IRBuilder;
    private types: Record<string, vm.Type>;

    constructor(name: string) {
        this.ctx     = new vm.LLVMContext();
        this.module  = new vm.Module(name, this.ctx);
        this.builder = new vm.IRBuilder(this.ctx);

        const primitives: Record<string, vm.Type> = {
            void:   vm.Type.getVoidTy(this.ctx),

            int:    vm.Type.getInt32Ty(this.ctx),
            float:  vm.Type.getFloatTy(this.ctx),
            double: vm.Type.getDoubleTy(this.ctx),
            number: vm.Type.getFloatTy(this.ctx),

            string: vm.Type.getInt8PtrTy(this.ctx),
            char:  vm.Type.getInt8Ty(this.ctx),
            bool:   vm.Type.getInt1Ty(this.ctx),
        };

        this.types = {};
        for (const [name, type] of Object.entries(primitives)) {
            this.types[name] = type;
            if (name !== "void") {
                this.types[`${name}[]`] = type.getPointerTo();
            }
        }
    }

    getType(name: string): vm.Type {
        const t = this.types[name];
        if (!t) throw new Error(`Unknown LLVM type: ${name}`);
        return t;
    }

    constInt(val: number, bits = 32): vm.ConstantInt {
        const ty = vm.Type.getIntNTy(this.ctx, bits);
        return vm.ConstantInt.get(ty, val);
    }

    constFloat(val: number): vm.ConstantFP {
        return vm.ConstantFP.get(this.types.float, val);
    }

    constStringPtr(str: string, name = "str"): vm.Value {
        return this.builder.CreateGlobalStringPtr(str, name);
    }

    createFunction(
        name: string,
        returnType: vm.Type,
        paramTypes: vm.Type[],
        linkage = vm.Function.LinkageTypes.ExternalLinkage
    ): vm.Function {
        const fnTy = vm.FunctionType.get(returnType, paramTypes, false);
        return vm.Function.Create(fnTy, linkage, name, this.module);
    }

    entryBlock(fn: vm.Function, label = "entry"): vm.BasicBlock {
        const bb = vm.BasicBlock.Create(this.ctx, label, fn);
        this.builder.SetInsertPoint(bb);
        return bb;
    }

    getArgs(fn: vm.Function): vm.Value[] {
        const args: vm.Value[] = [];
        for (let i = 0; i < fn.arg_size(); i++) {
            args.push(fn.getArg(i));
        }
        return args;
    }

    call(fn: vm.Function, args: vm.Value[], name = ""): vm.CallInst {
        return this.builder.CreateCall(fn, args, name);
    }

    ret(val?: vm.Value): void {
        if (val) this.builder.CreateRet(val);
        else     this.builder.CreateRetVoid();
    }

    defaultValue(type: keyof typeof this.types): vm.Value | undefined {
        switch (type) {
            case "void":
                return undefined
            case "int":
            case "float":
            case "double":
            case "number":
                return this.constInt(0);
            case "string":
                return this.constStringPtr("");
            default:
                throw new Error(`Unsupported type for default value: ${type}`);
        }
    }

    verify(type?: vm.Function): void {
        if (type) {
            switch (true) {
                case type instanceof vm.Function:
                    if (vm.verifyFunction(type)) throw new Error("Function verification failed");
                    break;
                default:
                    throw new Error("Unsupported type for verification");
            }
        } else {
            if (vm.verifyModule(this.module)) throw new Error("Module verification failed");
        }
    }

    print(): string {
        this.verify();
        return this.module.print();
    }
}