import { Keyword, Modifier, Modifiers, Token, TokenType } from "../lexer/token"
import { BinaryExpression, BooleanLiteral, CaseExpression, CommentExpression, ElseExpression, Expression, FunctionCall, FunctionDeclaration, FunctionParam, Identifier, IfExpression, ImportExpression, MemberAccess, NullLiteral, NumberLiteral, PostUnaryExpression, PreUnaryExpression, ProgramExpression, ReturnExpression, StringLiteral, SwitchExpression, VariableDeclaration, WhileExpression } from "./ast"
export class Parser {
    tokens: Token[]
    program: ProgramExpression = {
        type: "Program",
        body: []
    }
    pos: number = 0

    table: { [key in TokenType]?: (t: Token) => Expression | null } = {
        Number: this.visitNumberLiteral.bind(this),
        String: this.visitStringLiteral.bind(this),
        Boolean: this.visitBooleanLiteral.bind(this),
        Null: this.visitNullLiteral.bind(this),

        Comment: this.visitComment.bind(this),
        Identifier: this.visitIdentifier.bind(this),
        Keyword: this.visitKeyword.bind(this),
    }

    precedence: { [op: string]: number } = {
        "==": 1,
        "!=": 1,
        "<": 2,
        ">": 2,
        "<=": 2,
        ">=": 2,
        "+": 3,
        "-": 3,
        "*": 4,
        "/": 4,
    }

    modifiers: Modifier[] = []

    constructor(tokens: Token[]) {
        this.tokens = tokens
    }

    public parse(): ProgramExpression {
        this.pos = 0
        while (this.pos < this.tokens.length) {
            const t = this.peek()
            if (t.type === "EOF") {
                break
            }
            // WTF
            if ((Modifiers as unknown as string[]).includes(t.literal)) {
                this.modifiers.push(t.literal as Modifier)
                this.advance()
                continue
            }

            const expr = this.parseExpression()
            this.modifiers = []

            if (expr) {
                this.program.body.push(expr)
            }
        }

        return this.program
    }

    private parseExpression(precedence = 0, tok?: Token): Expression | null {
        let left = this.parsePrimary(tok)
        if (!left) return null;

        while (true) {
            if (this.peek().type === "Operator" && 
                (this.peek().literal === "++" || this.peek().literal === "--")) {
                const op = this.peek();
                this.advance();
                left = {
                    type: "PostUnaryExpression",
                    operator: op.literal,
                    operand: left
                } as PostUnaryExpression;
            }

            else if (this.peek().literal === ".") {
                this.advance();
                if (this.peek().type !== "Identifier") {
                    throw new Error("expected identifier after '.'");
                }
                const property = {
                    type: "Identifier",
                    value: this.peek().literal
                } as Identifier;
                this.advance();
                
                left = {
                    type: "MemberAccess",
                    object: left,
                    property
                } as MemberAccess;
            }

            else if (this.peek().literal === "(") {
                this.advance();
                const args: Expression[] = [];
                
                if (this.peek().literal !== ")") {
                    while (this.peek().literal !== ")" && this.peek().type !== "EOF") {
                        const arg = this.parseExpression();
                        if (!arg) throw new Error("expected expression in function call");
                        args.push(arg);
                        
                        if (this.peek().literal === ",") {
                            this.advance();
                        }
                    }
                }
                
                if (this.peek().literal !== ")") {
                    throw new Error("expected ')' to close function call");
                }
                this.advance();
                
                left = {
                    type: "FunctionCall",
                    callee: left,
                    args
                } as FunctionCall;
            }

            else if (this.peek().type === "Operator" && this.getPrecedence(this.peek()) > precedence) {
                const op = this.peek();
                this.advance();
                const right = this.parseExpression(this.getPrecedence(op));
                if (!right) return null;
                
                left = {
                    type: "BinaryExpression",
                    left,
                    operator: op.literal,
                    right
                } as BinaryExpression;
            }
            else {
                break;
            }
        }

        return left
    }

