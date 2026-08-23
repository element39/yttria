import { readdir } from "fs/promises";
import { relative, resolve, sep } from "path";

import { Lexer } from "../lexer";
import { Parser } from "../parser";
import { ImportExpression, ProgramExpression } from "../parser/ast";

export class ModuleLoader {
    private loaded = new Map<string, ProgramExpression[]>();
    private loadedFiles = new Set<string>();
    private root = "";

    async load(path: string, filename?: string, source?: string) {
        this.root = resolve(path);

        if (source !== undefined) {
            if (!filename) {
                throw new Error("filename is required when loading source");
            }

            const filePath = resolve(this.root, filename);

            this.loaded.set("main", []);

            await this.loadFile("main", filePath, source);

            return this.loaded;
        }

        await this.loadModule(this.root);

        return this.loaded;
    }

    private async loadModule(modulePath: string) {
        const moduleName = modulePath === this.root
            ? "main"
            : relative(this.root, modulePath).split(sep).join("/");

        if (this.loaded.has(moduleName)) {
            return;
        }

        this.loaded.set(moduleName, []);

        let files = await readdir(modulePath);

        files = files
            .filter(file => file.endsWith(".yt"))
            .sort((a, b) => {
                if (a === "extern.yt") return -1;
                if (b === "extern.yt") return 1;
                return a.localeCompare(b);
            });

        for (const filename of files) {
            const filePath = resolve(modulePath, filename);
            const source = await Bun.file(filePath).text();

            await this.loadFile(
                moduleName,
                filePath,
                source
            );
        }
    }

    private async loadFile(
        moduleName: string,
        filePath: string,
        source: string
    ) {
        if (this.loadedFiles.has(filePath)) {
            return;
        }

        this.loadedFiles.add(filePath);

        const lexer = new Lexer(source);
        const tokens = lexer.lex();

        const parser = new Parser(tokens);
        const ast = parser.parse();

        this.loaded.get(moduleName)!.push(ast);

        for (const expression of ast.body) {
            if (expression.type !== "ImportExpression") {
                continue;
            }

            const imp = expression as ImportExpression;
            const importedPath = resolve(this.root, imp.path);

            await this.loadModule(importedPath);
        }
    }
}