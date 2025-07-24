// export type CheckerSymbol =
//   | { kind: "variable"; type: string }
//   | { kind: "function"; type: "function"; returnType: CheckerSymbol; paramTypes: CheckerSymbol[] }
//   | { kind: "type"; type: string };
export type CheckerSymbol =
    | CheckerVariable
    | CheckerFunction
    | CheckerType
    | CheckerModule

export type CheckerVariable = {
    kind: "variable";
    type: string
}

export type CheckerFunction = {
    kind: "function";
    type: "function";
    returnType: CheckerSymbol;
    paramTypes: CheckerSymbol[];
}

export type CheckerType = {
    kind: "type";
    type: string
}

export type CheckerModule = {
    kind: "module";
    type: "module";
    exports: Map<string, CheckerSymbol>;
}