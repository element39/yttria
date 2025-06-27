import llvm from "llvm-bindings";
import {
	AssignmentDeclaration,
	BinaryExpression,
	ConstDeclaration,
	Expression,
	FloatLiteral,
	FunctionDeclaration,
	Identifier,
	IntegerLiteral,
	LetDeclaration,
	ReturnExpression,
} from "../../parser/ast";
import { Codegen } from "../codegen";

export class LLVMGen extends Codegen {
	private helper = new LLVMHelper();
	private variables: Record<string, { type: llvm.Type; value: llvm.Value }> = {};
	private inFunction = false;

	public generate(): string {
		for (const expr of this.ast.body) {
		this.genExpression(expr);
		}

		if (llvm.verifyModule(this.helper.module)) {
		throw new Error("LLVM module verification failed");
		}

		return this.helper.print();
	}

	private genExpression(expr: Expression): llvm.Value | llvm.Function | void {
		switch (expr.type) {
			case "ConstDeclaration":
				return this.genConstDeclaration(expr as ConstDeclaration);
			case "LetDeclaration":
				return this.genLetDeclaration(expr as LetDeclaration);
			case "AssignmentDeclaration":
				return this.genAssignment(expr as AssignmentDeclaration);
			case "FunctionDeclaration":
				return this.genFunctionDeclaration(expr as FunctionDeclaration);
			case "ReturnExpression":
				return this.genReturnExpression(expr as ReturnExpression);
			case "BinaryExpression":
				return this.genBinaryExpression(expr as BinaryExpression);
			case "IntegerLiteral":
				return this.genIntegerLiteral(expr as IntegerLiteral);
			case "FloatLiteral":
				return this.genFloatLiteral(expr as FloatLiteral);
			case "Identifier":
				return this.genIdentifier(expr as Identifier);
		}
	}

	private genFunctionDeclaration(decl: FunctionDeclaration): llvm.Function {
		const name = decl.name.name;
		const returnTy = this.helper.type(
			decl.returnType?.inferredType || decl.returnType?.name || "void"
		);

		this.inFunction = true;
		const [fn] = this.helper.fn(
			name,
			[],
			returnTy,
			() => {
				for (const expr of decl.body) {
					this.genExpression(expr);
					if (expr.type === "ReturnExpression") return;
				}

				if (returnTy.isVoidTy()) {
					this.helper.ret();
				} else {
					const last = decl.body[decl.body.length - 1];
					const value = this.genExpression(last) as llvm.Value;
					let retVal = value;
					const valTy = value.getType();
					if (returnTy.getTypeID() === llvm.Type.TypeID.IntegerTyID && valTy.isFloatingPointTy()) {
						retVal = this.helper.builder.CreateFPToSI(value, returnTy, "fptosi");
					} else if (returnTy.isFloatingPointTy() && valTy.isIntegerTy()) {
						retVal = this.helper.builder.CreateSIToFP(value, returnTy, "sitofp");
					}
					this.helper.ret(retVal);
				}
			}
		);
		this.inFunction = false;
		return fn;
	}

	private genReturnExpression(expr: ReturnExpression): llvm.Value {
		const value = this.genExpression(expr.value) as llvm.Value;
		this.helper.ret(value);
		return value;
	}

	private genFloatLiteral(lit: FloatLiteral): llvm.Value {
		return llvm.ConstantFP.get(this.helper.type(lit.inferredType || "float"), lit.value);
	}

	private genIdentifier(expr: Identifier): llvm.Value {
		const entry = this.variables[expr.name];
		if (!entry) {
		throw new Error(`Undefined variable: ${expr.name}`);
		}
		return this.helper.load(entry.type, entry.value, expr.name);
	}

	private genConstDeclaration(decl: ConstDeclaration): llvm.Value {
		const name = decl.name.name;
		const constTy = this.helper.type(
		decl.inferredType || decl.typeAnnotation?.name || ""
		);
		const init = this.genExpression(decl.value) as llvm.Value;
		if (!init) {
		throw new Error(`Value for constant ${name} is undefined`);
		}

		if (!this.inFunction) {
		const gv = new llvm.GlobalVariable(
			this.helper.module,
			constTy,
			true, /* isConstant */
			llvm.GlobalValue.LinkageTypes.ExternalLinkage,
			init as llvm.Constant,
			name
		);
		this.variables[name] = { type: constTy, value: gv };
		return gv;
		}

		const slot = this.helper.alloca(constTy, name);
		this.helper.store(slot, init);
		this.variables[name] = { type: constTy, value: slot };
		return slot;
	}

	private genLetDeclaration(decl: LetDeclaration): llvm.Value {
		const name = decl.name.name;
		const letTy = this.helper.type(
		decl.inferredType || decl.typeAnnotation?.name || "int"
		);
		const init = this.genExpression(decl.value) as llvm.Value;
		if (!init) {
		throw new Error(`Value for variable ${name} is undefined`);
		}
	
		if (!this.inFunction) {
		const gv = new llvm.GlobalVariable(
			this.helper.module,
			letTy,
			false, /* isConstant */
			llvm.GlobalValue.LinkageTypes.ExternalLinkage,
			init as llvm.Constant,
			name
		);
		this.variables[name] = { type: letTy, value: gv };
		return gv;
		}
	
		const slot = this.helper.alloca(letTy, name);
		this.helper.store(slot, init);
		this.variables[name] = { type: letTy, value: slot };
		return slot;
	}

