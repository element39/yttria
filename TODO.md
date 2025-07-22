# todo

## lexer
- [x] number literals
- [x] string literals
- [x] boolean literals
- [x] null literals
- [x] identifiers
- [x] keywords
- [x] operators
- [x] delimiters
- [x] comments
- [ ] error handling (unknown tokens)

## parser
- [x] number literals
- [x] string literals
- [x] boolean literals
- [x] null literals
- [x] identifiers
- [x] functions
- [x] function calls
- [x] blocks
- [x] return expressions
- [x] if statements
- [x] else statements
- [x] binary expressions
- [x] unary expressions
- [x] variables
- [x] comments
- [x] switch statements
- [x] while statements
- [x] member access (dot operator)
- [ ] error handling (syntax errors)

## typechecker
- [x] variables
  - [x] infer type from usage
  - [x] annotation validation
- [x] functions
  - [x] infer return type from usage
  - [x] type consistency
  - [ ] parameter type validation
- [x] function call type validation
- [x] if statements
- [x] expressions
- [x] binary expressions
- [x] unary expressions
- [x] literals
- [x] identifiers
- [ ] member access

## code generator (llvm-bindings)
- [x] functions
- [x] returns
- [x] number literals
- [x] if statements
- [x] switch statements
- [x] while statements
- [x] variables
- [x] binary expressions
- [x] unary expressions
- [ ] string comparison (for switch/case)
- [ ] error handling (invalid IR)
- [ ] advanced features (structs, arrays, etc.)