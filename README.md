<div align="center">
  <img src="./assets/header.png" width="100%">
</div>

---

> ` a blazingly fast, statically-typed expressive language for building anything from scripts to systems. `

---

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