	private genAssignment(expr: AssignmentDeclaration): llvm.Value {
		const name = expr.name.name;
		const entry = this.variables[name];
		if (!entry) {
			throw new Error(`Undefined variable: ${name}`);
		}
		const value = this.genExpression(expr.value) as llvm.Value;
		if (!value) {
			throw new Error(`Value for variable ${name} is undefined`);
		}
		this.helper.store(entry.value, value);
		return value;
	}

	private genBinaryExpression(expr: BinaryExpression): llvm.Value {
		let l = this.genExpression(expr.left) as llvm.Value;
		let r = this.genExpression(expr.right) as llvm.Value;
		if (!l || !r) {
			throw new Error(`Invalid binary expression`);
		}

		const lTy = l.getType();
		const rTy = r.getType();

		if (lTy.getTypeID() !== rTy.getTypeID()) {
			if (lTy.getTypeID() === llvm.Type.TypeID.IntegerTyID && rTy.isFloatingPointTy()) {
				l = this.helper.builder.CreateSIToFP(l, rTy, "sitofp");
			} else if (lTy.isFloatingPointTy() && rTy.getTypeID() === llvm.Type.TypeID.IntegerTyID) {
				r = this.helper.builder.CreateSIToFP(r, lTy, "sitofp");
			} else {
				throw new Error(
					`Type mismatch in binary expression: ${this.helper.typeName(lTy)} vs ${this.helper.typeName(rTy)}`
				);
			}
		}

		if (l.getType().getTypeID() === llvm.Type.TypeID.IntegerTyID) {
			switch (expr.operator) {
				case "+": return this.helper.add(l, r);
				case "-": return this.helper.sub(l, r);
				case "*": return this.helper.mul(l, r);
				case "/": return this.helper.div(l, r);
				default: throw new Error(`Unsupported operator: ${expr.operator}`);
			}
		} else {
			switch (expr.operator) {
				case "+": return this.helper.builder.CreateFAdd(l, r, "faddtmp");
				case "-": return this.helper.builder.CreateFSub(l, r, "fsubtmp");
				case "*": return this.helper.builder.CreateFMul(l, r, "fmultmp");
				case "/": return this.helper.builder.CreateFDiv(l, r, "fdivtmp");
				default: throw new Error(`Unsupported operator: ${expr.operator}`);
			}
		}
	}

	private genIntegerLiteral(lit: IntegerLiteral): llvm.Value {
		const ty = this.helper.type(lit.inferredType || "int");
		if (ty.getTypeID() === llvm.Type.TypeID.IntegerTyID) {
		return llvm.ConstantInt.get(ty, lit.value, true);
		} else if (ty.isFloatingPointTy()) {
		return llvm.ConstantFP.get(ty, lit.value);
		}
		throw new Error(`Unsupported literal type: ${lit.inferredType}`);
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
	};

	type(name: string): llvm.Type {
		const t = (this.types as any)[name];
		if (!t) throw new Error(`Unknown type: ${name}`);
		return t;
	}

	typeName(t: llvm.Type): string {
		switch (t.getTypeID()) {
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
			return `pointer to ${this.typeName(t.getPointerElementType())}`;
		default:
			throw new Error(`Unknown LLVM type ID: ${t.getTypeID()}`);
		}
	}

	fn(
		name: string,
		params: llvm.Type[],
		ret: llvm.Type,
		body: () => void
	): [llvm.Function, llvm.FunctionType, llvm.BasicBlock] {
		const fty = llvm.FunctionType.get(ret, params, false);
		const fn = llvm.Function.Create(
		fty,
		llvm.Function.LinkageTypes.ExternalLinkage,
		name,
		this.module
		);
		const entry = llvm.BasicBlock.Create(this.context, "entry", fn);
		this.builder.SetInsertPoint(entry);
		body();
		return [fn, fty, entry];
	}

	alloca(ty: llvm.Type, name?: string): llvm.Value {
		return this.builder.CreateAlloca(ty, null, name);
	}

	store(ptr: llvm.Value, val: llvm.Value): llvm.Value {
		return this.builder.CreateStore(val, ptr);
	}

	load(ty: llvm.Type, ptr: llvm.Value, name?: string): llvm.Value {
		return this.builder.CreateLoad(ty, ptr, name);
	}

	add(a: llvm.Value, b: llvm.Value, name?: string): llvm.Value {
		return this.builder.CreateAdd(a, b, name || "addtmp");
	}

	sub(a: llvm.Value, b: llvm.Value, name?: string): llvm.Value {
		return this.builder.CreateSub(a, b, name || "subtmp");
	}

	mul(a: llvm.Value, b: llvm.Value, name?: string): llvm.Value {
		return this.builder.CreateMul(a, b, name || "multmp");
	}

	div(a: llvm.Value, b: llvm.Value, name?: string): llvm.Value {
		return this.builder.CreateSDiv(a, b, name || "divtmp");
	}

	ret(val?: llvm.Value): llvm.Value {
		return val ? this.builder.CreateRet(val) : this.builder.CreateRetVoid();
	}

	print(): string {
		return this.module.print();
	}
}