<div align="center">
  <img src="../assets/header.png" width="100%">
</div>

---

> [!NOTE]
> ### advanced features like macros and pattern matching are completely optional in yttria.
> #### You can write powerful and expressive programs without them. they are there if you want extra flexibility or metaprogramming, but you don’t need them to be productive.

---

## syntax

yttria's syntax is designed to be expressive, concise, and easy to read. It draws inspiration from languages like Typescript, Go, Rust and Zig, while also introducing unique features to enhance developer experience.

### comments
```
// single-line comment
# also a single-line comment

/* comment
   that spans multiple lines */

[| multi-line comment
   that spans multiple lines
   (usually used for docs/metadata) |]
```

### types
yttria is a statically-typed language, meaning types are checked at compile time. Types can be inferred or explicitly declared, it is recommended to let the compiler infer types where possible, unlike languages like C or Rust, yttria does not require explicit type annotations for every variable or function.

```ts
// basic types
int // 32-bit signed integer, hard alias to i32
i1 // 1-bit signed integer
i8 // 8-bit signed integer
i16 // 16-bit signed integer
i32 // 32-bit signed integer
i64 // 64-bit signed integer

float // 64-bit floating point number

bool // boolean, hard alias to i1

string // utf8 string constant
String // mutable heap string (hard alias to i8[])
char // single utf8 character

null // null value (yttria is an expressive language, so null is still a value)

// composite types
...
```

### type aliases
Type aliases can be used to simplify complex types or to create more meaningful names for existing types.

```rs
type UserID = int
type User = {
    id: UserID,
    name: string,
    email:
    string
}
```

### variables
yttria supports both mutable and immutable variables. Variables can be declared using `let` for mutable variables or `const` for immutable variables.

```ts
let w := 10 // mutable variable with type inference
const x := 20.5 // immutable variable with type inference

let y: int = 30 // mutable variable with explicit type
const z: float = 40.5 // immutable variable with explicit type
```


### template strings
yttria supports template strings for easy string interpolation, similar to JavaScript's template literals. Template strings can span multiple lines and can include expressions within `{}`.

```rs
let name := "World"
let greeting := `Hello, {name}!` // Hello, World!
```

### destructuring
yttria supports destructuring for arrays, objects, and tuples, just like Javascript.

```rs
let [x, y, z] := [1, 2, 3] // 1, 2, 3
let {name, age} := {name: "Alice", age: 30} // "Alice", 30
let (a, b) := (10, 20) // 10, 20
```

#### destructuring with defaults
yttria allows destructuring with default values, making it easy to handle missing properties or values.

```rs
let {name, age = 18} := {name: "Bob"} // "Bob 18"
```
#### destructuring with rest
yttria supports destructuring with rest parameters, allowing you to capture remaining values in an array or object.

```rs
let [first, ...rest] := [1, 2, 3, 4, 5] // "1 [2, 3, 4, 5]"
let {name, ...details} := {name: "Charlie", age: 25, city: "New York"} // "Charlie {age: 25, city: 'New York'}"
```

### functions
yttria functions are first-class citizens, meaning they can be passed around like any other value. Functions can be defined using the `fn` keyword, and can have optional return types. the `return` keyword is also optional for single-expression functions, similar to functions with brackets in JavaScript. (`fn () => (...)`)
```ts
fn add(a: int, b: int) -> int {
    return a + b
}

fn greet(name: string) {
    print("Hello, " + name)
}

fn factorial(n: int) -> int {
    if (n <= 1) {
        return 1
    }
    return n * factorial(n - 1)
}
```

### control flow
yttria supports standard control flow constructs like `if`, `else`, `for`, and `while`. It also has a unique `switch` statement for pattern matching, like Javascript's `switch` but more powerful, and without the constant `break` statements.

```rs
if (a < b) {
    io.println("a is less than b")
} else if (a > b) {
    io.println("a is greater than b")
} else {
    io.println("a is equal to b")
}

for (let i := 0 .. 5) {
    io.println(i) // 0, 1, 2, 3, 4 (exclusive)
}

for (let i := 0 ... 5) {
    io.println(i) // 0, 1, 2, 3, 4, 5 (inclusive)
}

while (x < 10) {
    x += 1
}

switch (c) {
    1, 2 -> {
        io.println("c is 1 or 2")
    }
    3 -> {
        io.println("c is 3")
    }
    default -> {
        io.println("c is something else")
    }
}
```

