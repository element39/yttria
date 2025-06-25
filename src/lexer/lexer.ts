import { KEYWORDS, Token } from "./token";

export class Lexer {
    private src: string;
    private tokens: Token[] = [];
    private pos: number = 0;

    constructor(src: string) {
        this.src = src.trim();
    }

    public lex(): Token[] {
        this.pos = 0;

        while (this.pos < this.src.length) {
            this.skipWhitespace();            
            const char = this.advance();

            // EOL
            if (char === "\n") {
                this.tokens.push({
                    type: "EOL",
                    literal: char
                });
                continue;
            }
            
            // identifiers + keywords
            if (/[a-zA-Z_]/.test(char)) {
                let literal = char;
                while (this.pos < this.src.length && /[a-zA-Z0-9_]/.test(this.src[this.pos])) {
                    literal += this.advance();
                }

                const type = KEYWORDS[literal] || "Identifier";
                this.tokens.push({ type, literal });

                continue;
            }

            // numbers
            if (/\d/.test(char)) {
                let literal = char;
                let isDecimal = false;

                while (this.pos < this.src.length && (/\d/.test(this.src[this.pos]) || (!isDecimal && this.src[this.pos] === '.'))) {
                    if (this.src[this.pos] === '.') {
                        isDecimal = true;
                    }
                    literal += this.advance();
                }

                this.tokens.push({
                    type: "Number",
                    literal
                });

                continue;
            }

            // operators
            if (char === '-' && this.src[this.pos] === '>') {
                this.advance();
                this.tokens.push({
                    type: "Operator",
                    literal: "->"
                });
                continue;
            }

            // more operators
            if ("+-*/%&|^=<>!".includes(char)) {
                let literal = char;
                while (this.pos < this.src.length && "*/%&|^=<>!".includes(this.src[this.pos])) {
                    literal += this.advance();
                }
                this.tokens.push({
                    type: "Operator",
                    literal
                });
                continue;
            }

            // delimiters
            if (char === ':' && this.src[this.pos] === '=') {
                this.advance();
                this.tokens.push({
                    type: "Operator",
                    literal: ":="
                });
                continue;
            }

            if (`.,;:(){}[]"'\``.includes(char)) {
                this.tokens.push({
                    type: "Delimiter",
                    literal: char
                });
                continue;
            }

            if (char !== '') {
                this.tokens.push({
                    type: "Unknown",
                    literal: char
                });
            }
        }

        this.tokens.push({
            type: "EOF",
            literal: ''
        });

        return this.tokens;
    }

    private advance(): string {
        if (this.pos >= this.src.length) return '';
        const char = this.src[this.pos];
        this.pos++;
        return char;
    }

    private skipWhitespace(): void {
        while (
            this.pos < this.src.length &&
            (this.src[this.pos] === ' ' || this.src[this.pos] === '\t' || this.src[this.pos] === '\r')
        ) {
            this.pos++;
        }
    }
}