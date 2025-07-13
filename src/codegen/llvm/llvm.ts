import { Codegen } from "..";
import { LLVMHelper } from "./helper";

export class LLVMGen extends Codegen {
    helper: LLVMHelper = new LLVMHelper();
    
    generate(): string {
        return this.helper.print();
    }
}