    private parsePrimary(tok?: Token): Expression | null {
        const t = tok || this.peek()

        // (x + y) / z
        if (t.literal === "(") {
            this.advance()
            const expr = this.parseExpression()
            if (this.peek().literal !== ")") {
                throw new Error("expected ')' after expression")
            }
            this.advance()
            return expr
        }

        // -x !y
        if (t.type === "Operator" && (t.literal === "-" || t.literal === "!")) {
            this.advance()
            const operand = this.parseExpression(100)
            if (!operand) throw new Error("expected expression after unary operator")
            return {
                type: "PreUnaryExpression",
                operator: t.literal,
                operand
            } as PreUnaryExpression
        }

        if (t.type in this.table) {
            const tok = this.peek()
            this.advance()
            return this.table[tok.type]!(tok)
        }

        return null
    }

    private visitNumberLiteral(t: Token): NumberLiteral {
        return {
            type: "NumberLiteral",
            value: parseFloat(t.literal)
        }
    }

    private visitStringLiteral(t: Token): StringLiteral {
        return {
            type: "StringLiteral",
            value: t.literal
        }
    }

    private visitBooleanLiteral(t: Token): BooleanLiteral {
        return {
            type: "BooleanLiteral",
            value: t.literal === "true"
        }
    }

    private visitNullLiteral(t: Token): NullLiteral {
        return {
            type: "NullLiteral",
            value: null
        }
    }

    private visitIdentifier(t: Token): Identifier {
        return {
            type: "Identifier",
            value: t.literal
        };
    }

    private visitKeyword(t: Token): Expression | null {
        // turned switch into table :hooray:
        const table: { [key in Keyword]?: () => Expression | null } = {
            "fn": this.parseFunctionDeclaration.bind(this),
            "if": this.parseIfExpression.bind(this),
            "while": this.parseWhileExpression.bind(this),
            "return": this.parseReturnExpression.bind(this),
            "let": () => this.parseVariableDeclaration.bind(this)(true),
            "const": () => this.parseVariableDeclaration.bind(this)(false),
            "switch": this.parseSwitchExpression.bind(this),
            "use": this.parseImportExpression.bind(this),
        }

        if (t.literal in table) {
            return table[t.literal as Keyword]!()
        }

        return null
    }

    private parseVariableDeclaration(mutable: boolean): VariableDeclaration {
        const name: Identifier = {
            type: "Identifier",
            value: this.peek().literal
        }

        this.advance()

        if (this.peek().literal !== ":") {
            // no type annotation
            // var x := 5
            if (this.peek().literal !== ":=") {
                throw new Error("expected ':=' after variable name")
            }

            this.advance()
            const value = this.parseExpression()
            if (!value) {
                throw new Error("expected value after ':='")
            }

            return {
                type: "VariableDeclaration",
                name,
                value,
                mutable
            }
        }
        this.advance()

        const typeAnnotation: Identifier = {
            type: "Identifier",
            value: this.peek().literal
        }

        this.advance()
        if (this.peek().literal !== "=") {
            throw new Error("expected '=' after type annotation")
        }

        this.advance()
        const value = this.parseExpression()
        if (!value) {
            throw new Error("expected value after '='")
        }

        return {
            type: "VariableDeclaration",
            name,
            value,
            typeAnnotation,
            mutable
        }
    }

    private visitComment(t: Token): CommentExpression {
        return {
            type: "CommentExpression",
            value: t.literal
        }
    }

    private parseFunctionDeclaration(): FunctionDeclaration {
        const modifiers = this.modifiers
        const name: Identifier = {
            type: "Identifier",
            value: this.peek().literal
        }

        this.advance()

        if (this.peek().literal !== "(") {
            throw new Error("expected '(' after function name")
        }

        const params: FunctionParam[] = []

        if (this.peek(1).literal !== ")") {
            while (this.peek().literal !== ")" && this.peek().type !== "EOF") {
                const name: Identifier = {
                    type: "Identifier",
                    value: this.advance().literal
                }

                this.advance()

                if (this.peek().literal !== ":") {
                    throw new Error("expected ':' after parameter name")
                }

                const type: Identifier = {
                    type: "Identifier",
                    value: this.advance().literal
                }

                params.push({
                    type: "FunctionParam",
                    name,
                    paramType: type
                })

                if (this.peek().literal === ",") {
                    this.advance()
                }

                this.advance()
            }
        } else {
            this.advance()
        }
        
        this.advance()
        
        if (this.peek().literal === "->") {
            const returnType: Identifier = {
                type: "Identifier",
                value: this.advance().literal
            }

            this.advance()
            
            let body: Expression[] = []
            if (!modifiers.includes("extern")) body = this.parseBlock()

            return {
                type: "FunctionDeclaration",
                name,
                params,
                body,
                returnType,
                modifiers
            }
        }

        const body: Expression[] = this.parseBlock()

        return {
            type: "FunctionDeclaration",
            name,
            params,
            body,
            modifiers
        }
    }

