import { readdirSync, readFileSync } from "fs";
import path from "path";
import { Lexer } from "../lexer";
import { Parser } from "../parser";
import { ImportExpression, ProgramExpression } from "../parser/ast";
import { ResolvedModule } from "./types";

export class ModuleResolver {
    private ast: ProgramExpression
    public modules: { [key: string]: ResolvedModule } = {}

    constructor(ast: ProgramExpression) {
        this.ast = ast
    }

    resolve() {
        for (const expr of this.ast.body) {
            if (expr.type !== "ImportExpression") continue
            const ixpr = expr as ImportExpression

            const dir = readdirSync(
                path.resolve(
                    path.join("./src/module", ixpr.path)
                )
            )
            .filter(loc => loc.endsWith(".yt"))
            .map(
                loc => path.resolve(
                    path.join("./src/module", ixpr.path, loc)
                )
            )

            const m: ResolvedModule = {
                ast: {
                    type: "Program",
                    body: []
                }
            }

            for (const loc of dir) {
                let file: string
                try {
                    file = readFileSync(loc, "utf8")
                } catch (e) {
                    throw new Error(`failed to read ${loc}: ${e}`)
                }
                const tok = new Lexer(file).lex()
                const ast = new Parser(tok).parse()
                m.ast.body = [...m.ast.body, ...ast.body]
            }

            this.modules[ixpr.path] = m
        }
        return this.modules
    }
}