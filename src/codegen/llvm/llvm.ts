import llvm from "llvm-bindings";
import { BinaryExpression, ConstDeclaration, Expression, FunctionDeclaration, NumberLiteral, ReturnExpression } from "../../parser/ast";
import { Codegen } from "../codegen";

export class LLVMGen extends Codegen {
    private helper = new LLVMHelper();
    private variables: {
        [name: string]: {
            type: llvm.Type;
            value: llvm.Value;
        }
    } = {};

    public generate(): string {
        for (const expr of this.ast.body) {
            this.genExpression(expr);
        }

        // verify
        if (llvm.verifyModule(this.helper.module)) {
            throw new Error("LLVM module verification failed");
        }

        return this.helper.print();
    }

    private genExpression(expr: Expression): llvm.Value | llvm.Function | undefined {
        switch (expr.type) {
            case "ConstDeclaration":
                return this.genConstDeclaration(expr as ConstDeclaration);
            case "FunctionDeclaration":
                return this.genFunctionDeclaration(expr as FunctionDeclaration);
            case "ReturnExpression":
                return this.genReturnExpression(expr as ReturnExpression);
            case "BinaryExpression": 
                return this.genBinaryExpression(expr as BinaryExpression);
            case "NumberLiteral":
                return this.genNumberLiteral(expr as NumberLiteral);
        }

        return undefined;
    }

    private genFunctionDeclaration(decl: FunctionDeclaration): llvm.Function {
        const name = decl.name.name;
        const returnTy = this.helper.type(decl.returnType?.inferredType || decl.returnType?.name || "void");
        const [fn, fnType, entry]: [llvm.Function, llvm.FunctionType, llvm.BasicBlock] = this.helper.fn(name, [], returnTy, () => {
            for (const expr of decl.body) {
                this.genExpression(expr);
                if (expr.type === "ReturnExpression") {
                    return;
                }
            }
            if (returnTy.isVoidTy()) {
                this.helper.ret();
            } else {
                throw new Error(`Function ${name} must return a value of type ${this.helper.typeName(returnTy)}`);
            }
        });
        return fn;
    }

    private genReturnExpression(expr: ReturnExpression): llvm.Value | undefined {
        const value = this.genExpression(expr.value);
        this.helper.ret(value);
        return value;
    }

    private genConstDeclaration(decl: ConstDeclaration) {
        const name = decl.name.name;
        const constTy = this.helper.type(decl.inferredType || decl.typeAnnotation?.name || "");
        const value = this.genExpression(decl.value);
        if (!value) throw new Error(`Value for constant ${name} is undefined`);

        const alloca = this.helper.alloca(constTy, name);
        this.helper.store(alloca, value);
        this.variables[name] = {
            type: constTy,
            value: alloca
        };

        return alloca;
    }

    private genBinaryExpression(expr: BinaryExpression): llvm.Value {
        const left = this.genExpression(expr.left);
        const right = this.genExpression(expr.right);

        if (!left || !right) {
            throw new Error(`Invalid binary expression: ${expr.left} ${expr.operator} ${expr.right}`);
        }

        switch (expr.operator) {
            case "+":
                return this.helper.add(left, right);
            case "-":
                return this.helper.sub(left, right);
            case "*":
                return this.helper.mul(left, right);
            case "/":
                return this.helper.div(left, right);
            default:
                throw new Error(`Unsupported operator: ${expr.operator}`);
        }
    }

    private genNumberLiteral(literal: NumberLiteral): llvm.Value {
        const value = literal.value;
        const type = this.helper.type(literal.inferredType || "int");
        
        if (type.getTypeID() === llvm.Type.TypeID.IntegerTyID) {
            return llvm.ConstantInt.get(type, value, true);
        } else if (type.isFloatingPointTy()) {
            return llvm.ConstantFP.get(type, value);
        } else {
            throw new Error(`Unsupported type for number literal: ${literal.inferredType}`);
        }
    }
}

export class LLVMHelper {
    public context = new llvm.LLVMContext();
    public module = new llvm.Module("main", this.context);
    public builder = new llvm.IRBuilder(this.context);

    private types = {
        int: llvm.Type.getInt32Ty(this.context),
        i32: llvm.Type.getInt32Ty(this.context),
        i64: llvm.Type.getInt64Ty(this.context),

        float: llvm.Type.getFloatTy(this.context),
        f32: llvm.Type.getFloatTy(this.context),
        f64: llvm.Type.getDoubleTy(this.context),

        void: llvm.Type.getVoidTy(this.context),
    }

    type(ty: string): llvm.Type {
        if (ty in this.types) {
            return this.types[ty as keyof typeof this.types];
        } else {
            throw new Error(`Unknown type: ${ty}`);
        }
    }

    typeName(ty: llvm.Type): string {
        switch (ty.getTypeID()) {
            case llvm.Type.TypeID.IntegerTyID:
                return "int";
            case llvm.Type.TypeID.FloatTyID:
                return "float";
            case llvm.Type.TypeID.DoubleTyID:
                return "double";
            case llvm.Type.TypeID.VoidTyID:
                return "void";
            case llvm.Type.TypeID.FunctionTyID:
                return "function";
            case llvm.Type.TypeID.PointerTyID:
                return `pointer to ${this.typeName(ty.getPointerElementType())}`;
            default:
                throw new Error(`Unknown LLVM type: ${ty.getTypeID()}`);
        }
    }

    fn(name: string, paramTypes: llvm.Type[], returnType: llvm.Type, body: () => any): [llvm.Function, llvm.FunctionType, llvm.BasicBlock] {
        const fnType = llvm.FunctionType.get(returnType, paramTypes, false);
        const fn = llvm.Function.Create(fnType, llvm.Function.LinkageTypes.ExternalLinkage, name, this.module);
        const entry = llvm.BasicBlock.Create(this.context, "entry", fn);

        this.builder.SetInsertPoint(entry);
        body();

        return [fn, fnType, entry];
    }

    alloca(type: llvm.Type, name?: string) {
        const alloca = this.builder.CreateAlloca(type, null, name);
        return alloca;
    }

    store(ptr: llvm.Value, value: llvm.Value) {
        return this.builder.CreateStore(value, ptr);
    }

    load(type: llvm.Type, ptr: llvm.Value, name?: string) {
        return this.builder.CreateLoad(type, ptr, name);
    }

    add(a: llvm.Value, b: llvm.Value, name?: string) {
        return this.builder.CreateAdd(a, b, name || "addtmp");
    }

    sub(a: llvm.Value, b: llvm.Value, name?: string) {
        return this.builder.CreateSub(a, b, name || "subtmp");
    }

    mul(a: llvm.Value, b: llvm.Value, name?: string) {
        return this.builder.CreateMul(a, b, name || "multmp");
    }

    div(a: llvm.Value, b: llvm.Value, name?: string) {
        return this.builder.CreateSDiv(a, b, name || "divtmp");
    }

    ret(val?: llvm.Value) {
        if (val) return this.builder.CreateRet(val);
        return this.builder.CreateRetVoid();
    }

    print() {
        return this.module.print();
    }
}