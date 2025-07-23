import * as fs from "fs";
import * as path from "path";
import { Lexer } from "../lexer";
import { Parser } from "../parser";
import { ImportExpression, ProgramExpression } from "../parser/ast";

export class ModuleResolver {
    private program: ProgramExpression;
    private rootPath: string;
    private trackedModules: Record<string, ProgramExpression> = {};
    private aliases: Record<string, string> = {}; // Track aliases: alias -> module path
    private visitingModules: Set<string> = new Set(); // For cycle detection

    constructor(rootPath: string, program: ProgramExpression) {
        this.program = program;
        this.rootPath = rootPath;
    }

    async resolve() {
        for (const expr of this.program.body) {
            if (expr.type !== "ImportExpression") continue;
            const ixpr = expr as ImportExpression;
            
            if (ixpr.alias) {
                this.aliases[ixpr.alias] = ixpr.path;
            }
            
            await this.resolveModule(ixpr.path, ixpr.alias);
        }
        return this.trackedModules;
    }

    async resolveModule(modulePath: string, alias?: string) {
        // Skip if already resolved
        if (modulePath in this.trackedModules) return;
        
        // Detect circular imports
        if (this.visitingModules.has(modulePath)) {
            throw new Error(`Circular import detected: ${Array.from(this.visitingModules).join(' -> ')} -> ${modulePath}`);
        }
        
        this.visitingModules.add(modulePath);
        
        try {
            const basePath = path.dirname(this.rootPath);
            const fullPath = path.join(basePath, modulePath);
            
            let files: string[] = [];
            
            // Check if it's a directory
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
                files = fs.readdirSync(fullPath)
                    .filter(f => f.endsWith(".yt"))
                    .map(f => path.join(fullPath, f));
            } 
            // Check if it's a file with .yt extension
            else if (fs.existsSync(fullPath + ".yt")) {
                files = [fullPath + ".yt"];
            }
            // Check if it's just a file
            else if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                files = [fullPath];
            }
            else {
                throw new Error(`Module not found: ${modulePath}`);
            }
            
            if (files.length === 0) {
                throw new Error(`No .yt files found in module: ${modulePath}`);
            }

            const programs: ProgramExpression[] = [];
            for (const file of files) {
                // Parse each file
                const content = await Bun.file(file).text();
                const ast = new Parser(new Lexer(content).lex()).parse();
                
                // Process any imports within the file
                for (const expr of ast.body) {
                    if (expr.type === "ImportExpression") {
                        const ixpr = expr as ImportExpression;
                        if (ixpr.alias) {
                            this.aliases[ixpr.alias] = ixpr.path;
                        }
                        await this.resolveModule(ixpr.path, ixpr.alias);
                    }
                }

                programs.push(ast);
            }

            // Store the merged program
            this.trackedModules[modulePath] = { 
                type: "Program", 
                body: programs.flatMap(p => p.body) 
            };
            
            // Also store it under the alias if provided
            if (alias && alias !== modulePath) {
                this.trackedModules[alias] = this.trackedModules[modulePath];
            }
        } finally {
            // Clean up the cycle tracking
            this.visitingModules.delete(modulePath);
        }
    }
    
    // Helper methods to support typechecker
    
    getModuleByPath(modulePath: string): ProgramExpression | undefined {
        return this.trackedModules[modulePath];
    }
    
    getModuleByAlias(alias: string): ProgramExpression | undefined {
        const modulePath = this.aliases[alias];
        return modulePath ? this.trackedModules[modulePath] : undefined;
    }
    
    resolveModulePath(alias: string): string | undefined {
        return this.aliases[alias];
    }
}