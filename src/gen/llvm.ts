import llvm from "llvm-bindings"
import { BooleanLiteral, Expression, FunctionDeclaration, NumberLiteral, ProgramExpression, StringLiteral, VariableDeclaration } from "../parser/ast"
import { LLVMHelper } from "./helper"

export class LLVMGen {
    private helper: LLVMHelper
    private ast: ProgramExpression
    private moduleName: string

    constructor(ast: ProgramExpression, moduleName: string) {
        this.ast = ast
        this.moduleName = moduleName
        this.helper = new LLVMHelper()
        this.helper.module.setModuleIdentifier(moduleName)
    }

    generate(): string {
        for (const expr of this.ast.body) {
            switch (expr.type) {
                case "FunctionDeclaration":
                    this.generateFunction(expr as FunctionDeclaration)
                    break
                case "VariableDeclaration":
                    this.generateGlobalVariable(expr as VariableDeclaration)
                    break
            }
        }

        return this.helper.print()
    }

    private generateFunction(fn: FunctionDeclaration) {
        const returnType = llvm.Type.getVoidTy(this.helper.context)
        const paramTypes: llvm.Type[] = []
        
        const linkage = fn.modifiers?.includes("pub") ? "external" : "internal"
        const func = this.helper.fn(fn.name.value, returnType, paramTypes, linkage)

        this.helper.block("entry", () => {
            for (const stmt of fn.body) {
                this.generateStatement(stmt)
            }

            this.helper.builder.CreateRetVoid()
        })

        this.helper.verify(func)
    }

    private generateStatement(stmt: Expression) {
        switch (stmt.type) {
            case "VariableDeclaration":
                this.generateLocalVariable(stmt as VariableDeclaration)
                break
        }
    }

    private generateLocalVariable(varDecl: VariableDeclaration) {
        const llvmType = this.getLLVMType(varDecl.resolvedType?.name || "int")
        const value = this.generateExpression(varDecl.value)
        
        this.helper.variable(varDecl.name.value, llvmType, value)
    }

    private generateGlobalVariable(varDecl: VariableDeclaration) {
        const llvmType = this.getLLVMType(varDecl.resolvedType?.name || "int")
        const initializer = this.generateConstant(varDecl.value)
        
        const linkage = varDecl.mutable ? 
            llvm.GlobalVariable.LinkageTypes.InternalLinkage :
            llvm.GlobalVariable.LinkageTypes.InternalLinkage
            
        new llvm.GlobalVariable(
            this.helper.module,
            llvmType,
            !varDecl.mutable,
            linkage,
            initializer,
            varDecl.name.value
        )
    }

    private generateExpression(expr: Expression): llvm.Value {
        switch (expr.type) {
            case "NumberLiteral":
                const numLit = expr as NumberLiteral
                if (Number.isInteger(numLit.value)) {
                    // integer literal as i32
                    return llvm.ConstantInt.get(
                        llvm.Type.getInt32Ty(this.helper.context),
                        numLit.value,
                        true
                    )
                } else {
                    return llvm.ConstantFP.get(
                        llvm.Type.getFloatTy(this.helper.context),
                        numLit.value
                    )
                }
            case "StringLiteral":
                const strLit = expr as StringLiteral
                return this.helper.builder.CreateGlobalStringPtr(strLit.value)
            case "BooleanLiteral":
                const boolLit = expr as BooleanLiteral
                return llvm.ConstantInt.get(
                    llvm.Type.getInt1Ty(this.helper.context),
                    boolLit.value ? 1 : 0,
                    false
                )
            case "FunctionCall":
                const fc = expr as any
                const args: llvm.Value[] = fc.args.map((a: Expression) => this.generateExpression(a))
                let fname: string
                if (fc.callee.type === "Identifier") {
                    fname = (fc.callee as any).value
                } else if (fc.callee.type === "MemberAccess") {
                    const ma = fc.callee as any
                    const obj = (ma.object as any).value
                    const prop = (ma.property as any).value
                    fname = `${obj}_${prop}`
                } else {
                    throw new Error(`Unsupported callee type: ${fc.callee.type}`)
                }
                const ftype = llvm.FunctionType.get(
                    llvm.Type.getVoidTy(this.helper.context),
                    args.map(a => a.getType()),
                    false
                )
                const func = this.helper.module.getOrInsertFunction(fname, ftype)
                return this.helper.builder.CreateCall(func, args)
            default:
                throw new Error(`Unsupported expression type: ${expr.type}`)
        }
    }

    private generateConstant(expr: Expression): llvm.Constant {
        switch (expr.type) {
            case "NumberLiteral":
                const numLit = expr as NumberLiteral
                if (Number.isInteger(numLit.value)) {
                    return llvm.ConstantInt.get(
                        llvm.Type.getInt32Ty(this.helper.context),
                        numLit.value,
                        true
                    )
                } else {
                    return llvm.ConstantFP.get(
                        llvm.Type.getFloatTy(this.helper.context),
                        numLit.value
                    )
                }
            case "StringLiteral":
                const strLit = expr as StringLiteral
                return llvm.ConstantDataArray.getString(this.helper.context, strLit.value, true)
            case "BooleanLiteral":
                const boolLit = expr as BooleanLiteral
                return llvm.ConstantInt.get(
                    llvm.Type.getInt1Ty(this.helper.context),
                    boolLit.value ? 1 : 0,
                    false
                )
            default:
                throw new Error(`Unsupported constant expression type: ${expr.type}`)
        }
    }

    private getLLVMType(typeName: string): llvm.Type {
        switch (typeName) {
            case "int":
            case "i32":
                return llvm.Type.getInt32Ty(this.helper.context)
            case "i8":
                return llvm.Type.getInt8Ty(this.helper.context)
            case "i16":
                return llvm.Type.getInt16Ty(this.helper.context)
            case "i64":
                return llvm.Type.getInt64Ty(this.helper.context)
            case "float":
                return llvm.Type.getFloatTy(this.helper.context)
            case "bool":
                return llvm.Type.getInt1Ty(this.helper.context)
            case "string":
                return llvm.Type.getInt8PtrTy(this.helper.context)
            case "void":
                return llvm.Type.getVoidTy(this.helper.context)
            default:
                throw new Error(`Unsupported type: ${typeName}`)
        }
    }

    writeToFile(filename: string) {
        llvm.WriteBitcodeToFile(this.helper.module, filename)
    }
}