import { Token, TokenType } from "../lexer/token";
import { BinaryExpression, ConstDeclaration, Expression, FunctionDeclaration, Identifier, NumberLiteral, ProgramExpression, ReturnExpression } from "./ast";

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
            const expr = this.parseExpression();
            if (expr) {
                this.program.body.push(expr);
            } else {
                this.advance();
            }
        }
        return this.program;
    }

    private parseExpression(): Expression | undefined {
        return this.parseAdditive();
    }

    private parseAdditive(): Expression | undefined {
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

    private parseMultiplicative(): Expression | undefined {
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

    private parsePrimary(): Expression | undefined {
        const tok = this.peek();
        if (!tok) return undefined;

        switch (tok.type) {
            case "Number":
                this.advance();
                return {
                    type: "NumberLiteral",
                    value: Number(tok.literal)
                } as NumberLiteral;
            case "Identifier":
                this.advance();
                return {
                    type: "Identifier",
                    name: tok.literal
                } as Identifier;
            case "Keyword":
                return this.parseKeyword(tok);
        }


        if (tok.literal === "(") {
            this.advance();
            const expr = this.parseExpression()!;
            this.expect("Delimiter", ")");
            return expr;
        }
        return undefined;
    }

    private parseKeyword(tok: Token): Expression | undefined {
        switch (tok.literal) {
            case "const":
                return this.parseConstDeclaration(tok);
            case "fn":
                return this.parseFunctionDeclaration(tok);
            case "return":
                this.advance();
                const returnValue = this.parseExpression();
                if (returnValue) {
                    return {
                        type: "ReturnExpression",
                        value: returnValue
                    } as ReturnExpression;
                }
                break;
        }

        return undefined;
    }

    private parseConstDeclaration(tok: Token): ConstDeclaration {
        // const a := 5 or const b: int = 10
        const name = this.expectNext("Identifier");
        let value: Expression | undefined;
        let typeAnnotation: Identifier | undefined;

        if (this.peek()?.literal === ":=") {
            this.advance();
            value = this.parseExpression();
        }

        if (this.peek()?.literal === ":") {
            typeAnnotation = {
                type: "Identifier",
                name: this.expectNext("Identifier").literal
            }

            if (this.expect("Operator", "=")) {
                value = this.parseExpression();
            }
        }         

        return {
            type: "ConstDeclaration",
            name: {
                type: "Identifier",
                name: name.literal,
            } as Identifier,
            value: value,
            typeAnnotation: typeAnnotation
        } as ConstDeclaration
    }

    private parseFunctionDeclaration(tok: Token): FunctionDeclaration | undefined {
        // fn main() -> int { ... }
        this.advance();
        const name = this.expect("Identifier");
        
        // todo: params
        if (this.expect("Delimiter", "(")) {
            while (this.peek()?.type !== "Delimiter" || this.peek()?.literal !== ")") {
                this.advance();
            }
            this.expect("Delimiter", ")");
        }
        this.expect("Operator", "->");
        
        const returnType = this.expect("Identifier");

        if (this.expect("Delimiter", "{")) {
            const body: Expression[] = [];
            while (this.peek()?.type !== "Delimiter" || this.peek()?.literal !== "}") {
                const expr = this.parseExpression();
                if (expr) {
                    body.push(expr);
                } else {
                    this.advance();
                }
            }
            this.expect("Delimiter", "}");
            return {
                type: "FunctionDeclaration",
                name: {
                    type: "Identifier",
                    name: name.literal
                } as Identifier,
                parameters: [],
                returnType: {
                    type: "Identifier",
                    name: returnType.literal
                } as Identifier,
                body
            }
        }
    }

    private expect(type: TokenType, literal?: string): Token {
        const tok = this.peek();
        if (!tok || tok.type !== type) {
            throw new Error(`Expected token of type ${type}, but got ${tok ? tok.type : "EOF"}`);
        }

        if (literal && tok.literal !== literal) {
            throw new Error(`Expected token with literal '${literal}', but got '${tok.literal}'`);
        }

        this.advance();
        return tok;
    }

    private expectNext(type: TokenType, literal?: string): Token {
        this.advance();
        const tok = this.peek();
        if (!tok || tok.type !== type) {
            throw new Error(`Expected token of type ${type}, but got ${tok ? tok.type : "EOF"}`);
        }

        if (literal && tok.literal !== literal) {
            throw new Error(`Expected token with literal '${literal}', but got '${tok.literal}'`);
        }

        this.advance();
        return tok;
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