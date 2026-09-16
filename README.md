# Gren on Node.js

This package allows you to create Gren programs that run on the Node.js runtime.

**I highly recommend working through the [guide](https://gren-lang.org/book/) to learn how to use Gren.**

## Creating a node application

In addition to [installing gren](https://gren-lang.org/install), you'll need the current [node LTS](https://nodejs.org/en) release.

Initialize a gren application that targets node:

```
gren init --platform=node
```

Create a `src/Main.gren` file:

```elm
module Main exposing (main)

import Console
import Task exposing (Task)

main : Task Never {}
main =
    Console.write "Hello, World!\n"
```

compile and run with

```
gren make src/Main.gren
node app
```

See the [cat example](https://github.com/gren-lang/example-projects/tree/main/cat) for a more complex example.

## Applications, sub-systems and permissions

This package is based around the idea of sub-systems. A sub-system provides access to functionality which interact with the outside world, like reading files or communicating with the terminal.

A sub-system must be initialized before it is used, and only the application may initialize one. The result of initializing a sub-system is a permission value which needs to be passed in to the functions that the sub-system provides.

Below is an example of initializing the `FileSystem` sub-system and using the permission it answers:

```gren
main : Task Never {}
main =
    FileSystem.initialize
        |> Task.andThen
            (\fsPermission ->
                FileSystem.readFile fsPermission (Path.fromPosixString "notes.txt")
                    |> Task.andThen (\bytes -> Console.write (Bytes.toString bytes |> Maybe.withDefault ""))
                    |> Task.onError (\error -> Console.writeErr (FileSystem.errorToString error ++ "\n"))
            )
```

Keep in mind that passing permissions to third-party code enables them to access these systems. Only give permissions to code you trust!
