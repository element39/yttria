import { readdirSync, readFileSync } from "fs";
import path from "path";
import { Lexer } from "../lexer";
import { Parser } from "../parser";
import { ImportExpression, ProgramExpression } from "../parser/ast";
import { ResolvedModule } from "./types";

export class ModuleResolver {
    private ast: ProgramExpression
    public modules: ResolvedModule[] = []

    constructor(ast: ProgramExpression) {
        this.ast = ast
    }

    resolve(visited = new Set<string>()) {
        const imports: ImportExpression[] = []
        for (const expr of this.ast.body) {
            if (expr.type !== "ImportExpression") continue
            imports.push(expr as ImportExpression)
            const dir = readdirSync(
                path.resolve(
                    path.join(
                        "./src/module",
                        (expr as ImportExpression).path
                    )
                )
            )
            .filter(loc => loc.endsWith(".yt"))
            .map(
                loc => path.resolve(
                    path.join(
                        "./src/module",
                        (expr as ImportExpression).path,
                        loc
                    )
                )
            )

            const m: ResolvedModule = {
                path: (expr as ImportExpression).path,
                ast: {
                    type: "Program",
                    body: []
                }
            }

            for (const loc of dir) {
                if (visited.has(loc)) continue
                visited.add(loc)
                let file: string

                try {
                    file = readFileSync(loc, "utf8")
                } catch (e) {
                    throw new Error(`Failed to read ${loc}: ${e}`)
                }
                const tok = new Lexer(file).lex()
                const ast = new Parser(tok).parse()
                m.ast.body = [...m.ast.body, ...ast.body]

                const resolver = new ModuleResolver(ast)
                const nestedImports = resolver.resolve(visited)
                for (const ni of nestedImports) {
                    if (!imports.includes(ni)) imports.push(ni)
                }
            }

            this.modules = [...this.modules, m]
        }
        
        return imports
    }
}