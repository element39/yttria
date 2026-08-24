export type AnyType = {
    kind: "any"
}

export type IntType = {
    kind: "int"
    size?: 8 | 16 | 32 | 64
}

export type FloatType = {
    kind: "float"
}

export type BoolType = {
    kind: "bool"
}

export type StringType = {
    kind: "string"
}

export type TypeValue =
    | IntType
    | FloatType
    | BoolType
    | StringType
    | AnyType

export type TypeHolder = {
    id: number
    type?: TypeValue
}

let holderId = 0
export const createTypeHolder = (): TypeHolder => {
    return {
        id: holderId++,
    }
}