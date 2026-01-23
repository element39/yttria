import { ProgramExpression, Expression, VariableDeclaration, NumberLiteral, BooleanLiteral, BinaryExpression, Identifier, FunctionDeclaration, ReturnExpression } from "../parser/ast";
import { Type, TypeKind } from "./types";

export class TypeInferrer {
  private ast: ProgramExpression;
  private env: Map<string, Type> = new Map();

  constructor(ast: ProgramExpression) {
    this.ast = ast;
  }

  public infer(): ProgramExpression {
    for (const node of this.ast.body) {
      this.inferNode(node);
    }
    return this.ast;
  }

  private inferNode(node: Expression): Type | undefined {
    switch (node.type) {
      case "NumberLiteral": return this.visitNumberLiteral(node as NumberLiteral);
      case "BooleanLiteral": return this.visitBooleanLiteral(node as BooleanLiteral);
      case "BinaryExpression": return this.visitBinaryExpression(node as BinaryExpression);
      case "VariableDeclaration": return this.visitVariableDeclaration(node as VariableDeclaration);
      case "Identifier": return this.visitIdentifier(node as Identifier);
      case "FunctionDeclaration": return this.visitFunctionDeclaration(node as FunctionDeclaration);
      case "ReturnExpression": return this.visitReturnExpression(node as ReturnExpression);
      default: return undefined;
    }
  }

  private visitNumberLiteral(n: NumberLiteral): Type {
    return Number.isInteger(n.value) ? { kind: "int" } : { kind: "float" };
  }

  private visitBooleanLiteral(b: BooleanLiteral): Type {
    return { kind: "bool" };
  }

  private visitBinaryExpression(b: BinaryExpression): Type | undefined {
    const L = this.inferNode(b.left);
    const R = this.inferNode(b.right);
    if (!L || !R) return undefined;
    // TODO: more complex promotion
    if (L.kind === "float" || R.kind === "float") return { kind: "float" };
    return { kind: "int" };
  }

  private visitIdentifier(id: Identifier): Type | undefined {
    return this.env.get(id.value);
  }

  private visitVariableDeclaration(v: VariableDeclaration): Type | undefined {
    const t = this.inferNode(v.value);
    if (t) {
      v.resolvedType = t;
      this.env.set(v.name.value, t);
    }
    return t;
  }

  private visitFunctionDeclaration(f: FunctionDeclaration): Type | undefined {
    const oldEnv = new Map(this.env);
    for (const p of f.params) {
      if (p.paramType) {
        this.env.set(p.name.value, { kind: (p.paramType.value as TypeKind) }); // simplistic: expects 'int'|'float' etc
      }
    }
    for (const stmt of f.body) this.inferNode(stmt);
    
    for (const stmt of f.body) {
      if (stmt.type === "ReturnExpression") {
        const ret = this.inferNode(stmt as ReturnExpression);
        if (ret) f.resolvedReturnType = ret;
        break;
      }
    }
    this.env = oldEnv;
    return f.resolvedReturnType;
  }

  private visitReturnExpression(r: ReturnExpression): Type | undefined {
    return this.inferNode(r.value);
  }
}