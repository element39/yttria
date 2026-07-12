import { Lexer } from "../src/lexer"
import { Parser } from "../src/parser"
import { join } from "node:path"
import { readdir, readFile } from "node:fs/promises"
import { expect, test } from "bun:test"

const TEST_FILES_DIR = "testfiles"

const testFiles = await readdir(TEST_FILES_DIR)

for (const testFile of testFiles) {
  test(`tokens and AST for: ${testFile}`, async () => {
    const testFilePath = join(TEST_FILES_DIR, testFile)
    const mod = await readFile(testFilePath, "utf8")

    const tokens = new Lexer(mod).lex()
    const ast = new Parser(tokens).parse()

    expect({
      tokens: tokens,
      ast: ast
    }).toMatchSnapshot()
  })
}