    private parseBlock(): Expression[] {
        const body: Expression[] = []
        if (this.peek().literal !== "{") {
            throw new Error(`expected "{" to start function body, got "${this.peek().literal}"`)
        }

        this.advance()

        while (this.peek().literal !== "}" && this.peek().type !== "EOF") {
            const expr = this.parseExpression()
            if (expr) {
                body.push(expr)
            }
        }

        this.advance()

        return body
    }

    private parseReturnExpression(): ReturnExpression {
        return {
            type: "ReturnExpression",
            value: this.parseExpression(0, this.peek()) || {
                type: "NullLiteral",
                value: null
            } as NullLiteral
        }
    }

    private parseIfExpression(): IfExpression {
        const condition = this.parseExpression(0, this.advance())
        if (!condition) {
            throw new Error("expected condition after 'if'")
        }
        this.advance()
        const body = this.parseBlock()
        let alternate: IfExpression | ElseExpression | undefined;

        if (this.peek().literal === "else") {
            this.advance()
            if (this.peek().literal === "if") {
                this.advance()
                alternate = this.parseIfExpression()
            } else {
                alternate = this.parseElseExpression()
            }
        }

        return {
            type: "IfExpression",
            condition,
            body,
            alternate
        }
    }

    private parseElseExpression(): ElseExpression {
        const body = this.parseBlock()
        return {
            type: "ElseExpression",
            body
        }
    }

    private parseWhileExpression(): WhileExpression {
        const condition = this.parseExpression(0, this.advance())
        if (!condition) {
            throw new Error("expected condition after 'while'")
        }
        this.advance()
        const body = this.parseBlock()
        return {
            type: "WhileExpression",
            condition,
            body
        }
    }

    private parseSwitchExpression(): SwitchExpression {
        const value = this.parseExpression(0, this.advance())
        if (!value) {
            throw new Error("expected value after 'switch'")
        }

        if (this.advance().literal !== "{") {
            throw new Error("expected '{' after switch value")
        }
        this.advance()

        if (this.peek().literal === "}") {
            this.advance()
            return {
                type: "SwitchExpression",
                value,
                cases: []
            }
        }

        const cases: CaseExpression[] = []

        while (this.peek().literal !== "}" && this.peek().type !== "EOF") {
            let value: Expression | "default" = (() => {
                if (this.peek().literal === "default") {
                    this.advance()
                    return "default"
                }
                const val = this.parseExpression(0)
                if (!val) {
                    throw new Error("expected case value")
                }
                return val
            })()

            if (this.peek().literal !== "->") {
                throw new Error("expected '->' after case value")
            }
            this.advance()
            
            const body: Expression[] = this.parseBlock()
            cases.push({
                type: "CaseExpression",
                value,
                body
            })
        }

        this.advance()

        return {
            type: "SwitchExpression",
            value,
            cases
        }
    }

    private parseImportExpression(): ImportExpression {
        // for "use std/io as stdio" tokens would be like
        // Identifier("std") Operator("/") Identifier("io") Keyword("as") Identifier("stdio")
        // and we gotta turn that into name = "std/io" and alias = "stdio"
        let path = (() => {
            const parts: string[] = []
            while (this.peek().type === "Identifier" || this.peek().literal === "/") {
                parts.push(this.peek().literal)
                this.advance()
            }
            return parts.join("")
        })()
        
        if (this.peek().literal !== "as") {
            return {
                type: "ImportExpression",
                path
            }
        }

        this.advance()

        if (this.peek().type !== "Identifier") {
            throw new Error(`expected identifier after "as", got "${this.peek().literal}"`)
        }

        const alias = this.peek().literal
        this.advance()
        return {
            type: "ImportExpression",
            path,
            alias
        }
    }

    private advance(n = 1): Token {
        this.pos += n
        return this.tokens[this.pos] || { type: "EOF", literal: "" }
    }

    private peek(n = 0): Token {
        return this.tokens[this.pos + n] || { type: "EOF", literal: "" }
    }

    private getPrecedence(token: Token): number {
        return this.precedence[token.literal] || 0
    }

    private peekPrecedence(n = 1): number {
        return this.getPrecedence(this.peek()) || 0
    }
}