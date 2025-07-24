import { Expression, ImportExpression, ProgramExpression } from "../parser/ast";

export type ResolvedModule = {
    files: string[];
    merged: ProgramExpression;
    imports: ImportExpression[];
    exports: Expression[];
}