### error handling
yttria uses a unique error handling mechanism similar to JavaScript's `try/catch` but with a more concise syntax. Errors can be caught and handled using the `try`, `catch`, and `finally` keywords. The `catch` block can also be used to handle specific error types, similar to Rust's error handling without the need for `Result` types.

```ts
try io.write("file.txt", "Hello, World!")
catch (e) io.println(`Error writing to file: {e}`)
finally io.println("Attempted to write to file.")

try {
    let result = riskyFunction()
} catch (e) {
    io.println(`Error: {e}`)
} finally {
    io.println("Cleanup code here.")
}
```

### pattern matching
yttria has powerful pattern matching capabilities, allowing for more expressive and concise code. Pattern matching can be used with enums, structs, and tuples, making it easy to destructure and work with complex data types.

```rs
let point := new Point(1.0, 2.0)

switch (point) {
    case -> Point(x, y) as p {
        io.println(`Point at ({p.x}, {p.y})`)
    }

    case -> Point(x, y) as p if (p.x > 0 && p.y > 0) {
        io.println("Point is in the first quadrant")
    }

    default -> {
        io.println("Unknown point")
    }
}
```


### modules
yttria supports modules for organizing code. Modules can be imported using the `use` keyword, and can be aliased for convenience. Similar to Go, odules are folder based, so foo/baz.yt and foo/bar.yt are both part of the module `foo`, unlike JS's `import` syntax which is file-based.


```rs
use std/io;
use std/math as m;
use std/*; // import all items from the std supermodule (not recommended for large modules, this increases filesize by a TON and can cause name clashes
use std/time as .; // import into current module, so you can use `now()` instead of `time.now()`
use std/http as _; // import without using, bypassing the "unused import" warning without commenting it out
```

### structs
yttria supports structs for defining custom data types. Structs can have methods associated with them, most similar to Go, but more readable & compact. Structs can also have constructors, which are special methods that are called when a new instance of the struct is created, unlike Go.

```rs
// point.yt
struct Point {
    let x: float
    let y: float

    fn constructor(x: float, y: float) {
        this.x = x
        this.y = y
    }

    fn distance(self, other: Point) -> float {
        return sqrt((self.x - other.x) ** 2 + (self.y - other.y) ** 2)
    }
}

// main.yt
use point as poi;
const p := new poi.Point(1.0, 2.0)
```

### js-style objects
yttria supports objects (also known as maps, dictionaries or hash tables etc), which are collections of key-value pairs. Maps can be created using curly braces (`{}`) and can have keys of any type, but values must be of the same type. They are extremely similar to JS objects.

```rs
let user := {
    id: 1,
    name: "Alice",
    age: 30
}
```

### enums
yttria supports enums for defining a set of named values. Enums can have associated data, and can be used in pattern matching.

```rs
enum Color {
    Red,
    Green,
    Blue,
    Custom(r: int, g: int, b: int) // enum with associated data
}

fn printColor(color: Color) {
    switch (color) {
        case -> Color.Red {
            io.println("Red")
        }

        case -> Color.Green {
            io.println("Green")
        }
        
        case -> Color.Blue {
            io.println("Blue")
        }

        case -> Color.Custom(r, g, b) {
            io.println(`Custom color: {r}, {g}, {b}`)
        }
    }
}
```

### generics
yttria supports generics for defining functions and types that can work with any type. Generics are defined using angle brackets (`<` and `>`), similar to TypeScript. Generics can also be used to make chainable functions, allowing for more flexible and reusable code, unlike Go's generics which are more limited in scope.

```rs
fn printList<T>(list: List<T>) {
    for (let item in list) {
        io.println(item)
    }
}

fn map<T, U>(list: List<T>, fn: (T) -> U) -> List<U> {
    let result := List<U>()
    for (let item in list) {
        result.append(fn(item))
    }
    return result
}

fn main() {
    let numbers := [1, 2, 3, 4, 5]
    let strings := map(numbers, (n) => `Number: {n}`)
    printList(strings) // "Number: 1", "Number: 2", etc.
    printList<int>(numbers) // 1, 2, 3, 4, 5
}
```

### asynchronous/concurrent programming
yttria has first-class support, allowing for easy parallel execution of code. Asynchronous programming is achieved using the `async` and `await` keywords, similar to JavaScript. yttria also supports channels for communication between concurrent tasks. yttria's `async` keyword can also be called as a block in sync functions, similar to Go's goroutines or Javascript's IIFEs.

```rs
use std/http;
use std/io;

async fn fetchData(url: string) -> string {
    let response := await http.get(url)
    return response.body
}

async fn main() {
    let data := await fetchData("https://api.example.com/data")
    io.println(data)

    let result := await async {
        // some async code
        return "result"
    }

    io.println(result)
}
```

