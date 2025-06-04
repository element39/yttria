import { Lexer } from "../lexer/lexer";
import { Token, TokenType } from "../lexer/token";
import {
    BinaryExpressionAST,
    Expression,
    ExternalFnDeclarationAST,
    FnCallAST,
    FnDeclarationAST,
    IdentifierAST,
    LiteralAST,
    MemberAccessAST,
    ProgramAST,
    ReturnExpressionAST,
    TemplateLiteralAST,
    UnaryExpressionAST,
    UseDeclarationAST
} from "./ast";

const PRECEDENCE: Record<string, number> = {
    "=": 1, "==": 2, "!=": 2,
    "<": 2, "<=": 2, ">": 2, ">=": 2,
    "+": 3, "-": 3,
    "*": 4, "/": 4,
    ".": 5, "(": 5
};

export class Parser {
    private tokens: Token[];
    private pos: number = 0;
    private table: Partial<Record<TokenType, () => Expression | null>>;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
        this.table = {
            "Keyword": () => this.visitKeyword(),
            "Identifier": () => this.parseExpression(),
            "String": () => this.parseExpression(),
            "Number": () => this.parseExpression()
        };
    }

    private peek(n = 0): Token | undefined {
        if (this.pos + n < 0 || this.pos + n >= this.tokens.length) {
            return undefined;
        }
        return this.tokens[this.pos + n];
    }

    private isAtEnd(): boolean {
        const current = this.peek();
        return !current || current.type === "EOF";
    }

    private advance(): Token {
        const tok = this.peek();
        if (!tok) throw new Error("Cannot advance: at end");
        this.pos++;
        return tok;
    }

    private expect(type: TokenType, literal?: string): Token {
        const tok = this.peek();
        if (!tok || tok.type !== type || (literal !== undefined && tok.literal !== literal)) {
            const found = tok ? `${tok.type}('${tok.literal}')` : "end";
            const want = literal ? `${type}('${literal}')` : type;
            throw new Error(`Expected ${want} but found ${found}`);
        }
        return this.advance();
    }

    private match(type: TokenType, literal?: string): boolean {
        const tok = this.peek();
        if (!tok || tok.type === "EOF") return false;
        if (tok.type === type && (literal === undefined || tok.literal === literal)) {
            this.advance();
            return true;
        }
        return false;
    }

    public parse(): ProgramAST {
        this.pos = 0;
        const program: ProgramAST = { type: "Program", body: [] };
        while (!this.isAtEnd()) {
            const t = this.peek()!;
            if (t.type === "EOL" || (t.type === "Delimiter" && t.literal === ";")) {
                this.advance();
                continue;
            }
            const visitor = this.table[t.type];
            const stmt = visitor ? visitor() : null;
            if (stmt) program.body.push(stmt);
            else this.advance();
        }
        return program;
    }

    private visitKeyword(): Expression | null {
        const t = this.peek()!;
        if (t.literal === "use") return this.visitUseDeclaration();
        if (t.literal === "fn") return this.visitFunctionDeclaration();
        if (t.literal === "extern") return this.visitExternalFunctionDeclaration();
        if (t.literal === "return") return this.parseReturnExpression();

        return null;
    }

    private visitUseDeclaration(): UseDeclarationAST {
        this.expect("Keyword", "use");
        const name = this.expect("String");
        const ast: UseDeclarationAST = { type: "UseDeclaration", name: name.literal };
        if (this.match("Keyword", "as")) {
            const a = this.expect("String");
            ast.alias = a.literal;
        }
        return ast;
    }

    private visitFunctionDeclaration(): FnDeclarationAST {
        this.expect("Keyword", "fn");
        const name = this.expect("Identifier");
        const fn: FnDeclarationAST = {
            type: "FnDeclaration",
            name: name.literal,
            params: [],
            returnType: "void",
            body: []
        };
        this.expect("Delimiter", "(");
        while (!this.match("Delimiter", ")")) {
            const pn = this.expect("Identifier");
            this.expect("Delimiter", ":");
            const pt = this.expect("Identifier");
            const isArray = this.match("Delimiter", "[") && this.match("Delimiter", "]");
            fn.params.push({
                type: "FnParam",
                name: pn.literal,
                typeAnnotation: pt.literal,
                isArray
            });
            if (this.match("Delimiter", ",")) continue;
        }
        if (this.match("Operator", "->")) {
            const rt = this.expect("Identifier");
            fn.returnType = rt.literal;
        }
        this.expect("Delimiter", "{");
        while (!this.match("Delimiter", "}")) {
            const cur = this.peek();
            if (!cur) break;
            if (cur.type === "EOL" || (cur.type === "Delimiter" && cur.literal === ";")) {
                this.advance();
                continue;
            }
            const visitor = this.table[cur.type];
            const stmt = visitor ? visitor() : null;
            if (stmt) fn.body.push(stmt);
            else this.advance();
        }
        return fn;
    }

    private visitExternalFunctionDeclaration(): ExternalFnDeclarationAST {
        this.expect("Keyword", "extern");
        this.expect("Keyword", "fn");

        // same as above but without body
        const name = this.expect("Identifier");
        const fn: ExternalFnDeclarationAST = {
            type: "ExternalFnDeclaration",
            name: name.literal,
            params: [],
            returnType: "void"
        };

        this.expect("Delimiter", "(");
        while (!this.match("Delimiter", ")")) {
            const pn = this.expect("Identifier");
            this.expect("Delimiter", ":");
            const pt = this.expect("Identifier");
            const isArray = this.match("Delimiter", "[") && this.match("Delimiter", "]");
            fn.params.push({
                type: "FnParam",
                name: pn.literal,
                typeAnnotation: pt.literal,
                isArray
            });
            if (this.match("Delimiter", ",")) continue;
        }

        if (this.match("Operator", "->")) {
            const rt = this.expect("Identifier");
            fn.returnType = rt.literal;
        }

        this.expect("Delimiter", ";");
        return fn;
    }

    private parseReturnExpression(): ReturnExpressionAST {
        this.expect("Keyword", "return");
        const next = this.peek();
        if (!next || next.type === "EOL" || (next.type === "Delimiter" && (next.literal === ";" || next.literal === "}"))) {
            return { type: "ReturnExpression", argument: null };
        }
        const arg = this.parseExpression();
        return { type: "ReturnExpression", argument: arg! };
    }

    private parseExpression(precedence = 0): Expression | null {
    let left: Expression | null;
		const t = this.peek();
		if (t?.type === "Operator" && (t.literal === "-" || t.literal === "+")) {
			this.advance();
			const argument = this.parseExpression(PRECEDENCE[t.literal]);
			left = {
				type: "UnaryExpression",
				operator: t.literal,
				argument: argument!
			} as UnaryExpressionAST;
		} else {
			left = this.parsePrimary();
		}

		while (true) {
			const next = this.peek();
			if (!next) break;
			const prec = this.getPrecedence(next);
			if (prec <= precedence) break;
			if (next.type === "Operator") {
				this.advance();
				left = this.parseInfixExpression(left!, next.literal, prec);
			} else if (next.type === "Delimiter" && next.literal === ".") {
				this.advance();
				const prop = this.expect("Identifier");
				left = {
					type: "MemberAccess",
					object: left!,
					property: prop.literal
				} as MemberAccessAST;
			} else if (next.type === "Delimiter" && next.literal === "(") {
				this.advance();
				left = this.parseCallExpression(left!);
			} else {
				break;
			}
		}

		return left;
	}

    private parsePrimary(): Expression | null {
        const t = this.peek();
        if (!t) return null;
        if (t.type === "Identifier") {
            const id = this.advance();
            return { type: "Identifier", value: id.literal } as IdentifierAST;
        }

        if (t.type === "String" || t.type === "Number") {
            const lit = this.advance();
            const val = t.type === "Number" ? parseFloat(lit.literal) : lit.literal;
            return { type: "Literal", value: val } as LiteralAST;
        }

        if (t.type === "TemplateLiteral") {
            const lit = this.advance();
            const raw = lit.literal;     // eg "5 + 3 = {5+3}"
            const parts: (string|Expression)[] = [];
            const regex = /\{([^}]+)\}/g;
            let lastIndex = 0, match: RegExpExecArray|null;

            while ((match = regex.exec(raw)) !== null) {
                if (match.index > lastIndex) {
                    parts.push(raw.substring(lastIndex, match.index));
                }

                const exprStr = match[1];
                const exprTokens = new Lexer(exprStr).lex();
                const expr = new Parser(exprTokens).parseExpression();
                parts.push(expr!);
                lastIndex = match.index + match[0].length;
            }

            if (lastIndex < raw.length) {
                parts.push(raw.substring(lastIndex));
            }

            console.log(parts)
            return { type: "TemplateLiteral", parts } as TemplateLiteralAST;
        }

        if (t.type === "Delimiter" && t.literal === "(") {
            this.advance();
            const expr = this.parseExpression();
            this.expect("Delimiter", ")");
            return expr;
        }

        this.advance();

        return null;
    }

    private parseInfixExpression(left: Expression, operator: string, prec: number): Expression {
        const right = this.parseExpression(prec);
        return {
            type: "BinaryExpression",
            operator,
            left,
            right: right!
        } as BinaryExpressionAST;
    }

    private parseCallExpression(callee: Expression): FnCallAST {
        const args: Expression[] = [];
        while (!this.match("Delimiter", ")")) {
            const e = this.parseExpression();
            if (e) args.push(e);
            if (this.match("Delimiter", ",")) continue;
        }
        return { type: "FnCall", callee, args } as FnCallAST;
    }

    private getPrecedence(tok: Token): number {
        if (tok.type === "Operator") return PRECEDENCE[tok.literal] || 0;
        if (tok.type === "Delimiter" && (tok.literal === "." || tok.literal === "(")) {
            return PRECEDENCE[tok.literal];
        }
        return 0;
    }
}