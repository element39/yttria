export type TypeKind =
  | "int"
  | "float"
  | "bool"
  | "string"

export type Type = {
  kind: TypeKind
}

export type IntType = Type & {
  kind: "int"
}

export type FloatType = Type & {
  kind: "float"
}

export type BoolType = Type & {
  kind: "bool"
}

export type StringType = Type & {
  kind: "string"
  value: string
}

export const sameType = (a?: Type, b?: Type): boolean => {
  if (!a || !b) return false;

  if (a.kind !== b.kind) return false;
  return true;
}

export const similarType = (a?: Type, b?: Type): boolean => {
  if (!a || !b) return false;
  
  const groups: TypeKind[][] = [
    ["int", "float"],
  ];

  for (const group of groups) {
    if (group.includes(a.kind) && group.includes(b.kind)) {
      return true;
    }
  }
  
  return sameType(a, b);
}