### macros
macros are just like functions, but they are expanded at compile time, allowing for more powerful code generation and metaprogramming capabilities. Macros can be used to create reusable code snippets, similar to Rust's macros.

```rs
macro fn greeting() {
    if (os == "windows") {
        return "Hello"
    } else if (os == "linux") {
        return "hi"
    } else {
        return "hey"
    }
}

fn main() {
    io.println(greeting!()) // This expands to io.println("Hello") or io.println("hi") at compile time!
}
```

#### advanced macros
yttria's macros can even swap out entire blocks of code using the `macro` keyword, allowing for more complex code generation and metaprogramming. Macros can also be used to create custom syntax, similar to Rust's procedural macros.

```rs
fn main() {
    let arch = ""
    
    macro {
        if sys.arch == "x86_64" {
            arch = "x86_64"
        } else if sys.arch == "arm64" {
            arch = "arm64"
        } else {
            arch = "unknown"
        } 
    }

    io.println(`Running on {arch} architecture`) // This expands to the appropriate code block at compile time!
    /* eg:
    Running on x86_64 architecture
    */
}
```

### inline assembly
yttria supports inline assembly for low-level programming, allowing developers to write performance-critical code directly in assembly language. Inline assembly can be used within functions, and is useful for tasks like system calls or hardware manipulation.

```rs
fn add(a: int, b: int) -> int {
    let result: int
    asm(`
        mov eax, {a}
        add eax, {b}
        mov {result}, eax
    `) // use template strings for inline assembly
    return result
}
```

### tuples
yttria supports tuples, which are fixed-size collections of elements that can be of different types. Tuples are useful for grouping related values together. Unlike arrays, tuples have a fixed size and can contain elements of different types, however unlike Python, tuples in yttria can have any size. They are also immutable, the `let` keyword has no effect on its mutability.
```rs
let point: (float, float) = (1.0, 2.0) // tuple with two float elements
let person := ("Steve", 30, "Engineer") // tuple with three elements of different types
let (name, age, profession) := person // destructuring a tuple
```

### arrays
yttria supports arrays, which are ordered collections of elements of the same type. Arrays can be created using square brackets (`[]`) and can be mutable or immutable.

```rs
let numbers := [1, 2, 3, 4, 5]
const names: string[] = ["Alice", "Bob", "Charlie"]
let mixed: string[] | int[] = [1, "Hello", 3.14]
```

### iterators
yttria supports iterators, which allow you to iterate over collections like arrays, maps, and sets. Iterators can be created using the `for` keyword and can be used with any iterable collection.

```rs
let numbers := [1, 2, 3, 4, 5]
for (let number in numbers) {
    io.println(number) // 1, 2, 3, 4, 5
}
```

### ffi
yttria supports Foreign Function Interface (FFI), which allows you to leverage existing libraries written in other languages like C or Rust. This is useful for performance-critical code or when you want to use existing libraries without rewriting them in yttria. Here is an example with raylib

```rs
// raylib_bindings.yt
use ffi/raylib; // raylib.dll / libraylib.so (depending on your OS) in root directory

struct Color {
    let r: u8
    let g: u8
    let b: u8
    let a: u8
}

foreign fn InitWindow(width: int, height: int, title: string) -> void
foreign fn WindowShouldClose() -> bool
foreign fn CloseWindow() -> void
foreign fn BeginDrawing() -> void
foreign fn EndDrawing() -> void
foreign fn ClearBackground(color: Color) -> void
foreign fn DrawText(text: string, posX: int, posY: int, fontSize: int, color: Color) -> void

// main.yt
use path/to/raylib_bindings as r

fn main() {
    r.InitWindow(800, 600, "Hello Raylib")
    
    while (!r.WindowShouldClose()) {
        r.BeginDrawing()
        r.ClearBackground(r.Color { r: 0, g: 0, b: 0, a: 255 })
        r.DrawText("Hello, Raylib!", 10, 10, 20, r.Color { r: 255, g: 255, b: 255, a: 255 })
        r.EndDrawing()
    }
    
    r.CloseWindow()
}
```

### link-time libraries
yttria supports external functions, which are functions that are provided at link-time, unlike FFI, which natively links to libraries at compile time. External functions can be used to call functions from other yttria modules or from external libraries.

```rs
extern fn printf(fmt: string, ...) -> int // from C standard library
extern fn writeln(msg: string) -> void // from D standard library
```