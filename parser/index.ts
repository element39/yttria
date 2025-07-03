import { Token, TokenType } from "../lexer/token"
import { Expression, FunctionDeclaration, FunctionParam, Identifier, ProgramExpression } from "./ast"

export class Parser {
    tokens: Token[]
    program: ProgramExpression = {
        type: "Program",
        body: []
    }
    pos: number = 0

    table: { [key in TokenType]?: (t: Token) => Expression | null } = {
        Keyword: this.visitKeyword,
    }
    
    constructor(tokens: Token[]) {
        this.tokens = tokens
    }

    public parse(): ProgramExpression {
        this.pos = 0
        while (this.pos < this.tokens.length) {
            const tok = this.peek()

            const handler = this.table[tok.type]
            if (handler) {
                const expr = handler.call(this, tok)
                if (expr) {
                    this.program.body.push(expr)
                }
            }

            this.advance()
        }

        return this.program
    }

    private visitKeyword(t: Token): Expression | null {
        switch (t.literal) {
            case "fn":
                return this.parseFunctionDeclaration(t)
            default:
                return null
        }
    }

    // fn fib(n: int) -> int { ... }
    private parseFunctionDeclaration(t: Token): FunctionDeclaration {
        this.advance()

        const name: Identifier = {
            type: "Identifier",
            value: this.peek().literal
        }
        this.advance()

        if (this.peek().literal === "(") {
            this.advance()
        }

        const params: FunctionParam[] = []
        while (this.peek().literal !== ")") {
            const name: Identifier = {
                type: "Identifier",
                value: this.peek().literal
            }
            this.advance()

            if (this.peek().literal !== ":") {
                throw new Error("Expected ':' after parameter name")
            }
            this.advance()

            const type: Identifier = {
                type: "Identifier",
                value: this.peek().literal
            }
            this.advance()

            params.push({ name, type })

            if (this.peek().literal === ",") {
                this.advance()
            }
        }

        this.advance()

        if (this.peek().literal === "->") {
            this.advance()
        }

        const returnType: Identifier = {
            type: "Identifier",
            value: this.peek().literal
        }

        if (this.peek().literal === "{") {
            this.advance()
        }

        while (this.peek().literal !== "}") {
            this.advance()
        }

        return {
            type: "FunctionDeclaration",
            name,
            params,
            returnType,
            body: []
        }
    }

    private advance(n = 1): Token {
        return this.tokens[this.pos += n] || { type: "EOF", literal: "" }
    }

    private peek(n = 0): Token {
        return this.tokens[this.pos + n] || { type: "EOF", literal: "" }
    }
}