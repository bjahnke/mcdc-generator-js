import { filter } from 'lodash'
import { TokenType, op } from './token-type.js'

/**
 * Verifies tokens of conditional expression strings for DataGenerator
 */

const symbolRegex = /[a-zA-Z]+/

function get_type (token) {
  const t = TokenType
  const type_dict = {
    '(': t.LPAREN,
    ')': t.RPAREN,
    '&': t.AND,
    '|': t.OR,
    '!': t.NOT
  }
  let tok_type = type_dict[token]
  if (tok_type === undefined && symbolRegex.test(token)) {
    tok_type = t.SYMBOL
  }
  return tok_type
}

class Token extends String {
  constructor (value) {
    super(value)
    this.type = get_type(value)
    const op_dict = {
      '&': op.and_,
      '|': op.or_,
      '!': op.not_
    }
    this.value = op_dict[value] || value
  }
}

export class Lexer {
  /**
   * Performs simple lexical analysis on the input string.
   * Produces a token list and a list of unique variable symbols
   */
  constructor (t_string) {
    this.test_string = t_string
    this.raw_token_list = split_string_expr(this.test_string);
    [this.tokens, this.symbols] = build_symbol_list(this.raw_token_list)
  }
}

function split_string_expr (str_expr) {
  /**
   * add spaces between parenthesis and other tokens than split by whitespace into list
   * @param {string} str_expr - conditional expression string to be lexed
   * @return {string[]} - list of raw string tokens
   */
  const symbol = new RegExp(`(${symbolRegex.source})`)
  const op = /(?:\s*)([&|()])(?:\s*)/
  str_expr = str_expr.trim().split(new RegExp(`${symbol.source}|${op.source}`)).filter(Boolean)
  console.log(str_expr)
  return str_expr
}

function build_symbol_list (raw_token_list) {
  /**
   * @param {string[]} raw_token_list - string char list
   * @return {Token[]} - list of Token objects
   */
  const t = TokenType
  const bad_tokens = []
  const processed_tokens = []
  const symbols = []
  for (let i = 0; i < raw_token_list.length; i++) {
    const raw_token = raw_token_list[i]
    const new_token = new Token(raw_token)

    if (new_token.type === undefined) {
      // find all bad tokens before raising exception
      bad_tokens.push([raw_token, i])
    } else if (new_token.type === t.SYMBOL && !symbols.includes(new_token)) {
      symbols.push(new_token)
    }
    processed_tokens.push(new_token)
  }

  if (bad_tokens.length > 0) {
    throw new Error(`Illegal Tokens Found: [${bad_tokens.map((token) => `'${token[0]}' at idx ${token[1]}`).join(', ')}]`)
  }

  return [processed_tokens, symbols]
}
