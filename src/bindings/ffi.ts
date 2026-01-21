import { dlopen } from "bun:ffi";
import { platform } from "os";

const location = platform() === "win32" ? "LLVM-C.dll" : "libLLVM-C.so";

const lib = dlopen(location, {
	LLVMConstStringInContext2: { args: ["ptr", "cstring", "uint64_t", "bool"], returns: "ptr" },
	LLVMArrayType2: { args: ["ptr", "uint64_t"], returns: "ptr" },
	LLVMAddGlobal: { args: ["ptr", "ptr", "cstring"], returns: "ptr" },
	LLVMSetInitializer: { args: ["ptr", "ptr"], returns: "void" },
	LLVMSetGlobalConstant: { args: ["ptr", "bool"], returns: "void" },
	LLVMBuildCall2: { args: ["ptr", "ptr", "ptr", "ptr", "uint32_t", "cstring"], returns: "ptr" },
	LLVMGetNamedFunction: { args: ["ptr", "cstring"], returns: "ptr" },
	LLVMBuildICmp: { args: ["ptr", "int32_t", "ptr", "ptr", "cstring"], returns: "ptr" },
	LLVMGetInsertBlock: { args: ["ptr"], returns: "ptr" },

	// context & module
	LLVMContextCreate: { args: [], returns: "ptr" },
	LLVMModuleCreateWithNameInContext: { args: ["cstring", "ptr"], returns: "ptr" },
	LLVMCreateBuilderInContext: { args: ["ptr"], returns: "ptr" },

	// types
	LLVMInt1TypeInContext: { args: ["ptr"], returns: "ptr" },

	LLVMInt8TypeInContext: { args: ["ptr"], returns: "ptr" },
	LLVMInt16TypeInContext: { args: ["ptr"], returns: "ptr" },
	LLVMInt32TypeInContext: { args: ["ptr"], returns: "ptr" },
	LLVMInt64TypeInContext: { args: ["ptr"], returns: "ptr" },

	LLVMFloatTypeInContext: { args: ["ptr"], returns: "ptr" },
	LLVMDoubleTypeInContext: { args: ["ptr"], returns: "ptr" },

	LLVMVoidTypeInContext: { args: ["ptr"], returns: "ptr" },
	LLVMPointerTypeInContext: { args: ["ptr", "uint32_t"], returns: "ptr" },

	// functions & blocks
	LLVMFunctionType: { args: ["ptr", "ptr", "uint32_t", "bool"], returns: "ptr" },
	LLVMAddFunction: { args: ["ptr", "cstring", "ptr"], returns: "ptr" },
	LLVMAppendBasicBlockInContext: { args: ["ptr", "ptr", "cstring"], returns: "ptr" },
	LLVMDeleteBasicBlock: { args: ["ptr"], returns: "void" },
	LLVMGetParam: { args: ["ptr", "uint32_t"], returns: "ptr" },
	LLVMSetLinkage: { args: ["ptr", "int32_t"], returns: "void" },

	// ir building
	LLVMPositionBuilderAtEnd: { args: ["ptr", "ptr"], returns: "void" },
	LLVMBuildAdd: { args: ["ptr", "ptr", "ptr", "cstring"], returns: "ptr" },
	LLVMBuildFAdd: { args: ["ptr", "ptr", "ptr", "cstring"], returns: "ptr" },
	LLVMBuildSub: { args: ["ptr", "ptr", "ptr", "cstring"], returns: "ptr" },
	LLVMBuildFSub: { args: ["ptr", "ptr", "ptr", "cstring"], returns: "ptr" },
	LLVMBuildMul: { args: ["ptr", "ptr", "ptr", "cstring"], returns: "ptr" },
	LLVMBuildFMul: { args: ["ptr", "ptr", "ptr", "cstring"], returns: "ptr" },
	LLVMBuildSDiv: { args: ["ptr", "ptr", "ptr", "cstring"], returns: "ptr" },
	LLVMBuildUDiv: { args: ["ptr", "ptr", "ptr", "cstring"], returns: "ptr" },
	LLVMBuildFDiv: { args: ["ptr", "ptr", "ptr", "cstring"], returns: "ptr" },
	LLVMBuildRet: { args: ["ptr", "ptr"], returns: "ptr" },
	LLVMBuildBr: { args: ["ptr", "ptr"], returns: "ptr" },
	LLVMBuildCondBr: { args: ["ptr", "ptr", "ptr", "ptr"], returns: "ptr" },

	// memory
	LLVMBuildAlloca: { args: ["ptr", "ptr", "cstring"], returns: "ptr" },
	LLVMBuildStore: { args: ["ptr", "ptr", "ptr"], returns: "ptr" },
	LLVMBuildLoad2: { args: ["ptr", "ptr", "ptr", "cstring"], returns: "ptr" },

	// constants
	LLVMConstInt: { args: ["ptr", "uint64_t", "bool"], returns: "ptr" },
	LLVMConstReal: { args: ["ptr", "double"], returns: "ptr" },

	// utils
	LLVMPrintModuleToString: { args: ["ptr"], returns: "cstring" },
	LLVMVerifyFunction: { args: ["ptr", "uint32_t"], returns: "int" },
	LLVMVerifyModule: { args: ["ptr", "uint32_t", "ptr"], returns: "int" },
	LLVMBuildBitCast: { args: ["ptr", "ptr", "ptr", "cstring"], returns: "ptr" },

	// introspection
	LLVMGetIntTypeWidth: { args: ["ptr"], returns: "uint32_t" },
	LLVMTypeOf: { args: ["ptr"], returns: "ptr" },
	LLVMGetTypeKind: { args: ["ptr"], returns: "uint32_t" }
});

export const {
	LLVMContextCreate,
	LLVMModuleCreateWithNameInContext,
	LLVMCreateBuilderInContext,

	LLVMInt1TypeInContext,
	LLVMInt8TypeInContext,
	LLVMInt16TypeInContext,
	LLVMInt32TypeInContext,
	LLVMInt64TypeInContext,
	LLVMFloatTypeInContext,
	LLVMDoubleTypeInContext,
	LLVMVoidTypeInContext,
	LLVMPointerTypeInContext,

	LLVMFunctionType,
	LLVMAddFunction,
	LLVMAppendBasicBlockInContext,
	LLVMGetParam,
	LLVMDeleteBasicBlock,
	LLVMBuildRet,
	LLVMSetLinkage,
	
	LLVMBuildAdd,
	LLVMBuildFAdd,
	LLVMBuildSub,
	LLVMBuildFSub,
	LLVMBuildMul,
	LLVMBuildFMul,
	LLVMBuildSDiv,
	LLVMBuildUDiv,
	LLVMBuildFDiv,
	
	LLVMBuildBr,
	LLVMBuildCondBr,

	LLVMPositionBuilderAtEnd,
	LLVMPrintModuleToString,
	LLVMVerifyFunction,
	LLVMVerifyModule,
	LLVMTypeOf,
	LLVMConstInt,
	LLVMConstReal,
	LLVMGetIntTypeWidth,
	LLVMBuildAlloca,
	LLVMBuildStore,
	LLVMBuildLoad2,
	LLVMGetNamedFunction,
	LLVMBuildCall2,
	LLVMBuildICmp,
	LLVMGetInsertBlock,
	LLVMConstStringInContext2,
	LLVMArrayType2,
	LLVMAddGlobal,
	LLVMSetInitializer,
	LLVMSetGlobalConstant,
	LLVMBuildBitCast,
	LLVMGetTypeKind
} = lib.symbols;