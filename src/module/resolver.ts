import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { Lexer } from "../lexer";
import { Parser } from "../parser";
import { Expression, FunctionDeclaration, ImportExpression, ProgramExpression, VariableDeclaration } from "../parser/ast";
import { ResolvedModule } from "./types";

export class ModuleResolver {
    private program: ProgramExpression;
    private modules: Map<string, ResolvedModule> = new Map();
    private resolving: Set<string> = new Set(); // Track modules currently being resolved
    private moduleSearchPaths: string[] = ["./src/module", "./node_modules", "./lib"];
    private cache: Map<string, { content: string; mtime: number }> = new Map();

    constructor(program: ProgramExpression, searchPaths?: string[]) {
        this.program = program;
        if (searchPaths) {
            this.moduleSearchPaths = [...searchPaths, ...this.moduleSearchPaths];
        }
    }

    resolve() {
        let imports: ImportExpression[] = [{ type: "ImportExpression", path: "builtin", alias: "."}];
        const seen = new Set<string>();
        imports = [...imports, ...this.collectImportStatements(this.program.body, seen)];
        return Object.fromEntries(this.modules)
    }

    collectImportStatements(exprs: Expression[], seen: Set<string>): ImportExpression[] {
        let imports = exprs.filter(expr => expr.type === "ImportExpression") as ImportExpression[];

        for (const expr of imports) {
            if (seen.has(expr.path)) continue;
            seen.add(expr.path);

            const dir = path.resolve(path.join("./src/module", expr.path));
            if (!existsSync(dir)) {
                throw new Error(`Module directory not found: ${dir}`);
            }
            const files = readdirSync(dir).filter(file => file.endsWith(".yt"));

            const program: ProgramExpression = { type: "Program", body: [] };
            let i: ImportExpression[] = [];
            for (const file of files) {
                const content = readFileSync(path.join(dir, file), "utf-8");
                const ast = new Parser(new Lexer(content).lex()).parse();
                const sub = this.collectImportStatements(ast.body, seen);

                i = [...i, ...sub];
                program.body = [...program.body, ...ast.body];
            }
            imports = [...imports, ...i];

            let exports: Expression[] = []
            for (const e of program.body) {
                if (e.type === "FunctionDeclaration") {
                    if ((e as FunctionDeclaration).modifiers?.includes("pub")) {
                        exports.push(e);
                    }
                }
            }

            this.modules.set(expr.path, {
                files: files.map(file => path.join(dir, file)),
                merged: program,
                imports: i,
                exports
            });
        }
        return imports;
    }
}