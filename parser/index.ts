import { Token, TokenType } from "../lexer/token"
import { BinaryExpression, BooleanLiteral, CommentExpression, ElseExpression, Expression, FunctionCall, FunctionDeclaration, FunctionParam, Identifier, IfExpression, NullLiteral, NumberLiteral, ProgramExpression, ReturnExpression, StringLiteral, UnaryExpression, VariableDeclaration } from "./ast"

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

    private visitIdentifier(t: Token): Identifier | FunctionCall {
        if (this.peek().literal === "(") {
            this.advance()
            const args: Expression[] = []

            if (this.peek().literal !== ")") {
                while (this.peek().literal !== ")" && this.peek().type !== "EOF") {
                    const arg = this.parseExpression()
                    if (!arg) throw new Error("Expected expression in function call arguments")
                    args.push(arg)

                    if (this.peek().literal === ",") {
                        this.advance()
                    }
                }
            }

            this.advance()

            return {
                type: "FunctionCall",
                callee: this.visitIdentifier(t) as Identifier,
                args
            } as FunctionCall
        }

        return {
            type: "Identifier",
            value: t.literal
        }
    }

    private visitKeyword(t: Token): Expression | null {
        switch (t.literal) {
            case "fn":
                return this.parseFunctionDeclaration()
            case "if":
                return this.parseIfExpression()
            case "return":
                return this.parseReturnExpression()
            case "let":
                return this.parseVariableDeclaration(true)
            case "const":
                return this.parseVariableDeclaration(false)
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
                throw new Error("Expected ':=' after variable name")
            }

            this.advance()
            const value = this.parseExpression()
            if (!value) {
                throw new Error("Expected value after ':='")
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
            throw new Error("Expected '=' after type annotation")
        }

        this.advance()
        const value = this.parseExpression()
        if (!value) {
            throw new Error("Expected value after '='")
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
        const name: Identifier = {
            type: "Identifier",
            value: this.peek().literal
        }

        this.advance()

        if (this.peek().literal !== "(") {
            throw new Error("Expected '(' after function name")
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
        } else {
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
            throw new Error("Expected condition after 'if'")
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