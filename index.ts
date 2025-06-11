// import { writeFileSync } from "fs";
import { LLVMGen } from "./src/gen/llvm";
import { Lexer } from "./src/lexer/lexer";
import { Parser } from "./src/parser/parser";
import { ImportResolver } from "./src/resolver/resolver";

    try {
    // const l = new Lexer(`
    //     fn main() -> void {
    //         io.println("skibidi");
    //         io.println(math.abs(-4.5));
    //     }
    // `)
    // const body = `
    //     use "std/io";
    //     use "std/math" as "m";

    //     fn main(args: string[]) -> void {
    //         io.println(" Hello, World! ".trim());
    //         io.println(m.abs(-4.5));

    //         io.file.write("output.txt", "Hello, World!");
    //     }

    //     fn add(a: number, b: number) -> number {
    //         return a + b;
    //     }
    // `

    const body = `
        use "std/io";
        fn main(args: string[]) -> int {
            io.println("Hello, World!");
        }
    `

    const l = new Lexer(body)

    const t = l.lex()
    const p = new Parser(t)
    const projectAST = p.parse()

    const resolver = new ImportResolver("src/gen/std", "src");
    const ast = resolver.mergeWithProjectAST(projectAST);

    //console.log(JSON.stringify(ast, null, 2));

    const g = new LLVMGen("test_mod", ast);
    const module = g.generate()
    console.log(module);    

    //console.log(JSON.stringify(ast, null, 2));

    // writeFileSync("out.ll", module);

    // const llc = Bun.spawnSync(["llc", "out.ll", "-o", "out.s"]);
    // if (llc.exitCode !== 0) {
    //     console.error("LLC compilation failed:", new TextDecoder().decode(llc.stderr));
    //     process.exit(1);
    // }

    // const ggc = Bun.spawnSync(["gcc", "out.s", "-o", "out", "-lm"]);
    // if (ggc.exitCode !== 0) {
    //     console.error("GCC compilation failed:", new TextDecoder().decode(ggc.stderr));
    //     process.exit(1);
    // }

    // const exe = Bun.spawnSync(["./out"]);
    // console.log("Exit code:", exe.exitCode);
    // console.log("Output:\n");
    // process.stdout.write(new TextDecoder().decode(exe.stdout));
} catch (e) {
    console.error(e);
}