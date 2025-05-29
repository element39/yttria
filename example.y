[|  
    yttria
    a blazingly fast*, universal* and easy-to-use* programming language
    for anything you can imagine*
    * = not true (yet)
|]

use std/io;

fn main() -> void {
    const a := 1
    const b: int = 2

    io.print(`sum: {a + b}`)

    try io.write("file.txt", "Hello, World!")
    catch (e) io.print(`Error writing to file: {e}`)
    finally io.print("Attempted to write to file.")

    io.print("File written successfully.")
}