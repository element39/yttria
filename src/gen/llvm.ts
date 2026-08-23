import { BasicBlock, Func, FunctionType, Linkage, MemoryValue, Type, Value } from "../bindings";
import { BinaryExpression, BooleanLiteral, ElseExpression, Expression, ExpressionType, FunctionCall, FunctionDeclaration, Identifier, IfExpression, MemberAccess, PostUnaryExpression, PreUnaryExpression, ReturnExpression, VariableAssignment, VariableDeclaration } from "../parser/ast";
import { FunctionSymbol, ModuleSymbol } from "../semantic/symbols";
import { LLVMHelper } from "./helper";

export class Codegen {
    private name: string;
    private module: ModuleSymbol;

    private h: LLVMHelper;
    private scope: CodegenScope = new CodegenScope();

    private table: { [key in ExpressionType]?: (e: Expression) => Value | Func | void } = {
        FunctionCall: this.genFunctionCall.bind(this),
        ReturnExpression: this.genReturnExpression.bind(this),

        Identifier: this.genIdentifier.bind(this),

        BinaryExpression: this.genBinaryExpression.bind(this),

        NumberLiteral: this.genNumberLiteral.bind(this),
        BooleanLiteral: this.genBooleanLiteral.bind(this),

        PreUnaryExpression: this.genPreUnaryExpression.bind(this),
        PostUnaryExpression: this.genPostUnaryExpression.bind(this),

        VariableDeclaration: this.genVariableDeclaration.bind(this),
        VariableAssignment: this.genVariableAssignment.bind(this),

        IfExpression: this.genIfExpression.bind(this),
    }

    types: { [key: string]: Type }

    constructor(name: string, module: ModuleSymbol) {
        this.name = name;
        this.module = module;
        this.h = new LLVMHelper(name);

        this.types = {
            "int": Type.int32(this.h.ctx),
            "i8": Type.int8(this.h.ctx),
            "i16": Type.int16(this.h.ctx),
            "i32": Type.int32(this.h.ctx),
            "i64": Type.int64(this.h.ctx),

            "float": Type.float(this.h.ctx),

            "string": Type.pointer(Type.int8(this.h.ctx)),
            "char": Type.int8(this.h.ctx),

            "void": Type.void(this.h.ctx),
            "bool": Type.int1(this.h.ctx),
        }
    }

    gen() {
        for (const program of this.module.programs) {
            for (const fn of program.functions) {
                this.declareFunction(fn.expression);
            }
        }

        for (const program of this.module.programs) {
            for (const fn of program.functions) {
                this.genFunctionBody(fn.expression);
            }
        }

        return this.h.toString();
    }

    genFunctionCall(e: Expression) {
        const c = e as FunctionCall;

        let fn: Func | undefined;

        if (c.callee.type === "Identifier") {
            const name = (c.callee as Identifier).value;
            fn = this.scope.getFunction(name);
        } else if (c.callee.type === "MemberAccess") {
            const m = c.callee as MemberAccess;

            if (m.object.type !== "Identifier") {
                throw new Error(`unsupported member access target ${m.object.type}`);
            }

            const moduleName = (m.object as Identifier).value;
            const moduleSymbol = this.module.scope.find(moduleName) as ModuleSymbol;

            if (!moduleSymbol || moduleSymbol.kind !== "module") {
                throw new Error(`module "${moduleName}" not found`);
            }

            const exported = moduleSymbol.exports.get(m.property.value);

            if (!exported || exported.kind !== "function") {
                throw new Error(`function "${m.property.value}" not found in module "${moduleSymbol.name}"`);
            }

            const symbol = exported as FunctionSymbol;

            if (!symbol.returnType.type) {
                throw new Error(`return type of "${symbol.name}" is unresolved`);
            }

            const fnType = new FunctionType(
                symbol.params.map(p => this.types[p.typeHolder.type!.kind]),
                this.types[symbol.returnType.type.kind],
                false
            );

            fn = this.h.declareFn(
                this.mangle(moduleSymbol.name, symbol.name),
                fnType,
                {
                    linkage: Linkage.External,
                    extern: true
                }
            );
        }

        if (!fn) {
            throw new Error(`function not found for ${c.callee.type}`);
        }

        const args = c.args.map(arg => {
            const v = this.table[arg.type]?.(arg);

            if (!v || !(v instanceof Value)) {
                throw new Error(`failed to generate argument for ${arg.type}`);
            }

            return v;
        });

        return this.h.builder.call(fn, args);
    }

