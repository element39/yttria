import { ProgramExpression } from "../parser/ast"

export type ResolvedModule = {
    path: string
    ast: ProgramExpression
}