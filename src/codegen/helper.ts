import VM, { Context, Func, FunctionType, IRBuilder, Linkage, Module } from "../bindings";

export class LLVMHelper {
    public name: string;
    
    public ctx: Context;
    public mod: Module;
    public builder: IRBuilder;

    currentFunction: Func | null = null;
    
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

        this.currentFunction = func;
        return func;
    }

    toString() {
        const raw = this.mod.toString();
        let out = raw.replace(
            /define\s+(\w[\w\s\*]*)\s+@([A-Za-z0-9_\.]+)\(([^)]*)\)\s*{\s*entry:\s*}/g,
            (_m, ret, name, params) => `declare ${ret.trim()} @${name}(${params})`
        );
        out = out.replace(/^entry:\s*\n\s*\n/mg, "");
        out = out.replace(
            /^([ \t]*)%[A-Za-z_][A-Za-z0-9_]*\s*=\s*(call void)/mg,
            '$1$2'
        );
        return out;
    }
}