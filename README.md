<div align="center">
  <img src="./assets/header.png" width="100%">
</div>

---

> ` a blazingly fast, statically-typed expressive language for building anything from scripts to systems. `

---

> [!CAUTION] 
> ### yttria is still in early development and is **EXTREMELY** experimental. expect breaking changes and limited documentation, some stuff may not even exist yet.

<div style="display: flex; align-items: flex-start; gap: 2em;">

  <div style="flex: 1; height: 100%;">
  
  ```rust
  // fib.yt
  fn fib(n: int) -> int {
      if (n <= 1) {
          return n
      }
      
      return fib(n - 1) + fib(n - 2)
  }
  ```
  
  </div>

  <div style="flex: 2;">
  
  ## key goals

  **high performance**: designed for speed, with performance rivaling Rust & C  
  **expressiveness**: write concise, clean & clear code for everything from web development to systems programming  
  **safety & ergonomics**: statically-typed with encouraged type inference & robust error handling  
  **write once, run anywhere**: build reliable software for any platform (or none at all) with a friendly std library

  </div>

</div>

## why yttria?

yttria is designed to be a **fast, expressive language** that lets you build anything from scripts to systems.  
It combines the **performance of C** with the **expressiveness of Typescript**, making it ideal for both beginners and experienced developers.
Whether you're building web apps, games, or low-level systems, yttria has you covered.

## syntax guide

the yttria syntax is designed to be **familiar and intuitive**, especially for those with experience in languages like Go/C, Typescript or Rust. view it [here](./docs/SYNTAX.md).

## getting started
to get started with yttria, you can use the cli tool.

```bash
# install the yttria cli tool
...
# create a new yttria project
yt init
# run your yttria program
yt run .
# build your yttria program
yt build .
```

## features
yttria includes a wide range of features to help you build robust applications:
- **statically typed** with type inference
- **powerful pattern matching** for concise data handling
- **macros** for metaprogramming and code generation
- **async/await** for easy concurrency
- **first-class functions** and **closures** (functions inside functions) for functional programming
- **extensive standard library** for common tasks
- **robust error handling** with `try/catch` and `Result` types
- **cross-platform support** for building applications on any platform
- and much more!

## community
you can find us on:
- [github](https://github.com/grngxd/yttria)
...