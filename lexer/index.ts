import { Keywords, Token } from "./token"

export class Lexer {
    tokens: Token[] = []
    src: string
    pos: number = 0

    constructor(src: string) {
        this.src = src
    }

    public lex(): Token[] {
        this.pos = 0
        while (this.pos < this.src.length) {
            this.skipWhitespace()
            const char = this.advance()

            if (char === "\n") {
                this.tokens.push({
                    type: "EOL",
                    literal: char
                })
                continue
            }

            // comments
            // // ...
            if (char == "/" && this.peek() == "/") {
                let literal = ""
                this.advance()
                while (this.pos < this.src.length && this.src[this.pos] !== "\n") {
                    literal += this.advance()
                }
                this.tokens.push({
                    type: "Comment",
                    literal
                })
                continue
            }

            // # ...
            if (char == "#") {
                let literal = ""
                while (this.pos < this.src.length && this.src[this.pos] !== "\n") {
                    literal += this.advance()
                }
                this.tokens.push({
                    type: "Comment",
                    literal: literal.trim()
                })
                continue
            }

            // /* ... */
            if (char === "/" && this.peek() === "*") {
                let literal = ""
                this.advance()

                while (this.pos < this.src.length && !(this.peek() === "*" && this.peek(1) === "/")) {
                    literal += this.advance()
                }

                if (this.peek() === "*" && this.peek(1) === "/") {
                    this.advance()
                    this.advance()
                }

                this.tokens.push({
                    type: "Comment",
                    literal: literal.trim()
                })
                continue
            }

            // [| ... |]
            if (char === "[" && this.peek() === "|") {
                let literal = ""
                this.advance()

                while (this.pos < this.src.length && !(this.peek() === "|" && this.peek(1) === "]")) {
                    literal += this.advance()
                }

                if (this.peek() === "|" && this.peek(1) === "]") {
                    this.advance()
                    this.advance()
                }

                this.tokens.push({
                    type: "Comment",
                    literal: literal.trim()
                })
                continue
            }

            // numbers
            if (char >= "0" && char <= "9") {
                let literal = char
                let isDecimal = false

                while (this.pos < this.src.length && (/\d/.test(this.src[this.pos]) || (!isDecimal && this.src[this.pos] === "."))) {
                    if (this.src[this.pos] === ".") {
                        isDecimal = true
                    }
                    literal += this.advance()
                }

                this.tokens.push({
                    type: "Number",
                    literal
                })

                continue
            }

            // delimiters
            if (["(", ")", "{", "}", ",", ";", ":"].includes(char)) {
                this.tokens.push({
                    type: "Delimiter",
                    literal: char
                })
                continue
            }

            // multi-char operators
            const two = char + this.peek()
            if ([
                "==", "!=", "<=", ">=", "->", "=>", "&&", "||", "++", "--", "+=", "-=", "*=", "/="
            ].includes(two)) {
                this.tokens.push({
                    type: "Operator",
                    literal: two
                })
                this.advance()
                continue
            }

            // single-char operators
            if (["<", ">", "!", "=", "+", "-", "*", "/", "&", "|"].includes(char)) {
                this.tokens.push({
                    type: "Operator",
                    literal: char
                })
                continue
            }

            // strings
            if (char === '"') {
                let literal = ""
                while (this.pos < this.src.length && this.src[this.pos] !== '"') {
                    literal += this.advance()
                }

                if (this.peek() === '"') {
                    this.advance()
                }

                this.tokens.push({
                    type: "String",
                    literal
                })
                continue
            }

            if (char === "'") {
                let literal = ""
                while (this.pos < this.src.length && this.src[this.pos] !== "'") {
                    literal += this.advance()
                }

                if (this.peek() === "'") {
                    this.advance()
                }

                this.tokens.push({
                    type: "String",
                    literal
                })
                continue
            }

            // identifiers / keywords
            if (
                (char >= "a" && char <= "z") ||
                (char >= "A" && char <= "Z") ||
                char === "_"
            ) {
                let literal = char

                while (this.pos < this.src.length && /[a-zA-Z0-9_]/.test(this.src[this.pos])) {
                    literal += this.advance()
                }

                if (literal === "true" || literal === "false") {
                    this.tokens.push({
                        type: "Boolean",
                        literal
                    })
                    continue
                }

                if (literal === "null") {
                    this.tokens.push({
                        type: "Null",
                        literal
                    })
                    continue
                }

                this.tokens.push({
                    type: (Keywords.includes(literal) ? "Keyword" : "Identifier"),
                    literal
                })

                continue
            }
        }

        this.tokens.push({
            type: "EOF",
            literal: ""
        })

        return this.tokens
    }

    private advance(): string {
        if (this.pos >= this.src.length) return ""
        const char = this.src[this.pos]
        this.pos++
        return char
    }

    private peek(n = 0): string {
        if (this.pos >= this.src.length) return ""
        return this.src[this.pos + n]
    }

    private skipWhitespace(): void {
        while (
            this.pos < this.src.length &&
            (this.src[this.pos] === " " || this.src[this.pos] === "\t" || this.src[this.pos] === "\r")
        ) {
            this.pos++
        }
    }
}