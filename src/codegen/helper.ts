import VM, { Context, Func, FunctionType, IRBuilder, Linkage, Module, Value } from "../bindings";

export class LLVMHelper {
    public name: string;
    
    public ctx: Context;
    public mod: Module;
    public builder: IRBuilder;

    // currentFunction: Func | null = null;
    
    constructor(name: string) {
        this.name = name
        
        this.ctx = new VM.Context();
        this.mod = new VM.Module(name, this.ctx);
        this.builder = new VM.IRBuilder(this.ctx);
    }

    fn(name: string, fnType: FunctionType, opts?: {
        linkage?: Linkage;
        extern?: boolean;
    }): Func {
        let func = this.mod.getFunction(name);
        if (func) return func;
        func = this.mod.createFunction(name, fnType, opts ?? { linkage: Linkage.External, extern: false });
        if (!opts?.extern)   this.builder.insertInto(func.addBlock("entry"));

        // this.currentFunction = func;
        return func;
    }

    ret(value?: Value) {
        // if (!this.currentFunction) {
        //     throw new Error("No current function to return from");
        // }

        this.builder.ret(value);
    }

    toString() {
        return this.mod.toString();
    }
}