    declareFunction(f: FunctionDeclaration) {
        let symbol: FunctionSymbol | undefined

        for (const program of this.module.programs) {
            symbol = program.functions.find(fn => fn.name === f.name.value)

            if (symbol) break;
        }

        if (!symbol) {
            throw new Error(`symbol not found for ${f.name.value}`);
        }

        if (!symbol.returnType.type) {
            throw new Error(`return type not found for ${f.name.value}`);
        }

        const ret = this.types[symbol.returnType.type.kind];

        const fnt = new FunctionType(
            f.params.map(p => this.types[p.paramType.value]),
            ret,
            false
        );

        const fn = this.h.declareFn(
            f.modifiers.includes("extern")
                ? f.name.value
                : this.mangle(this.name, f.name.value),
            fnt,
            {
                linkage: f.modifiers.includes("extern") || f.modifiers.includes("pub")
                    ? Linkage.External
                    : Linkage.Internal,
                extern: f.modifiers.includes("extern")
            }
        );

        this.scope.set(f.name.value, fn);

        return fn;
    }

    genFunctionBody(f: FunctionDeclaration) {
        const fn = this.scope.getFunction(f.name.value);

        if (!fn) {
            throw new Error(`function not found for ${f.name.value}`);
        }

        if (f.modifiers.includes("extern")) {
            return;
        }

        const entry = fn.addBlock("entry");

        this.h.builder.insertInto(entry);
        this.h.setCurrentFunction(fn);

        this.scope = this.scope.push();

        const args = fn.getArgs();

        for (const [i, arg] of args.entries()) {
            arg.setName(`${f.params[i].name.value}.arg`);

            const ptr = this.h.builder.alloca(
                arg.getType(),
                f.params[i].name.value
            );

            this.h.builder.store(arg, ptr);

            this.scope.set(
                f.params[i].name.value,
                ptr
            );
        }

        for (const body of f.body) {
            this.table[body.type]?.(body);
        }

        this.scope = this.scope.pop();
    }

    genReturnExpression(e: Expression) {
        const r = e as ReturnExpression;

        const v = this.table[r.value.type]?.(r.value);
        if (!v || !(v instanceof Value)) throw new Error(`failed to generate return value for ${r.value.type}`);

        this.h.builder.ret(v);
        return v;
    }

    genBinaryExpression(e: Expression) {
        const b = e as BinaryExpression;

        const left = this.table[b.left.type]?.(b.left);
        const right = this.table[b.right.type]?.(b.right);

        if (!left || !right || !(left instanceof Value) || !(right instanceof Value)) throw new Error(`failed to generate binary expression for ${b.left.type} ${b.operator} ${b.right.type}`);

        switch (b.operator) {
            case "+":
                return this.h.builder.add(left, right);
            case "-":
                return this.h.builder.sub(left, right);
            case "*":
                return this.h.builder.mul(left, right);
            case "/":
                return this.h.builder.sdiv(left, right);
            case "<":
                return this.h.builder.icmpSLT(left, right);
            case "<=":
                return this.h.builder.icmpSLE(left, right);
            case ">":
                return this.h.builder.icmpSGT(left, right);
            case ">=":
                return this.h.builder.icmpSGE(left, right);
            case "==":
                return this.h.builder.icmpEQ(left, right);
            case "!=":
                return this.h.builder.icmpNE(left, right);
            default:
                throw new Error(`unsupported binary operator ${b.operator}`);
        }
    }

    genBooleanLiteral(e: Expression) {
        const b = e as BooleanLiteral;
        return Value.constInt(this.types["bool"], b.value ? 1 : 0);
    }

    genPreUnaryExpression(e: Expression) {
        const u = e as PreUnaryExpression;

        if (u.operator === "-" || u.operator === "!") {
            const operand = this.table[u.operand.type]?.(u.operand);

            if (!operand || !(operand instanceof Value)) {
                throw new Error(`failed to generate operand for ${u.operand.type}`);
            }

            switch (u.operator) {
                case "-":
                    return this.h.builder.neg(operand);

                case "!":
                    return this.h.builder.not(operand);
            }
        }

        if (u.operand.type !== "Identifier") {
            throw new Error(`pre-unary operator requires an identifier`);
        }

        const name = (u.operand as Identifier).value;
        const ptr = this.scope.getMemoryValue(name);

        if (!ptr) {
            throw new Error(`cannot assign to constant ${name}`);
        }

        const old = this.h.builder.load(ptr.getValueType(), ptr);
        const one = Value.constInt(old.getType(), 1);

        switch (u.operator) {
            case "++": {
                const value = this.h.builder.add(old, one);
                this.h.builder.store(value, ptr);
                return value;
            }

            case "--": {
                const value = this.h.builder.sub(old, one);
                this.h.builder.store(value, ptr);
                return value;
            }

            default:
                throw new Error(`unsupported pre-unary operator "${u.operator}"`);
        }
    }

    genPostUnaryExpression(e: Expression) {
        const u = e as PostUnaryExpression;

        if (u.operand.type !== "Identifier") {
            throw new Error(`post-unary operator requires an identifier`);
        }

        const name = (u.operand as Identifier).value;
        const ptr = this.scope.getMemoryValue(name);

        if (!ptr) {
            throw new Error(`cannot assign to constant ${name}`);
        }

        const old = this.h.builder.load(ptr.getValueType(), ptr);
        const one = Value.constInt(old.getType(), 1);

        switch (u.operator) {
            case "++": {
                const next = this.h.builder.add(old, one);
                this.h.builder.store(next, ptr);
                return old;
            }

            case "--": {
                const next = this.h.builder.sub(old, one);
                this.h.builder.store(next, ptr);
                return old;
            }

            default:
                throw new Error(`unsupported post-unary operator "${u.operator}"`);
        }
    }


