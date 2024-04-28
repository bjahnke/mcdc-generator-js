export class LeafNode {
  constructor(val) {
    this.val = val;
    this.parent = null;
    this.traverse_manager = null;
  }

  toString() {
    return String(this.val);
  }

  _is_valid(...arg) {
    /**
     * always return true when this method is called
     * @param arg: used for duck type with Node
     */
    return true;
  }

  _evaluate(bool_assigns) {
    /**
     * @param bool_assigns: given a boolean list, return the bool of this node's index (this.val)
     * @return:
     */
    const res_val = bool_assigns[this.val];
    return res_val;
  }

  has_children() {
    return false;
  }
}

export class Node extends LeafNode {
  /**
   * Node class should receive the following arguments:
   * val: can be
   * - operator function: op.and_, op.or_, op.not_
   * - index pointing to a TestStep and assignment of the TestStep
   *   for the given TestCase (True/False)
   * c1, c2: child nodes of this node.
   * - If op.and_/op.or_ is used, both are expected to be set
   * - If op.not_ is used, 1 should exclusively be set
   * - If val is an index, neither will be looked at. Can be left unset
   */
  constructor(val, c1 = null, c2 = null) {
    super(val);
    this.child1 = c1;
    this.child2 = c2;
    this.children = this.get_children();
    this._is_valid = this._hof_interpret();
    this._evaluate = this._hof_evaluate();
    this.crit_rules = {};
    this.default_rules = {};
    this.mandatory_tests = { true: [[true]], false: [[false]] };
    this.MANDATORY_TESTS = { true: [[true]], false: [[false]] };
    this.default_tests = {};
  }

  get_children() {
    const children_list = [];

    const append_child = (child) => {
      if (child !== null) {
        children_list.push(child);
      }
    };

    append_child(this.child1);
    append_child(this.child2);
    return children_list;
  }

  get_self_method(input_func) {
    try {
      const func = this[input_func.name];
      try {
        const return_val = func();
        func = typeof return_val === 'function' ? return_val : func;
      } catch (error) {
        // if this function needs a parameter, either the higher
        // order function requires a parameter (which is bad)
        // or the function returns a non-function value, which is fine
      }
    } catch (error) {
      throw new Error(`Input function: ${input_func.name} not usable.`);
    }
    return func;
  }

  interp_and_eval(a_list, exception_rules = null) {
    let res_val = null;
    if (this._is_valid(a_list)) {
      res_val = this._evaluate(a_list);
    }
    return res_val;
  }

  evaluate(a_list) {
    return this._evaluate(a_list);
  }

  get_critical_leafs(eval_list, critical_leafs, expected) {
    let new_criticals = [];
    const bool_val = this._evaluate(eval_list);
    const new_vals = critical_leafs.length === 0 ? [this.val] : critical_leafs;
    if (bool_val === expected) {
      new_criticals = new_criticals.concat(new_vals);
    }
    return [bool_val, [...new Set(new_criticals)].sort()];
  }

  _hof_interpret() {
    const interpret_func = (compare_bool) => {
      const is_valid = (bools) => {
        let result = false;
        for (const a_bool of bools) {
          if (a_bool !== compare_bool) {
            result = true;
            break;
          }
        }
        const a_dict = { true: true, false: null };
        return a_dict[result];
      };
      return is_valid;
    };

    const interp_dict = {
      [op.and_]: interpret_func(false),
      [op.or_]: interpret_func(true),
    };
    return interp_dict[this.val] || (() => true);
  }

  _hof_evaluate() {
    const eval_children = (bools) => {
      const lang = [null, null, null];
      if (this.val === op.and_) {
        lang[0] = true;
        lang[1] = false;
      } else {
        lang[0] = false;
        lang[1] = true;
      }
      lang[2] = null;
      const s0 = 0;
      const s1 = 1;
      const s2 = 2;
      const state_mx = {
        [`${s0},${0}`]: s0,
        [`${s0},${1}`]: s1,
        [`${s0},${2}`]: s2,
        [`${s1},${0}`]: s1,
        [`${s1},${1}`]: s1,
        [`${s1},${2}`]: s1,
        [`${s2},${0}`]: s1,
        [`${s2},${1}`]: s2,
        [`${s2},${2}`]: s2,
      };

      let current_state = s0;
      for (const assign of bools) {
        current_state = state_mx[`${current_state},${lang.indexOf(assign)}`];
      }

      return lang[current_state];
    };

    const eval_not_child = (bools) => {
      let res_val = null;
      if (bools[0] !== null) {
        res_val = this.val(bools[0]);
      }
      return res_val;
    };

    const get_assignment = (assignment) => {
      return assignment[this.val];
    };

    const func_dict = {
      [op.and_]: eval_children,
      [op.or_]: eval_children,
      [op.not_]: eval_not_child,
    };
    return func_dict[this.val] || get_assignment;
  }

  has_children() {
    return this.children.length > 0;
  }
}
