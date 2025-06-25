import vm from "llvm-bindings";
import { Expression, LiteralAST } from "../../parser/ast";

export class LLVMWrapper {
	public ctx: vm.LLVMContext;
	public module: vm.Module;
	public builder: vm.IRBuilder;
	public types: TypeRegistry;
	public table: Partial<Record<string, (ast: Expression) => vm.Value | vm.Function | void>>;

	constructor(name: string, table: Partial<Record<string, (ast: Expression) => vm.Value | vm.Function | void>> = {}) {
		this.ctx     = new vm.LLVMContext();
		this.module  = new vm.Module(name, this.ctx);
		this.builder = new vm.IRBuilder(this.ctx);
		this.types   = new TypeRegistry(this.ctx);
		this.table = table;
	}

	getType(name: string) {
		return this.types.get(name);
	}

	fnCall(
		callee: vm.Function,
		args: vm.Value[] = [],
		returnType: vm.Type
	): vm.Value {
		const argTypes = args.map(arg => arg.getType());

		if (this.getTypeString(callee.getReturnType()) !== this.getTypeString(returnType)) {
			throw new Error(`Function ${callee.getName()} expected return type ${this.getTypeString(returnType)}, got ${this.getTypeString(callee.getReturnType())}`);
		}
		
		const name = callee.getReturnType().isVoidTy() ? undefined : "call";
  		return this.builder.CreateCall(callee, args, name);
	}

	getTypeString(type: vm.Type): string {
		switch (type.getTypeID()) {
			case vm.Type.TypeID.VoidTyID:
				return "void";
			case vm.Type.TypeID.IntegerTyID:
				return "int";
			case vm.Type.TypeID.FloatTyID:
				return "float";
			case vm.Type.TypeID.DoubleTyID:
				return "double";
			case vm.Type.TypeID.PointerTyID:
				return `${this.getTypeString(type.getPointerElementType())}*`;
		}

		throw new Error(`Unknown type ID: ${type.getTypeID()}`);
	}

	fn(
		name: string,
		args: string[] = [],
		returnType: string = "void",
		linkage = vm.Function.LinkageTypes.InternalLinkage,
		isVariadic: boolean = false
	): vm.Function {
		const retType = this.getType(returnType);
		const argTypes = args.map(arg => this.getType(arg));

		const fn = this.createFunction(name, retType, argTypes, linkage, isVariadic);
		return fn;
	}

	ret(value?: vm.Value): vm.Value | void {
		if (value) {
			this.builder.CreateRet(value);
			return value;
		} else {
			this.builder.CreateRetVoid();
			return;
		}
	}

	literal(value:  LiteralAST["value"]): vm.Value {
		switch (typeof value) {
			case "number":
				if (Number.isInteger(value)) {
					return vm.ConstantInt.get(this.getType("int"), value);
				} else {
					return vm.ConstantFP.get(this.getType("float"), value);
				}
			case "string":
				return this.builder.CreateGlobalStringPtr(value, "str");
			default:
				throw new Error(`Unsupported literal type: ${typeof value}`);
		}
	}

	createFunction(name: string, retType: vm.Type, argTypes: vm.Type[], linkage = vm.Function.LinkageTypes.InternalLinkage, isVariadic: boolean = false): vm.Function {
		const type = vm.FunctionType.get(retType, argTypes, isVariadic);
		
		const fn = vm.Function.Create(
			type,
			linkage,
			name,
			this.module
		);

		if (!fn) throw new Error(`Failed to create function: ${name}`);
		return fn;
	}

	createBlock(fn: vm.Function, name: string): vm.BasicBlock {
		const block = vm.BasicBlock.Create(this.ctx, name, fn);
		if (!block) throw new Error(`Failed to create basic block: ${name}`);
		this.builder.SetInsertPoint(block);
		return block;
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


export class TypeRegistry {
	private ctx: vm.LLVMContext;
	private types: Map<string, vm.Type>;

	constructor(ctx: vm.LLVMContext) {
		this.ctx = ctx;
		this.types = new Map();

		// Base LLVM primitive types
		this.register("void", vm.Type.getVoidTy(ctx));
		this.register("int", vm.Type.getInt32Ty(ctx));
		this.register("float", vm.Type.getFloatTy(ctx));
		this.register("double", vm.Type.getDoubleTy(ctx));
		this.register("char", vm.Type.getInt8Ty(ctx));
		this.register("bool", vm.Type.getInt1Ty(ctx));
		this.register("string", vm.Type.getInt8PtrTy(ctx));

		this.alias("number", "float");

		for (const key of ["int", "float", "double", "char", "bool", "string", "number"]) {
			const baseType = this.get(key);
			this.register(`${key}[]`, baseType.getPointerTo());
		}
	}

	register(name: string, llvmType: vm.Type) {
		if (this.types.has(name)) throw new Error(`Type ${name} already registered.`);
		this.types.set(name, llvmType);
	}

	alias(name: string, existingName: string) {
		const type = this.types.get(existingName);
		if (!type) throw new Error(`Cannot create alias: base type '${existingName}' not found.`);
		this.types.set(name, type);
	}

	get(name: string): vm.Type {
		const t = this.types.get(name);
		if (!t) throw new Error(`Unknown LLVM type requested: ${name}`);
		return t;
	}
}
