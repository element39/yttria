import VM, { BasicBlock, Context, Func, FunctionType, IRBuilder, Linkage, Module } from "../bindings";

export class LLVMHelper {
    public name: string;

    public ctx: Context;
    public mod: Module;
    public builder: IRBuilder;

    public currentFunction: Func | null = null;

    constructor(name: string) {
        this.name = name;

        this.ctx = new VM.Context();
        this.mod = new VM.Module(name, this.ctx);
        this.builder = new VM.IRBuilder(this.ctx);
    }

    fn(
        name: string,
        fnType: FunctionType,
        opts?: {
            linkage?: Linkage;
            extern?: boolean;
        },
        body?: (fn: Func) => void
    ): Func {
        let func = this.mod.getFunction(name);
        if (func) throw new Error(`function ${name} already exists`);

        func = this.mod.createFunction(
            name,
            fnType,
            opts ?? {
                linkage: Linkage.External,
                extern: false
            }
        );

        if (opts?.extern) return func;

        const entry = func.addBlock("entry");
        this.builder.insertInto(entry);
        this.currentFunction = func;

        body?.(func);
        return func;
    }

    declareFn(
        name: string,
        fnType: FunctionType,
        opts?: {
            linkage?: Linkage;
            extern?: boolean;
        }
    ): Func {
        let func = this.mod.getFunction(name);
        if (opts?.extern && func) return func;
        
        if (func) throw new Error(`function ${name} already exists`);

        return this.mod.createFunction(
            name,
            fnType,
            opts ?? {
                linkage: Linkage.External,
                extern: false
            }
        );
    }

    block(name: string, body: (block: BasicBlock) => void) {
        if (!this.currentFunction) throw new Error("no current function to add block to");
        const block = this.currentFunction.addBlock(name);
        const currentBlock = this.builder.getInsertBlock();
        if (!currentBlock) throw new Error("failed to get current block");

        this.builder.insertInto(block);
        body(block);

        this.builder.insertInto(currentBlock);
        return block;
    }

    setCurrentFunction(fn: Func) {
        this.currentFunction = fn;
    }

    toString(): string {
        return this.mod.toString();
    }
}