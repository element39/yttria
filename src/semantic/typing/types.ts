export type TypeKind =
    | "int"
    | "float"

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

export type TypeSlot = {
    id: number
    type?: TypeValue
    links: TypeSlot[]
}

let slotId = 0
export const createEmptySlot = (): TypeSlot => {
    return {
        id: slotId++,
        links: []
    }
}