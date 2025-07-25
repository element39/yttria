import { readdirSync, readFileSync } from "fs";
import path from "path";
import { Lexer } from "../lexer";
import { Parser } from "../parser";
import { ImportExpression, ProgramExpression } from "../parser/ast";
import { ResolvedModule } from "./types";

export class ModuleResolver {
    private ast: ProgramExpression;
    public modules: { [key: string]: ResolvedModule } = {};

    constructor(ast: ProgramExpression) {
        this.ast = ast;
    }

    resolve() {
        for (const expr of this.ast.body) {
            if (expr.type !== "ImportExpression") continue;
            const ixpr = expr as ImportExpression;

            if (this.modules[ixpr.path]) continue;

            const moduleDir = path.resolve(path.join("./src/module", ixpr.path));
            const files = readdirSync(moduleDir)
                .filter((file) => file.endsWith(".yt"))
                .map((file) => path.resolve(path.join(moduleDir, file)));

            const mergedAst: ProgramExpression = { type: "Program", body: [] };

            for (const file of files) {
                let fileContent: string;
                try {
                    fileContent = readFileSync(file, "utf8");
                } catch (e) {
                    throw new Error(`Failed to read ${file}: ${e}`);
                }

                const tokens = new Lexer(fileContent).lex();
                const fileAst = new Parser(tokens).parse();
                mergedAst.body.push(...fileAst.body);
            }

            this.modules[ixpr.path] = { ast: mergedAst };

            const resolver = new ModuleResolver(mergedAst);
            const subModules = resolver.resolve();
            Object.assign(this.modules, subModules);
        }

        return this.modules;
    }
}