import { Token, TokenType } from "../lexer/token"
import { BinaryExpression, BooleanLiteral, Expression, FunctionDeclaration, FunctionParam, Identifier, NullLiteral, NumberLiteral, ProgramExpression, ReturnExpression, StringLiteral, UnaryExpression } from "./ast"

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

            const expr = this.parseExpression()

            if (expr) {
                this.program.body.push(expr)
            }
        }

        return this.program
    }

    private parseExpression(precedence = 0, tok?: Token): Expression | null {
        let left = this.parsePrimary()

        // x + y / z
        while (this.peek().type === "Operator" && this.getPrecedence(this.peek()) > precedence) {
            const op = this.peek()
            this.advance()
            const right = this.parseExpression(this.getPrecedence(op))
            if (!right) return null
            
            left = {
                type: "BinaryExpression",
                left,
                operator: op.literal,
                right
            } as BinaryExpression
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
                throw new Error("Expected ')' after expression")
            }
            this.advance()
            return expr
        }

        // -x !y
        if (t.type === "Operator" && (t.literal === "-" || t.literal === "!")) {
            this.advance()
            const operand = this.parseExpression(100)
            if (!operand) throw new Error("Expected expression after unary operator")
            return {
                type: "UnaryExpression",
                operator: t.literal,
                operand
            } as UnaryExpression
        }

        if (t.type in this.table) {
            const tok = this.peek()
            this.advance()
            return this.table[tok.type]!(tok)
            
            // if something breaks replace this clause with
            // return this.table[t.type](t)
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
        }
    }

    private visitKeyword(t: Token): Expression | null {
        switch (t.literal) {
            case "fn":
                return this.parseFunctionDeclaration()
            case "return":
                return this.parseReturnExpression()
        }

        return null
    }

    private parseFunctionDeclaration(): FunctionDeclaration {
        const name: Identifier = {
            type: "Identifier",
            value: this.advance().literal
        }

        if (this.advance().literal !== "(") {
            throw new Error("Expected '(' after function name")
        }

        const params: FunctionParam[] = []

        while (this.peek().literal !== ")" && this.peek().type !== "EOF") {
            const name: Identifier = {
                type: "Identifier",
                value: this.advance().literal
            }

            this.advance()
            if (this.peek().literal !== ":") {
                throw new Error("Expected ':' after parameter name")
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
        this.advance()
        
        if (this.peek().literal !== "->") {
            throw new Error("Expected '->' after function parameters")
        }

        const returnType: Identifier = {
            type: "Identifier",
            value: this.advance().literal
        }

        this.advance()
        
        const body: Expression[] = this.parseBlock()

        return {
            type: "FunctionDeclaration",
            name,
            params,
            body,
            returnType
        }
    }

    private parseBlock(): Expression[] {
        const body: Expression[] = []
        
        if (this.peek().literal !== "{") {
            throw new Error("Expected '{' to start function body")
        }

        this.advance()

        while (this.peek().literal !== "}" && this.peek().type !== "EOF") {
            const expr = this.parseExpression()
            if (expr) {
                body.push(expr)
            }
            this.advance()
        }

        return body
    }

    private parseReturnExpression(): ReturnExpression {
        return {
            type: "ReturnExpression",
            value: this.parseExpression(0, this.advance()) || {
                type: "NullLiteral",
                value: null
            } as NullLiteral
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