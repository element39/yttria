import * as fs from "fs";
import * as path from "path";
import { Lexer } from "../lexer/lexer";
import {
    Expression,
    ProgramAST,
    UseDeclarationAST,
} from "../parser/ast";
import { Parser } from "../parser/parser";

function namespaceAST(ast: ProgramAST, namespace: string): ProgramAST {
  function qualifyName(name: string) {
    return `${namespace}.${name}`;
  }

  function visit(node: Expression): Expression {
    // Qualify function and extern declarations
    if (node.type === "FnDeclaration" || node.type === "ExternalFnDeclaration") {
      (node as any).name = qualifyName((node as any).name);
      if ((node as any).body) {
        (node as any).body = (node as any).body.map(visit);
      }
    }

    // Qualify calls to identifiers
    if (node.type === "FnCall") {
      const call = node as any;
      if (call.callee?.type === "Identifier") {
        call.callee.value = qualifyName(call.callee.value);
      }
      call.args = call.args.map(visit);
    }

    // Recursively visit member access, return expressions, etc.
    if (node.type === "MemberAccess") {
      (node as any).object = visit((node as any).object);
    }
    if (node.type === "ReturnExpression" && (node as any).argument) {
      (node as any).argument = visit((node as any).argument);
    }

    return node;
  }

  return {
    ...ast,
    body: ast.body.map(visit),
  };
}

export class ImportResolver {
  private loadedModules = new Set<string>();

  constructor(
    private stdlibRoot: string,
    private projectRoot: string
  ) {}

  public resolveImport(name: string): string | null {
    // name is a string literal with quotes, e.g. "std/io" or "foo"
    const raw = name.replace(/"/g, "");
    let filePath: string;
    if (raw.startsWith("std/")) {
      filePath = path.join(this.stdlibRoot, raw.replace("std/", "") + ".yt");
    } else {
      filePath = path.join(this.projectRoot, raw + ".yt");
    }
    return fs.existsSync(filePath) ? filePath : null;
  }

  public isLoaded(modulePath: string): boolean {
    return this.loadedModules.has(modulePath);
  }

  public markLoaded(modulePath: string): void {
    this.loadedModules.add(modulePath);
  }

  public loadModule(modulePath: string): ProgramAST {
    const src = fs.readFileSync(modulePath, "utf-8");
    const tokens = new Lexer(src).lex();
    const ast = new Parser(tokens).parse();
    return this.mergeWithProjectAST(ast);
  }

  public mergeWithProjectAST(ast: ProgramAST): ProgramAST {
    const merged: ProgramAST = { type: "Program", body: [] };

    for (const node of ast.body) {
      if (node.type === "UseDeclaration") {
        const use = node as UseDeclarationAST;
        const raw = use.name.replace(/"/g, "");
        // choose alias or last segment of path
        const namespace = use.alias
          ? use.alias.replace(/"/g, "")
          : raw.split("/").pop()!;
        const importPath = this.resolveImport(use.name);
        if (importPath && !this.isLoaded(importPath)) {
          this.markLoaded(importPath);
          const importedAST = this.loadModule(importPath);
          const namespaced = namespaceAST(importedAST, namespace);
          merged.body.push(...namespaced.body);
        }
      } else {
        merged.body.push(node);
      }
    }

    return merged;
  }
}