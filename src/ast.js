import { op, TokenType as tT } from './token-type.js'
import { Node } from './node.js'

class Stack {
  /**
   * For making the process of getting, popping, and appending to a list which
   * we'd like to treat as a stack.
   *
   * Note: This object will get/pop relative to the given stack pointer
   * (index 0 or len(list)-1). However, there are not yet functions for appending relative
   * to stack pointer because, so far, we only have to use append().
   */

  constructor (a_list = [], stack_pointer_zero = false) {
    this.stack = [...a_list]
    this.STACK = [...this.stack]
    this.stack_pointer_zero = stack_pointer_zero
  }

  pop_top_of_stack () {
    return this.stack.splice(this.stack_pointer_zero ? 0 : this.stack.length - 1, 1)[0]
  }

  get_top_of_stack () {
    return this.stack[this.stack_pointer_zero ? 0 : this.stack.length - 1]
  }

  // Not sure yet if this technique is good practice
  static _hof_get_top_of_stack (a_list, stack_pointer_zero, apply_func = null) {
    apply_func = apply_func || ((x) => a_list[x])

    function try_stack_operation (index) {
      function result_func () {
        return apply_func(index)
      }

      return result_func
    }

    return stack_pointer_zero
      ? try_stack_operation(0)
      : try_stack_operation(a_list.length - 1)
  }

  pop_from (idx) {
    try {
      return this.stack.splice(idx, 1)[0]
    } catch (error) {
      return null
    }
  }

  is_empty () {
    return this.stack.length === 0
  }

  add_to_bottom (value) {
    /**
     * add value to bottom of stack,
     * ignores stack pointer 0
     */
    this.stack.unshift(value)
  }

  append (val) {
    this.stack.push(val)
  }
}

export class Parser {
  /**
   * Note: Dijkstra's shunting-yard algorithm is used to parse
   * Takes a list of tokens and symbol list,
   * parses the string and generates and abstract syntax tree
   */
  constructor (token_list, symbol_list) {
    this.symbol_list = symbol_list
    this._tokens = new Stack(token_list, true)
    this._operators = new Stack()
    this._nodes = new Stack()
    this.all_nodes = []
    this.leaf_nodes = []
    this.parse_expr()
    this.ast_root = this._nodes.stack[0]
  }

  parse_expr () {
    const transition_dict = {
      var: {
        [tT.LPAREN]: { func: this.token_to_ops.bind(this), 'next state': 'var' },
        [tT.NOT]: { func: this.token_to_ops.bind(this), 'next state': 'var' },
        [tT.SYMBOL]: { func: this.symbol_to_node.bind(this), 'next state': 'op' }
      },
      op: {
        [tT.AND]: { func: this.process_ops.bind(this), 'next state': 'var' },
        [tT.OR]: { func: this.process_ops.bind(this), 'next state': 'var' },
        [tT.RPAREN]: { func: this.rparen_process.bind(this), 'next state': 'op' }
      }
    }

    let current_state = transition_dict.var
    let current_token = this._tokens.get_top_of_stack()
    let token_count = 0
    while (current_token !== undefined) {
      const state_info = current_state[current_token.type]
      if (!state_info) {
        throw new Error(
          `AST Parse Error at Token ${token_count + 1}: ${current_token}`
        )
      }
      state_info.func()
      current_state = transition_dict[state_info['next state']]
      current_token = this._tokens.get_top_of_stack()
      token_count += 1
    }

    if (token_count === 0) {
      throw new Error('Parse Error: Token count 0, no expression given.')
    }

    this.process_op_remainder()
  }

  token_to_ops () {
    this._operators.append(this._tokens.pop_top_of_stack())
  }

  symbol_to_node () {
    const symbol_index = this.symbol_list.indexOf(
      this._tokens.pop_top_of_stack()
    )
    const new_leaf_node = new Node(symbol_index)
    this.add_node(new_leaf_node)
    this.leaf_nodes.push(new_leaf_node)
  }

  rparen_process () {
    this._tokens.pop_top_of_stack()
    this.process_paren()
  }

  process_ops () {
    /**
     * Pop all operators off the operator stack that have a lesser
     * "priority" than the operator that is the current token.
     * Each operator popped becomes a new node with the top 2
     * nodes on the node stack becoming its children.
     *
     * current_token: an operator at the top of the token stack
     */
    const current_token = this._tokens.get_top_of_stack()

    while (true) {
      const current_op = this._operators.get_top_of_stack()

      if (current_op === undefined) {
        break
      }
      if (current_op.value === '(') {
        break
      }
      if (
        this.op_priority(current_op.value) <=
        this.op_priority(current_token.value)
      ) {
        break
      }

      const popped_op = this._operators.pop_top_of_stack()
      this.add_op_node(popped_op)
    }

    this._operators.append(this._tokens.pop_top_of_stack())
  }

  process_paren () {
    /**
     * Run when a right parenthesis is the current token (during op_expr phase)
     * This indicates that a matching left parenthesis was processed earlier.
     * Pop all operators from the operator stack and add them as nodes using
     * add_op_node() until we find a left paren.
     */
    while (true) {
      const current_op = this._operators.pop_top_of_stack()
      // False means the operator list is empty, which means we never found a matching left paren
      if (current_op === undefined) {
        throw new Error('Extra right parenthesis in the expression')
      }
      // (!) operator should not be in the operator stack
      if (current_op.value === op.not_) {
        throw new Error('Improper use of (!) operator in expression')
      }
      // stop process when we find a left paren
      if (current_op.value === '(') {
        break
      }

      this.add_op_node(current_op)
    }

    // pop the node containing the contents within the parentheses that we just created
    const paren_expr_node = this._nodes.pop_top_of_stack()
    // re add the node so the program can check for any negations to apply to it
    this.add_node(paren_expr_node)
  }

  process_op_remainder () {
    /**
     * Create op_nodes until the remainder of the operators stack is empty
     */
    while (this._operators.stack.length > 0) {
      const current_op = this._operators.pop_top_of_stack()
      if (current_op === '(') {
        throw new Error("Missing ')' in expression")
      }
      this.add_op_node(current_op)
    }
  }

  add_op_node (current_op) {
    /**
     * creates a new node out of the operator at the top of the operator stack
     * and the top 2 child nodes in the nodes stack
     */
    try {
      const r_child = this._nodes.pop_top_of_stack()
      const l_child = this._nodes.pop_top_of_stack()
      this.add_node(new Node(current_op.value, l_child, r_child))
    } catch (error) {
      // not sure if this can be reached
      throw new Error('missing an operand/expression')
    }
  }

  add_node (node) {
    /**
     * Take an input node and add it to the node stack, if a negate symbol is at the top of the
     * operator stack, nest the given node inside as many negate nodes per consecutive negate
     * symbols in the stack.
     */
    while (
      this._operators.stack.length > 0 &&
      this._operators.get_top_of_stack() === '!'
    ) {
      this._operators.pop_top_of_stack()
      node = new Node(op.not_, node)
    }
    this._nodes.append(node)
    this.all_nodes.push(node)
  }

  op_priority (opr) {
    const op_priority_dict = { [op.or_]: 1, [op.and_]: 2 }
    try {
      return op_priority_dict[opr]
    } catch (error) {
      // TODO this is error is programmer logic related should be covered by unit tests instead
      throw new Error('not token not popped when symbol node created')
    }
  }
}
