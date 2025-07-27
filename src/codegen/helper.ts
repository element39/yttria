import VM from "bun-llvm";

export class LLVMHelper {
    private ctx: InstanceType<typeof VM.Context>;
    private mod: InstanceType<typeof VM.Module>;
    private builder: InstanceType<typeof VM.IRBuilder>;
    private name: string;
    constructor(name: string) {
        this.name = name
        
        this.ctx = new VM.Context();
        this.mod = new VM.Module(name, this.ctx);
        this.builder = new VM.IRBuilder(this.ctx);
    }

    generate() {
        return this.mod.toString();
    }
}