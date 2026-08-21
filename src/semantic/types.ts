export type TypeKind =
    | "int"
    | "float"
    | "bool"

export type TypeValue = {
    kind: TypeKind
}

export type IntType = TypeValue & {
    kind: "int"
    size: 8 | 16 | 32 | 64
}

export type FloatType = TypeValue & {
    kind: "float"
}

export type BoolType = TypeValue & {
    kind: "bool"
}

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