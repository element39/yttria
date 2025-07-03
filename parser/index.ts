import { Token, TokenType } from "../lexer/token"
import { BinaryExpression, BooleanLiteral, ElseExpression, Expression, FunctionDeclaration, FunctionParam, Identifier, IfExpression, NullLiteral, NumberLiteral, ProgramExpression, ReturnExpression, StringLiteral } from "./ast"

export class Parser {
    tokens: Token[]
    program: ProgramExpression = {
        type: "Program",
        body: []
    }
    pos: number = 0

    precedences: Record<string, number> = {
        "=": 1,
        "||": 2,
        "&&": 3,
        "==": 4, "!=": 4,
        "<": 5, "<=": 5, ">": 5, ">=": 5,
        "+": 6, "-": 6,
        "*": 7, "/": 7,
    }

    table: { [key in TokenType]?: (t: Token) => Expression | null } = {
        Keyword: this.visitKeyword,
        Identifier: this.visitIdentifier,

        Number: this.visitNumberLiteral,
        String: this.visitStringLiteral,
        Boolean: this.visitBooleanLiteral,
        Null: this.visitNullLiteral,
    }
    
    constructor(tokens: Token[]) {
        this.tokens = tokens
    }

    public parse(): ProgramExpression {
        this.pos = 0
        while (this.pos < this.tokens.length) {
            const tok = this.peek()
            const expr = this.parseExpression(undefined, tok)
            if (expr) {
                this.program.body.push(expr)
            }

            this.advance()
        }

        return this.program
    }

    private parseExpression(precedence = 0, tok?: Token): Expression | null {
        const t = tok || this.peek()

        if (t.type === "EOF") {
            return null
        }

        let left: Expression | null = null

        const handler = this.table[t.type]
        if (handler) {
            left = handler.call(this, t)
        }

        if (!left) {
            return null
        }

        while (precedence < this.getPrecedence(this.peek().literal)) {
            const op = this.peek()
            this.advance()
            const right = this.parseExpression(this.getPrecedence(op.literal))
            
            if (!right) {
                break
            }

            left = {
                type: "BinaryExpression",
                left,
                operator: op.literal,
                right
            } as BinaryExpression
        }

        return left
    }

    private getPrecedence(op: string): number {
        return this.precedences[op] || 0
    }

    private visitKeyword(t: Token): Expression | null {
        switch (t.literal) {
            case "fn":
                return this.parseFunctionDeclaration(t)
            case "if":
                return this.parseIfExpression(t)
            case "return":
                return this.parseReturnExpression(t)
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

            const paramType: Identifier = {
                type: "Identifier",
                value: this.peek().literal
            }
            this.advance()

            params.push({ type: "FunctionParam", name, paramType })

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

        this.advance()
        const body: Expression[] = this.parseBlock()

        return {
            type: "FunctionDeclaration",
            name,
            params,
            returnType,
            body
        }
    }

    // if (condition) { ... } else if (condition) { ... } else { ... }
    private parseIfExpression(t: Token): IfExpression {
        this.advance()

        let condition: Expression = {} as Expression
        if (this.peek().literal === "(") {
            this.advance()
            condition = this.parseExpression(0)!
            if (this.peek().literal === ")") {
                this.advance()
            }
        }

        const body = this.parseBlock()

        let alternate: IfExpression | ElseExpression | undefined = undefined
        if (this.peek().literal === "else") {
            this.advance()

            if (this.peek().literal === "if") {
                alternate = this.parseIfExpression(this.peek())
            } else if (this.peek().literal === "{") {
                const elseBody = this.parseBlock()
                alternate = {
                    type: "ElseExpression",
                    body: elseBody
                }
            }
        }

        return {
            type: "IfExpression",
            condition,
            body,
            alternate
        }
    }
    
    // { ... }
    private parseBlock(): Expression[] {
        const body: Expression[] = []
        if (this.peek().literal === "{") {
            this.advance()
            while (this.peek().literal !== "}" && this.peek().type !== "EOF") {
                const expr = this.parseExpression(0)
                if (expr) body.push(expr)
                this.advance()
            }
            if (this.peek().literal === "}") {
                this.advance()
            }
        }
        return body
    }

    // return ...
    private parseReturnExpression(t: Token): ReturnExpression {
        this.advance()
        
        const value = this.parseExpression(0)

        return {
            type: "ReturnExpression",
            value
        }
    }

    private visitNumberLiteral(t: Token): NumberLiteral | null {
        const lit: NumberLiteral = {
            type: "NumberLiteral",
            value: parseFloat(t.literal)
        }
        
        if (isNaN(lit.value)) {
            throw new Error(`Invalid number literal: ${t.literal}`)
        }

        return lit
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

    private visitIdentifier(t: Token): Identifier | null {
        return {
            type: "Identifier",
            value: t.literal
        }
    }

    private advance(n = 1): Token {
        return this.tokens[this.pos += n] || { type: "EOF", literal: "" }
    }

    private peek(n = 0): Token {
        return this.tokens[this.pos + n] || { type: "EOF", literal: "" }
    }
}