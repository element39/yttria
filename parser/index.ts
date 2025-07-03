import { Token, TokenType } from "../lexer/token"
import { BooleanLiteral, Expression, FunctionDeclaration, FunctionParam, Identifier, NullLiteral, NumberLiteral, ProgramExpression, ReturnExpression, StringLiteral } from "./ast"

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
            this.advance()
        }

        return this.program
    }

    private parseExpression(tok?: Token): Expression | null {
        const t = tok || this.peek()

        if (t.type in this.table) {
            return this.table[t.type]!(t)
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

        this.advance() // consume the closing parenthesis
        
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
            value: this.parseExpression(this.advance()) || {
                type: "NullLiteral",
                value: null
            } as NullLiteral
        }
    }

    private advance(n = 1): Token {
        this.pos += n
        const t = this.tokens[this.pos] || { type: "EOF", literal: "" }
        return t
    }

    private peek(n = 0): Token {
        return this.tokens[this.pos + n] || { type: "EOF", literal: "" }
    }
}