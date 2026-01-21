import { describe, expect, it } from 'bun:test';
import LLVM, { Context, IRBuilder, Module, Type, Value } from '../../src/bindings/index';

describe('llvm-bun', () => {
	it('bitcasts between pointer types', () => {
		const ctx = new Context();
		const mod = new Module('test', ctx);
		const fnType = new LLVM.FunctionType([], Type.void(ctx));
		const fn = mod.createFunction('main', fnType);
		const entry = fn.addBlock('entry');
		const builder = new IRBuilder(ctx);
		builder.insertInto(entry);
		const i8 = Type.int8(ctx);
		const ptrType = Type.pointer(ctx);
		const ptr = builder.alloca(i8, 'ptr');
		// Bitcast to another pointer type (e.g., i32*)
		const i32 = Type.int32(ctx);
		const ptrI32 = Type.pointer(ctx);
		const casted = builder.bitcast(ptr, ptrI32, 'casted');
		expect(casted.handle).toBeTruthy();
		expect(casted.getType().isPointer()).toBe(true);
		builder.ret();
		const ir = mod.toString();
		expect(ir).toMatch(/bitcast/);
	});

	it('createFunction sets linkage option', () => {
		const ctx = new Context();
		const mod = new Module('test', ctx);
		const fnType = new LLVM.FunctionType([], Type.void(ctx));
		// Internal linkage
		const fn = mod.createFunction('internal_func', fnType, { linkage: LLVM.Linkage.Internal });
		expect(fn.handle).toBeTruthy();
		const ir = mod.toString();
		expect(ir).toMatch(/internal/);
	});
	it('adds a global string constant', () => {
		const ctx = new Context();
		const mod = new Module('test', ctx);
		const strVal = mod.addGlobalString('hello world');
		const t = strVal.getType();
		expect(t.isPointer()).toBe(true);
		const ir = mod.toString();
		expect(ir).toMatch(/hello world/);
		expect(ir).toMatch(/constant/);
	});
	it('creates a context and module', () => {
		const ctx = new Context()
		const mod = new Module('test', ctx)
		expect(ctx.handle).toBeTruthy()
		expect(mod.handle).toBeTruthy()
		expect(mod.getContext()).toBe(ctx)
	})

	it('creates integer and float types', () => {
		const ctx = new Context()
		const i32 = Type.int32(ctx)
		const f64 = Type.double(ctx)
		expect(i32.isInt()).toBe(true)
		expect(i32.isInt(32)).toBe(true)
		expect(i32.getBitWidth()).toBe(32)
		expect(f64.isDouble()).toBe(true)
		expect(f64.isFloat()).toBe(false)
	})

	it('creates pointer types', () => {
		const ctx = new Context()
		const i8 = Type.int8(ctx)
		const ptr = Type.pointer(ctx)
		expect(ptr.isPointer()).toBe(true)
	})

	it('creates function and basic block', () => {
		const ctx = new Context()
		const mod = new Module('test', ctx)
		const fnType = new LLVM.FunctionType([Type.int32(ctx), Type.int32(ctx)], Type.int32(ctx))
		const fn = mod.createFunction('add', fnType)
		const block = fn.addBlock('entry')
		expect(fn.handle).toBeTruthy()
		expect(block.handle).toBeTruthy()
	})

	it('builds simple ir with irbuilder', () => {
		const ctx = new Context()
		const mod = new Module('test', ctx)
		const fnType = new LLVM.FunctionType([Type.int32(ctx), Type.int32(ctx)], Type.int32(ctx))
		const fn = mod.createFunction('add', fnType)
		const entry = fn.addBlock('entry')
		const builder = new IRBuilder(ctx)
		builder.insertInto(entry)
		const args = fn.getArgs()
		const sum = builder.add(args[0], args[1])
		builder.ret(sum)
		const ir = mod.toString()
		expect(ir).toMatch(/define i32 @add/)
		expect(ir).toMatch(/add i32/)
	})
	it('creates and inspects constants', () => {
		const ctx = new Context()
		const i32 = Type.int32(ctx)
		const v = Value.constInt(i32, 42)
		expect(v.handle).toBeTruthy()
		const t = v.getType()
		expect(t.isInt(32)).toBe(true)
	})
	it('alloca, store, load', () => {
		const ctx = new Context()
		const mod = new Module('test', ctx)
		const fnType = new LLVM.FunctionType([], Type.void(ctx))
		const fn = mod.createFunction('main', fnType)
		const entry = fn.addBlock('entry')
		const builder = new IRBuilder(ctx)
		builder.insertInto(entry)
		const i32 = Type.int32(ctx)
		const ptr = builder.alloca(i32, 'x')
		const val = Value.constInt(i32, 123)
		builder.store(val, ptr)
		const loaded = builder.load(i32, ptr)
		expect(loaded.handle).toBeTruthy()
	})
	it('builds integer and float arithmetic', () => {
		const ctx = new Context()
		const mod = new Module('arith', ctx)
		const fnType = new LLVM.FunctionType([Type.int32(ctx), Type.int32(ctx), Type.double(ctx), Type.double(ctx)], Type.void(ctx))
		const fn = mod.createFunction('arith', fnType)
		const entry = fn.addBlock('entry')
		const builder = new IRBuilder(ctx)
		builder.insertInto(entry)
		const [a, b, x, y] = fn.getArgs()

		const add = builder.add(a, b)
		const sub = builder.sub(a, b)
		const mul = builder.mul(a, b)
		const sdiv = builder.sdiv(a, b)
		const udiv = builder.udiv(a, b)

		const fadd = builder.fadd(x, y)
		const fsub = builder.fsub(x, y)
		const fmul = builder.fmul(x, y)
		const fdiv = builder.fdiv(x, y)

		expect(add.handle).toBeTruthy()
		expect(sub.handle).toBeTruthy()
		expect(mul.handle).toBeTruthy()
		expect(sdiv.handle).toBeTruthy()
		expect(udiv.handle).toBeTruthy()
		expect(fadd.handle).toBeTruthy()
		expect(fsub.handle).toBeTruthy()
		expect(fmul.handle).toBeTruthy()
		expect(fdiv.handle).toBeTruthy()

		builder.ret()
		const ir = mod.toString()
		expect(ir).toMatch(/add i32/)
		expect(ir).toMatch(/sub i32/)
		expect(ir).toMatch(/mul i32/)
		expect(ir).toMatch(/sdiv i32/)
		expect(ir).toMatch(/udiv i32/)
		expect(ir).toMatch(/fadd double/)
		expect(ir).toMatch(/fsub double/)
		expect(ir).toMatch(/fmul double/)
		expect(ir).toMatch(/fdiv double/)
	})
	it('gets a function by name', () => {
		const ctx = new Context();
		const mod = new Module('test', ctx);
		const fnType = new LLVM.FunctionType([Type.int32(ctx)], Type.int32(ctx));
		const fn = mod.createFunction('myfunc', fnType);
		const found = mod.getFunction('myfunc');
		expect(found).toBeTruthy();
		expect(found?.handle).toBe(fn.handle);
		const notFound = mod.getFunction('does_not_exist');
		expect(notFound).toBeUndefined();
	});
	it('calls a function with builder.call', () => {
		const ctx = new Context();
		const mod = new Module('test', ctx);

		const fnType = new LLVM.FunctionType([Type.int32(ctx), Type.int32(ctx)], Type.int32(ctx));
		const foo = mod.createFunction('foo', fnType);
		const fooEntry = foo.addBlock('entry');
		const builder = new IRBuilder(ctx);
		builder.insertInto(fooEntry);
		const [x, y] = foo.getArgs();
		const sum = builder.add(x, y);
		builder.ret(sum);

		const barType = new LLVM.FunctionType([Type.int32(ctx), Type.int32(ctx)], Type.int32(ctx));
		const bar = mod.createFunction('bar', barType);
		const barEntry = bar.addBlock('entry');
		builder.insertInto(barEntry);
		const [a, b] = bar.getArgs();

		const callResult = builder.call(foo, [a, b], 'calltmp');
		builder.ret(callResult);

		const ir = mod.toString();
		expect(ir).toMatch(/call i32 @foo/);
		expect(ir).toMatch(/define i32 @bar/);
		expect(ir).toMatch(/define i32 @foo/);
	});
	it('getFunction returns the same Func instance and preserves type', () => {
		const ctx = new Context();
		const mod = new Module('test', ctx);
		const fnType = new LLVM.FunctionType([Type.int32(ctx), Type.int32(ctx)], Type.int32(ctx));
		const fn = mod.createFunction('sum', fnType);
		const found = mod.getFunction('sum');
		expect(found).toBe(fn);
		expect(found?.type).toBe(fnType);
	});
	it('builds integer comparisons with icmp', () => {
		const ctx = new Context();
		const mod = new Module('test', ctx);
		const fnType = new LLVM.FunctionType([Type.int32(ctx), Type.int32(ctx)], Type.int1(ctx));
		const fn = mod.createFunction('cmp', fnType);
		const entry = fn.addBlock('entry');
		const builder = new IRBuilder(ctx);
		builder.insertInto(entry);
		const [a, b] = fn.getArgs();
		const eq = builder.icmpEQ(a, b);
		const ne = builder.icmpNE(a, b);
		const slt = builder.icmpSLT(a, b);
		const sle = builder.icmpSLE(a, b);
		const sgt = builder.icmpSGT(a, b);
		const sge = builder.icmpSGE(a, b);
		// Check handles
		expect(eq.handle).toBeTruthy();
		expect(ne.handle).toBeTruthy();
		expect(slt.handle).toBeTruthy();
		expect(sle.handle).toBeTruthy();
		expect(sgt.handle).toBeTruthy();
		expect(sge.handle).toBeTruthy();
		// Return one result to make valid IR
		builder.ret(eq);
		const ir = mod.toString();
		expect(ir).toMatch(/icmp eq/);
		expect(ir).toMatch(/icmp ne/);
		expect(ir).toMatch(/icmp slt/);
		expect(ir).toMatch(/icmp sle/);
		expect(ir).toMatch(/icmp sgt/);
		expect(ir).toMatch(/icmp sge/);
	});
	it('getInsertBlock returns the correct block and parent func', () => {
		const ctx = new Context();
		const mod = new Module('test', ctx);
		const fnType = new LLVM.FunctionType([Type.int32(ctx)], Type.int32(ctx));
		const fn = mod.createFunction('main', fnType);
		const entry = fn.addBlock('entry');
		const builder = new IRBuilder(ctx);
		builder.insertInto(entry);

		const block = builder.getInsertBlock();
		expect(block).toBeTruthy();
		expect(block?.handle).toBe(entry.handle);
		expect(block?.parent).toBe(fn);
	});
	it('BasicBlock.erase removes the block and sets handle to null', () => {
		const ctx = new Context();
		const mod = new Module('test', ctx);
		const fnType = new LLVM.FunctionType([], Type.void(ctx));
		const fn = mod.createFunction('main', fnType);
		const block = fn.addBlock('entry');
		expect(block.handle).toBeTruthy();
		block.erase();
		expect(block.handle).toBeNull();
	});
})
