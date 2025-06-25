import { Token } from "../lexer/token";
import { BinaryExpression, Expression, Identifier, NumberLiteral, ProgramExpression } from "./ast";

export class Parser {
    private tokens: Token[];
    private program: ProgramExpression = {
        type: "Program",
        body: []
    };
    private pos: number = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    public parse(): ProgramExpression {
        this.pos = 0;
        while (this.pos < this.tokens.length) {
            const expr = this.parseAtom();
            if (expr) {
                this.program.body.push(expr);
                this.advance();
            } else {
                break;
            }
        }
        return this.program;
    }

    private parseAtom(): Expression | undefined {
        const tok = this.peek();
        if (!tok) return undefined;
        return this.parseExpression();
    }

    private parseExpression(): BinaryExpression | NumberLiteral | Identifier | undefined {
        return this.parseAdditive();
    }

    private parseAdditive(): BinaryExpression | NumberLiteral | Identifier | undefined {
        let left = this.parseMultiplicative()!;
        while (this.peek() && (this.peek()!.literal === "+" || this.peek()!.literal === "-")) {
            const operator = this.advance()!.literal as "+" | "-";
            const right = this.parseMultiplicative()!;
            left = {
                type: "BinaryExpression",
                operator,
                left,
                right
            } as BinaryExpression;
        }
        return left;
    }

    private parseMultiplicative(): BinaryExpression | NumberLiteral | Identifier | undefined {
        let left = this.parsePrimary()!;
        while (this.peek() && (this.peek()!.literal === "*" || this.peek()!.literal === "/")) {
            const operator = this.advance()!.literal as "*" | "/";
            const right = this.parsePrimary()!;
            left = {
                type: "BinaryExpression",
                operator,
                left,
                right
            } as BinaryExpression;
        }
        return left;
    }

    private parsePrimary(): NumberLiteral | Identifier | BinaryExpression | undefined {
        const tok = this.peek();
        if (!tok) return undefined;
        if (tok.type === "Number") {
            this.advance();
            return {
                type: "NumberLiteral",
                value: Number(tok.literal)
            } as NumberLiteral;
        }
        if (tok.type === "Identifier") {
            this.advance();
            return {
                type: "Identifier",
                name: tok.literal
            } as Identifier;
        }
        if (tok.literal === "(") {
            this.advance();
            const expr = this.parseExpression()!;
            this.advance();
            return expr;
        }
        return undefined;
    }

    private advance(n = 1): Token | null {
        if (this.pos < this.tokens.length) {
            const tok = this.tokens[this.pos];
            this.pos += n;
            return tok;
        }
        return null;
    }

    private peek(n = 0): Token | null {
        if (this.pos + n < this.tokens.length) {
            return this.tokens[this.pos + n];
        }
        return null;
    }
}