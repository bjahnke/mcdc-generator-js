export class TokenType {
  static SYMBOL = 0
  static LPAREN = 1
  static RPAREN = 2
  static AND = 3
  static OR = 4
  static NOT = 5
}

export const op = {
  and_: (a, b) => a && b,
  or_: (a, b) => a || b,
  not_: a => !a,
  ne: (a, b) => a !== b,
  eq: (a, b) => a === b
}
