const op = require('operator');
const re = require('re');

/**
 * Verifies tokens of conditional expression strings for DataGenerator
 */


class TokenType {
  static SYMBOL = 0;
  static LPAREN = 1;
  static RPAREN = 2;
  static AND = 3;
  static OR = 4;
  static NOT = 5;
}

function get_type(token) {
  const t = TokenType;
  const type_dict = {
    '(': t.LPAREN,
    ')': t.RPAREN,
    '&': t.AND,
    '|': t.OR,
    '!': t.NOT
  };
  let tok_type = type_dict[token];
  if (tok_type === undefined && /[A-Z]+/.test(token)) {
    tok_type = t.SYMBOL;
  }
  return tok_type;
}

class Token extends String {
  constructor(value) {
    super(value);
    this.type = get_type(value);
    const op_dict = {
      '&': op.and_,
      '|': op.or_,
      '!': op.not_
    };
    this.value = op_dict[value] || value;
  }
}

class Lexer {
  /**
   * Performs simple lexical analysis on the input string.
   * Produces a token list and a list of unique variable symbols
   */
  constructor(t_string) {
    this.test_string = t_string.toUpperCase();
    this.raw_token_list = split_string_expr(this.test_string);
    [this.tokens, this.symbols] = build_symbol_list(this.raw_token_list);
  }

  // TODO no longer used
  static _build_symbol_list(t_list) {
    /**
     * Find and return of unique variable symbols in the testString
     */
    const symbol_list = [];
    const token_list = [];
    let idx = 0;
    while (idx < t_list.length) {
      let token = t_list[idx];
      let symbol_str = "";
      if (typeof token === 'string' && token !== ')' && token !== '(') {
        const alpha_reg = /[A-Z]/;

        while (alpha_reg.test(token) && idx < t_list.length) {
          symbol_str += token;
          if (symbol_str.length > 2) {
            throw new Error(`Symbol name must not exceed 2 characters ${symbol_str}`);
          }
          idx += 1;
          try {
            token = t_list[idx];
            if (typeof token !== 'string' || token === ')' || token === '(') {
              idx -= 1;
              break;
            }
          } catch (error) {
            // pass
          }
        }

        if (symbol_str !== "") {
          token = symbol_str;
        }

        if (!symbol_list.includes(token)) {
          symbol_list.push(token);
        }
      }
      token_list.push(token);
      idx += 1;
    }
    return [token_list, symbol_list];
  }

  // TODO no longer used
  static _validate_test_string(test_string) {
    /**
     * Checks test string for illegal tokens
     * raises exception if illegal tokens found
     */
    const match_list = test_string.match(/[^A-Z()&|! ]/g);
    if (match_list && match_list.length > 0) {
      const str_match = match_list.join(", ");
      throw new Error(`Illegal Characters in string: ${str_match}`);
    }
  }

  static _replace_op_chars_with_funcs(token_list) {
    /**
     * Scans through token list. Replacing operator characters with operator functions
     */
    const op_dict = {
      '&': op.and_,
      '|': op.or_,
      '!': op.not_
    };
    for (let i = 0; i < token_list.length; i++) {
      const token = token_list[i];
      const op_func = op_dict[token];
      if (op_func !== undefined) {
        token_list[i] = op_func;
      }
    }
    return token_list;
  }
}

function split_string_expr(str_expr) {
  /**
   * add spaces between parenthesis and other tokens than split by whitespace into list
   * @param {string} str_expr - conditional expression string to be lexed
   * @return {string[]} - list of raw string tokens
   */
  let spaced_str_expr = str_expr.replace("(", " ( ");
  spaced_str_expr = spaced_str_expr.replace(")", " ) ");
  spaced_str_expr = spaced_str_expr.replace("!", " ! ");
  spaced_str_expr = spaced_str_expr.trim();
  return spaced_str_expr.split(" ");
}

function build_symbol_list(raw_token_list) {
  /**
   * @param {string[]} raw_token_list - string char list
   * @return {Token[]} - list of Token objects
   */
  const t = TokenType;
  const bad_tokens = [];
  const processed_tokens = [];
  const symbols = [];
  for (let i = 0; i < raw_token_list.length; i++) {
    const raw_token = raw_token_list[i];
    const new_token = new Token(raw_token);

    if (new_token.type === null) {
      // find all bad tokens before raising exception
      bad_tokens.push([raw_token, i]);
    } else if (new_token.type === t.SYMBOL && !symbols.includes(new_token)) {
      // char limit for symbols is necessary for now. Although
      // may never change because >64 symbols is unlikely
      if (new_token.length <= 2) {
        symbols.push(new_token);
      } else {
        bad_tokens.push(new_token);
      }
    }
    processed_tokens.push(new_token);
  }

  if (bad_tokens.length > 0) {
    throw new Error(`Illegal Tokens Found: ${bad_tokens}`);
  }

  return [processed_tokens, symbols];
}