    genIdentifier(e: Expression) {
        const i = e as Identifier;

        const value = this.scope.getValue(i.value);
        if (!value) throw new Error(`value not found for ${i.value}`);
        if (value instanceof MemoryValue) return this.h.builder.load(value.getValueType(), value);

        return value;
    }

    genVariableDeclaration(e: Expression) {
        const v = e as VariableDeclaration;
        const value = this.table[v.value.type]?.(v.value);

        if (!value || !(value instanceof Value)) {
            throw new Error(
                `failed to generate value for ${v.value.type}`
            );
        }

        if (v.mutable) {
            const ptr = this.h.builder.alloca(value.getType(), v.name.value);

            this.h.builder.store(value, ptr);
            this.scope.set(v.name.value, ptr);

            return ptr;
        }

        this.scope.set(v.name.value, value);
        return value;
    }

    genVariableAssignment(e: Expression) {
        const v = e as VariableAssignment;
        const value = this.table[v.value.type]?.(v.value);

        if (!value || !(value instanceof Value)) {
            throw new Error(
                `failed to generate value for ${v.value.type}`
            );
        }

        const ptr = this.scope.getMemoryValue(v.name.value);
        if (!ptr) throw new Error(`cannot assign to constant ${v.name.value}`);

        this.h.builder.store(value, ptr);
        return value;
    }

    genNumberLiteral(e: Expression) {
        const n = e as Expression & { value: number };
        return Value.constInt(this.types["int"], n.value);
    }

    genIfExpression(e: Expression) {
        const iff = e as IfExpression;

        const cond = this.table[iff.condition.type]?.(iff.condition);
        if (!cond || !(cond instanceof Value)) throw new Error(`failed to generate condition for ${iff.condition.type}`);

        const afterBlock = this.h.block("after", () => {});
        const ifBlock = this.h.block("if", (block) => {
            for (const body of iff.body) {
                this.table[body.type]?.(body);
            }

            if (block.terminated) return;
            this.h.builder.br(afterBlock);
        });

        const currentBlock = this.h.builder.getInsertBlock();
        if (!currentBlock) throw new Error("failed to get current block");

        let alternateBlock: BasicBlock | undefined;
        if (iff.alternate) {
            if (iff.alternate.type === "IfExpression") {
                alternateBlock = this.h.block("else-if", () => {
                    this.genIfExpression(iff.alternate as IfExpression);
                });
            } else if (iff.alternate.type === "ElseExpression") {
                alternateBlock = this.h.block("else", (block) => {
                    for (const body of (iff.alternate as ElseExpression).body) {
                        this.table[body.type]?.(body);
                    }

                    if (block.terminated) return;
                    this.h.builder.br(afterBlock);
                });
            }
        }

        this.h.builder.insertInto(currentBlock);
        this.h.builder.condBr(cond, ifBlock, alternateBlock ?? afterBlock);

        this.h.builder.insertInto(afterBlock);
    }

    mangle(module: string, name: string) {
        if (module === "main" && name === "main") return "main";
        return `yt_${module.replaceAll("/", "_")}_${name}`;
    }
}

export class CodegenScope {
    parent?: CodegenScope
    children: CodegenScope[] = []
    values: Map<string, Value | MemoryValue | Func> = new Map()

    constructor(parent?: CodegenScope) {
        this.parent = parent
    }

    pop(): CodegenScope {
        const parent = this.parent
        if (!parent) throw new Error("cannot pop higher than global scope")
        return parent
    }

    push(): CodegenScope {
        const child = new CodegenScope(this)
        this.children.push(child)
        return child
    }

    getAll(): Map<string, Value | Func> {
        return new Map([
            ...(this.parent?.getAll() ?? []),
            ...this.values,
        ]);
    }

    get(name: string): Value | Func | undefined {
        return this.values.get(name) ?? this.parent?.get(name)
    }

    getValue(name: string): Value | MemoryValue | undefined {
        const v = this.get(name)
        if (v instanceof Value) return v
    }

    getMemoryValue(name: string): MemoryValue | undefined {
        const v = this.get(name)
        if (v instanceof MemoryValue) return v
    }

    getLiteralValue(name: string): Value | undefined {
        const v = this.getValue(name)
        if (!(v instanceof MemoryValue)) return v
    }

    getFunction(name: string): Func | undefined {
        const v = this.get(name)
        if (v instanceof Func) return v
    }

    set(name: string, v: Value | Func): void {
        if (this.values.has(name)) throw new Error(`value "${name}" already exists in this scope`)
        this.values.set(name, v)
    }
}