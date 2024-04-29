import { op } from './token-type.js'
export class ProcedureScopeTraverse {
  constructor (root_node, leaf_nodes, symbol_list, all_nodes, default_bools, coupling_data = null) {
    this.root_node = root_node
    this.redefine_children(root_node)
    this.leaf_nodes = leaf_nodes
    const branch_nodes = all_nodes.filter(node => node.has_children())
    this.test_bools = new CombinationManager(root_node)
    this.coupling_data = coupling_data
    this.symbol_list = symbol_list
    this.false_cases = []
    this.true_cases = []
    this.default_bools = default_bools

    this.case_dict = {
      true: this.true_cases,
      false: this.false_cases
    }
    this.generate_mcdc_test_cases()
  }

  generate_mcdc_test_cases () {
    this.generate_test_cases(true)
    this.generate_test_cases(false)
    return [this.true_cases, this.false_cases]
  }

  generate_test_cases (expected_result) {
    let count = 0
    while (this.root_node.mandatory_tests[expected_result].length > 0) {
      const tc_scope = new TestCaseScope(this, expected_result, count + 1)
      const remaining_tests = tc_scope.get_remaining_tests()
      // TODO validate that this test case evaluates to the expected?
      const tc_obj_params = [
        tc_scope.test_case,
        tc_scope.critical_symbol_idxs,
        expected_result
      ]
      console.log(tc_scope.test_case)
      count += 1
      this.case_dict[expected_result].push(tc_obj_params)
    }
  }

  redefine_children (current_node) {
    const all_children = []
    current_node.children = current_node.get_children()
    if (current_node.has_children()) {
      for (const child of current_node.children) {
        const merge_children = this.redefine_children(child)
        if (current_node.val === child.val) {
          all_children.push(...merge_children)
        } else {
          all_children.push(child)
        }
      }
      current_node.children = all_children
    }
    return all_children
  }
}

class CombinationManager {
  constructor (rootNode) {
    this.rootNode = rootNode
    this.managerDict = {
      true: {
        crit: { [this.rootNode]: [[true]] },
        'crit static': { [this.rootNode]: [[true]] },
        default: { [this.rootNode]: [[true]] }
      },
      false: {
        crit: { [this.rootNode]: [[false]] },
        'crit static': { [this.rootNode]: [[false]] },
        default: { [this.rootNode]: [[false]] }
      }
    }
    this.assignOneX = new BoolAssignRule(
      assignOneRule,
      getAssignOne,
      genOneX
    )
    this.assignAllX = new BoolAssignRule(
      assignAllRule,
      getAssignAll,
      genAllX
    )
    this.assignNotX = new BoolAssignRule(
      assignNotRule,
      getAssignNot,
      genAllNot
    )
    this.assignAtLeastOneX = new BoolAssignRule(
      assignAtLeastOneRule,
      getAssignAtLeastOne,
      genAtLeastOneX
    )

    this.rules = {
      and_: { true: {}, false: {} },
      or_: { true: {}, false: {} },
      not_: { true: {}, false: {} }
    }
    // critical
    this.rules.and_.true.true = this.assignAllX
    this.rules.and_.true.false = this.assignOneX
    this.rules.or_.true.true = this.assignOneX
    this.rules.or_.true.false = this.assignAllX
    this.rules.not_.true.true = this.assignNotX
    this.rules.not_.true.false = this.assignNotX

    // default
    this.rules.and_.false.true = this.rules.and_.true.true
    this.rules.and_.false.false = this.assignAtLeastOneX
    this.rules.or_.false.true = this.assignAtLeastOneX
    this.rules.or_.false.false = this.rules.or_.true.false
    this.rules.not_.false.true = this.assignNotX
    this.rules.not_.false.false = this.assignNotX

    this.generateDesiredCombinations(rootNode)
  }

  generateDesiredCombinations (currentNode) {
    if (currentNode.has_children()) {
      currentNode.crit_rules.true = this.rules[currentNode.val.name].true.true
      currentNode.crit_rules.false = this.rules[currentNode.val.name].true.false

      currentNode.default_rules.true = this.rules[currentNode.val.name].false.true
      currentNode.default_rules.false = this.rules[currentNode.val.name].false.false

      currentNode.mandatory_tests.false = currentNode.crit_rules.false.generate_test_bools(currentNode, false)
      currentNode.mandatory_tests.true = currentNode.crit_rules.true.generate_test_bools(currentNode, true)
      currentNode.MANDATORY_TESTS.false = currentNode.crit_rules.false.generate_test_bools(currentNode, false)
      currentNode.MANDATORY_TESTS.true = currentNode.crit_rules.true.generate_test_bools(currentNode, true)
      currentNode.default_tests.false = currentNode.default_rules.false.generate_test_bools(currentNode, false)
      currentNode.default_tests.true = currentNode.default_rules.true.generate_test_bools(currentNode, true)

      this.managerDict.true.crit[currentNode] =
        currentNode.mandatory_tests.true
      this.managerDict.false.crit[currentNode] =
        currentNode.mandatory_tests.false
      this.managerDict.true['crit static'][currentNode] =
        currentNode.MANDATORY_TESTS.true
      this.managerDict.false['crit static'][currentNode] =
        currentNode.MANDATORY_TESTS.false
      this.managerDict.true.default[currentNode] =
        currentNode.default_tests.true
      this.managerDict.false.default[currentNode] =
        currentNode.default_tests.false
      for (const child of currentNode.children) {
        if (child.has_children()) {
          this.generateDesiredCombinations(child)
        }
      }
    }
  }
}

class BoolAssignRule {
  constructor (state_machine_func, get_next_assign_func, generate_func) {
    this.state_machine = state_machine_func
    this.get_next_assign = get_next_assign_func
    this.generate_test_bools = generate_func
  }

  // TODO not working as expected
  fill_list (expected, inputs) {
    const inputs_cpy = [...inputs]
    let solution = new Array(inputs_cpy.length).fill(null)
    const build_list = new Array(inputs_cpy.length).fill(null)
    let i = 0
    if (!inputs_cpy.includes(true) && !inputs_cpy.includes(false)) {
      return solution
    }

    while (i < build_list.length) {
      const next_assigns = this.get_assign(expected, build_list)
      if (next_assigns.includes(null)) {
        throw new Error('No solution possible')
      }

      for (const assign of next_assigns) {
        const next_idx = inputs_cpy.indexOf(assign)
        if (next_idx !== undefined) {
          build_list[i] = inputs_cpy[next_idx]
          solution[next_idx] = build_list[i]
          inputs_cpy[next_idx] = 'X'
          break
        }
      }

      if (build_list[i] === null) {
        build_list[i] = next_assigns[0]
        const none_idx = inputs_cpy.indexOf(null)
        if (none_idx !== undefined) {
          solution[none_idx] = (next_assigns.length === 1) ? next_assigns[0] : next_assigns
          inputs_cpy[none_idx] = 'X'
        } else {
          solution = null
          break
        }
      }
      i++
    }
    return solution
  }

  get_assign (expected, boolList) {
    const endState = this.state_machine(expected, boolList)
    return this.get_next_assign(expected, endState)
  }

  get_next_input (expected, boolList) {
    let nextAssign = null
    const localList = [...boolList]
    const i = 0
    while (i < localList.length) {
      const nextAssigns = this.get_assign(expected, localList)
      if (nextAssigns.length > 1) {
        break
      }
      nextAssign = nextAssigns[0]
      const swapIdx = localList.indexOf(nextAssign)
      if (swapIdx !== undefined) {
        const tmp = localList[i]
        localList[i] = localList[swapIdx]
        localList[swapIdx] = tmp
      } else {
        break
      }
    }
    return nextAssign
  }
}

class TestCaseScope {
  constructor (proc_scope, expected_result, count) {
    this.count = count
    this.proc_scope = proc_scope
    this.coupling_data = proc_scope.coupling_data
    this.expected_result = expected_result
    this.critical_nodes = []
    this.root_node_scope = new NodeScope(
      proc_scope.root_node,
      expected_result,
      true
    )
    this.add_critical_node(this.root_node_scope)
    this.node_scopes = { [proc_scope.root_node]: this.root_node_scope }
    this.critical_symbol_idxs = []
    this.node_state = []
    this.test_case = new Array(this.proc_scope.symbol_list.length).fill(null)
    this.get_remaining_tests = this.hof_get_remaining_tests(
      this.root_node_scope.node
    )
    this.generate_test_case(this.root_node_scope)
    this.critical_symbol_idxs = Array.from(
      new Set(this.critical_symbol_idxs)
    ).sort()
  }

  generate_test_case (current_node_scope) {
    this.set_critical_paths(current_node_scope)
    this.set_non_critical_paths(current_node_scope)
  }

  set_non_critical_paths (current_node_scope) {
    if (current_node_scope.node.has_children()) {
      const child_assigns = this.set_coupled_scopes(current_node_scope.node)
      let filled_assign
      if (child_assigns.includes(null)) {
        filled_assign = current_node_scope.get_proper_test(
          child_assigns,
          this.proc_scope.default_bools
        )
      } else {
        filled_assign = child_assigns
      }
      if (filled_assign === null) {
        throw new Error('Filled assign is null')
      }
      for (let i = 0; i < filled_assign.length; i++) {
        if (Array.isArray(filled_assign[i])) {
          filled_assign[i] = false
        }
      }
      for (let i = 0; i < current_node_scope.node.children.length; i++) {
        const child = current_node_scope.node.children[i]
        const has_children = child.has_children()
        const child_node_scope = this.get_or_add_node_scope(
          child,
          filled_assign[i],
          true
        )
        if (has_children) {
          this.set_non_critical_paths(child_node_scope)
        } else {
          this.set_leaf_assign(child_node_scope)
        }
      }
    }
  }

  set_critical_paths (current_node_scope) {
    if (
      current_node_scope.node.has_children() &&
      this.critical_nodes.includes(current_node_scope.node)
    ) {
      const child_assigns = this.set_coupled_scopes(current_node_scope.node)
      const filled_assign = current_node_scope.get_proper_test(
        child_assigns,
        this.proc_scope.default_bools
      )
      if (filled_assign === null) {
        this.remove_critical_node(current_node_scope)
        return
      }
      let all_children_empty = true
      for (let i = 0; i < current_node_scope.node.children.length; i++) {
        const child = current_node_scope.node.children[i]
        const has_children = child.has_children()
        const child_node_scope = this.get_or_add_node_scope(
          child,
          filled_assign[i],
          true
        )
        if (current_node_scope.is_decision(child_node_scope.expected_result)) {
          this.add_critical_node(child_node_scope)
          if (has_children && child_node_scope.is_critical()) {
            this.set_critical_paths(child_node_scope)
            const child_is_empty = child_node_scope.mandatory_tests_empty()
            all_children_empty = all_children_empty && child_is_empty
          }
        } else {
          this.critical_symbol_idxs.push(child.val)
          child_node_scope.remove_mandatory_test([
            child_node_scope.expected_result
          ])
        }
        if (!has_children) {
          this.set_leaf_assign(child_node_scope)
          const assigned_bool = this.test_case[child_node_scope.node.val]
          if (assigned_bool !== filled_assign[i]) {
            throw new Error(
              `Critical leaf: ${assigned_bool}, Parent Expected: ${filled_assign[i]}\ntc: ${this.test_case}\nthis node: ${current_node_scope.node.val}\nc node: ${child_node_scope.node.val}`
            )
          }
        }
      }
      if (all_children_empty && current_node_scope.is_critical()) {
        const res = current_node_scope.remove_mandatory_test(filled_assign)
        if (res === false) {
          throw new Error(
            `Assignment is not valid critical: \n${filled_assign}\n${current_node_scope.node.children.map(
              (child) => child.val
            )}`
          )
        }
      }
    } else if (current_node_scope === this.root_node_scope) {
      this.critical_symbol_idxs.push(current_node_scope.node.val)
      this.set_leaf_assign(current_node_scope)
      current_node_scope.remove_mandatory_test([
        current_node_scope.expected_result
      ])
    }
  }

  set_coupled_scopes (current_node) {
    const child_assigns = new Array(current_node.children.length).fill(null)
    for (let i = 0; i < current_node.children.length; i++) {
      const child = current_node.children[i]
      if (child.has_children()) {
        const inner_child_assigns = this.set_coupled_scopes(child)
        const expected = child.evaluate(inner_child_assigns)
        if (expected !== null) {
          const child_node_scope = this.get_or_add_node_scope(child)
          child_node_scope.set_expected(expected)
          this.update_tree_state()
          child_assigns[i] = expected
        } else {
          const child_node_scope = this.node_scopes[child] || null
          if (child_node_scope !== null) {
            child_assigns[i] = child_node_scope.expected_result
          }
        }
      } else {
        const assign_bool = this.test_case[child.val]
        child_assigns[i] = assign_bool
        if (assign_bool !== null) {
          this.get_or_add_node_scope(child, assign_bool, true)
        }
      }
    }
    return child_assigns
  }

  add_critical_node (node_scope) {
    append_unique(this.critical_nodes, node_scope.node)
    node_scope.attempt_set_critical()
  }

  remove_critical_node (node_scope) {
    const index = this.critical_nodes.indexOf(node_scope.node)
    if (index !== undefined) {
      this.critical_nodes.splice(index, 1)
    }
    node_scope.unset_critical()
  }

  set_leaf_assign (node_scope) {
    const current_bool_assign = this.test_case[node_scope.node.val]
    const is_locked = node_scope.is_locked()
    if (!is_locked || current_bool_assign === null) {
      this.test_case[node_scope.node.val] = node_scope.expected_result
      this.attempt_set_coupled_idxs(node_scope)
    }
  }

  attempt_set_coupled_idxs (node_scope) {
    if (this.coupling_data !== null) {
      const group = this.coupling_data.get_idx_group(node_scope.node.val)
      if (group !== null && group.is_coupled() && node_scope.is_locked()) {
        const current_assigns = group.get_coupled_assign(this.test_case)
        const mandatory_assigns = group.fill_mandatory_bools(current_assigns)
        for (let i = 0; i < mandatory_assigns.length; i++) {
          const assign = mandatory_assigns[i]
          if (assign !== null) {
            this.test_case[group.group[i]] = assign
          }
        }
      }
    }
  }

  get_or_add_node_scope (node, expected_result = null, lock = false) {
    let stored_node_scope = this.node_scopes[node] || null
    if (stored_node_scope === null) {
      this.node_scopes[node] = new NodeScope(node, expected_result, lock)
      stored_node_scope = this.node_scopes[node]
      if (expected_result !== null) {
        this.update_tree_state()
      }
    } else if (
      stored_node_scope.expected_result === null &&
      expected_result !== null
    ) {
      stored_node_scope.set_expected(expected_result)
      stored_node_scope.locked = true
      this.update_tree_state()
    }
    return stored_node_scope
  }

  static merge_bool_lists (main_list, merge_to_main_list) {
    for (let i = 0; i < main_list.length; i++) {
      if (main_list[i] === null) {
        main_list[i] = merge_to_main_list[i]
      }
    }
    return main_list
  }

  update_tree_state (start_node_scope = null) {
    if (start_node_scope === null) {
      start_node_scope = this.root_node_scope
    }
    const res = this.print_tree_state_loop(start_node_scope.node, [])
    this.node_state = res
  }

  print_tree_state_loop (current_node, out, level = 1) {
    if (level >= out.length) {
      out.push([])
    }
    out[level - 1].push([])
    const bool_str = { true: 'T', false: 'F', null: '_' }
    const node_str = { 1: '&&', 2: '||', 3: '!' }

    for (let i = 0; i < current_node.children.length; i++) {
      const child = current_node.children[i]
      let exp_str = bool_str.null
      const c_node_scope = this.node_scopes[child] || null
      if (c_node_scope === null) {
        exp_str = `t(${exp_str})`
      } else {
        exp_str = bool_str[c_node_scope.expected_result]
        if (c_node_scope.is_critical()) {
          exp_str = `c(${exp_str})`
        }
      }
      let child_str
      if (node_str[child.val]) {
        child_str = node_str[child.val]
      } else {
        child_str = String.fromCharCode(97 + child.val)
      }
      out[level - 1][out[level - 1].length - 1].push(
        `${child_str}:${exp_str}`
      )

      if (child.has_children()) {
        this.print_tree_state_loop(child, out, level + 1)
      }
    }
    return out
  }

  hof_get_remaining_tests (base_node) {
    const _get_remaining_tests = (current_node, remaining_tests) => {
      for (let i = 0; i < current_node.children.length; i++) {
        const child = current_node.children[i]
        if (
          child.mandatory_tests.true.length ||
          child.mandatory_tests.false.length
        ) {
          remaining_tests[child] = [
            child.mandatory_tests.true,
            child.mandatory_tests.false
          ]
        }
        if (child.has_children()) {
          remaining_tests = _get_remaining_tests(child, remaining_tests)
        }
      }
      return remaining_tests
    }

    const rem_tests = {
      [base_node]: [
        base_node.mandatory_tests.true,
        base_node.mandatory_tests.false
      ]
    }
    return () => _get_remaining_tests(base_node, rem_tests)
  }
}

class NodeScope {
  constructor (node, expected_result, locked = false, default_bool = null) {
    this.node = node
    this.expected_result = expected_result
    this.locked = locked
    this._is_critical = false
    this._compare_expected = this.node.val === op.not_ ? op.ne : op.eq
    this._default_bool = default_bool
  }

  set_expected (expected_result) {
    this.expected_result = expected_result
    this.locked = true
  }

  is_locked () {
    return this.locked
  }

  is_critical () {
    return this._is_critical
  }

  attempt_set_critical () {
    if (!this.mandatory_tests_empty()) {
      this._is_critical = true
    }
  }

  unset_critical () {
    this._is_critical = false
  }

  get_tests () {
    let assign_tests
    if (this.is_critical()) {
      assign_tests = this.node.mandatory_tests[this.expected_result]
    } else {
      assign_tests = this.node.default_tests[this.expected_result]
    }
    return assign_tests
  }

  get_rule () {
    let assign_tests
    if (this.is_critical()) {
      assign_tests = this.node.crit_rules[this.expected_result]
    } else {
      assign_tests = this.node.default_rules[this.expected_result]
    }
    return assign_tests
  }

  get_proper_test (current_child_assigns, default_bools) {
    let matched_case = null
    const node_tests = this.get_tests()
    const assign_rule_obj = this.get_rule()

    if (current_child_assigns.includes(null)) {
      if (assign_rule_obj.state_machine.name === 'assignAtLeastOneRule') {
        const child_default_bools = this.get_default_bools(default_bools)
        current_child_assigns = this.merge_defaults_in_child_assign(assign_rule_obj, child_default_bools, current_child_assigns)
      }

      for (const test of node_tests) {
        const filled_list = current_child_assigns.map((elem, i) => {
          if (elem !== null) {
            return elem
          } else {
            return test[i]
          }
        })

        matched_case = assign_rule_obj.fill_list(this.expected_result, filled_list)
        if (this._is_critical && !node_tests.includes(matched_case)) {
          continue
        } else if (matched_case === null) {
          continue
        }
        break
      }
    } else if (node_tests.includes(current_child_assigns)) {
      matched_case = current_child_assigns
    }

    return matched_case
  }

  merge_defaults_in_child_assign (assign_rule_obj, child_default_bools, current_child_assigns) {
    while (child_default_bools.includes(true) || child_default_bools.includes(false)) {
      const next_assigns = assign_rule_obj.get_next_input(this.expected_result, current_child_assigns)
      if (next_assigns.length === 1) {
        const next_assign = next_assigns[0]
        const set_idx = null

        const bool_matrix = [
          Array.from(child_default_bools),
          Array.from(current_child_assigns)
        ]
        const transposed_matrix = bool_matrix[0].map((col, i) => bool_matrix.map(row => row[i]))

        const search_funcs = [
          // 1st priority: find an index with matching default val that is not assigned yet
          () => transposed_matrix.findIndex(([bool, assign]) => bool === next_assign && assign === null),
          // 2nd priority: find an index with no default val and not assigned
          () => transposed_matrix.findIndex(([bool, assign]) => bool === null && assign === null),
          // 3rd priority: find any index that is not assigned
          () => current_child_assigns.findIndex(assign => assign === null)
        ]

        for (const func of search_funcs) {
          const set_idx = func()
          if (set_idx !== -1) {
            break
          }
        }
        if (current_child_assigns[set_idx] !== undefined && child_default_bools[set_idx] !== undefined) {
          current_child_assigns[set_idx] = next_assign
          child_default_bools[set_idx] = 'X'
        } else {
          break
        }
      } else if (next_assigns.length === 2) {
        for (let x = 0; x < child_default_bools.length; x++) {
          const item = child_default_bools[x]
          if (item !== 'X' && current_child_assigns[x] === null) {
            current_child_assigns[x] = item
            child_default_bools[x] = 'X'
          }
        }
        break
      } else if (next_assigns.length === 0) {
        // do nothing
      }
    }

    return current_child_assigns
  }

  get_default_bools (all_default_bools) {
    const child_defaults = []
    for (const child of this.node.children) {
      let default_bool_val = null
      if (!child.has_children()) {
        default_bool_val = all_default_bools[child.val]
      }
      child_defaults.push(default_bool_val)
    }
    return child_defaults
  }

  mandatory_tests_empty () {
    return this.node.mandatory_tests[this.expected_result].length === 0
  }

  remove_mandatory_test (mandatory_test) {
    let res = true
    const index = this.node.mandatory_tests[this.expected_result].indexOf(mandatory_test)
    if (index !== undefined) {
      this.node.mandatory_tests[this.expected_result].splice(index, 1)
    } else {
      if (!this.node.MANDATORY_TESTS[this.expected_result].includes(mandatory_test)) {
        res = false
      }
    }
    return res
  }

  is_decision (other_expected) {
    return this._compare_expected(this.expected_result, other_expected)
  }
}

function append_unique (arr, item) {
  if (!arr.includes(item)) {
    arr.push(item)
  }
  return arr
}

function to_alpha (num) {
  return String.fromCharCode(97 + num)
}

function appendUnique (listVar, newElem) {
  listVar.push(newElem)
  listVar = [...new Set(listVar)]
  return listVar
}

function executeStateMachine (txTable, currentState, inputs) {
  let prevState
  for (const b of inputs) {
    prevState = currentState
    currentState = txTable[currentState][b]
    if (currentState === undefined) {
      currentState = prevState
      break
    }
  }
  return currentState
}

function assignOneRule (expected, boolList) {
  const state0 = 0
  const state1 = 1
  const state2 = 2

  const transitionTable = {
    [state0]: {
      [expected]: state1,
      [!expected]: state0
    },
    [state1]: {
      [expected]: state2,
      [!expected]: state1
    },
    [state2]: {
      [expected]: state2,
      [!expected]: state2
    }
  }

  const state = executeStateMachine(transitionTable, state0, boolList)
  return state
}

function getAssignOne (expected, state) {
  const nextExpected = {
    0: [expected],
    1: [!expected],
    2: []
  }
  return nextExpected[state]
}

function assignAllRule (expected, boolList) {
  const state0 = 0
  const state1 = 1

  const transitionTable = {
    [state0]: {
      [expected]: state0,
      [!expected]: state1
    },
    [state1]: {
      [expected]: state1,
      [!expected]: state1
    }
  }

  const state = executeStateMachine(transitionTable, state0, boolList)
  return state
}

function getAssignAll (expected, state) {
  const nextExpected = {
    0: [expected],
    1: []
  }
  return nextExpected[state]
}

function assignNotRule (expected, boolList) {
  const state0 = 0
  const state1 = 1

  const transitionTable = {
    [state0]: {
      [expected]: state1,
      [!expected]: state0
    },
    [state1]: {
      [expected]: state1,
      [!expected]: state1
    }
  }

  const state = executeStateMachine(transitionTable, state0, boolList)
  return state
}

function getAssignNot (expected, state) {
  const nextExpected = {
    0: [!expected],
    1: []
  }
  return nextExpected[state]
}

function assignAtLeastOneRule (expected, boolList) {
  const state0 = 0
  const state1 = 1

  const transitionTable = {
    [state0]: {
      [expected]: state1,
      [!expected]: state0
    },
    [state1]: {
      [expected]: state1,
      [!expected]: state1
    }
  }

  const state = executeStateMachine(transitionTable, state0, boolList)
  return state
}

function getAssignAtLeastOne (expected, state) {
  const nextExpected = {
    0: [expected],
    1: [false, true]
  }
  return nextExpected[state]
}

function genOneX (node, expRes) {
  return shiftByOneList(node.children.length, expRes, !expRes)
}

function genAtLeastOneX (node, expRes) {
  if (expRes === true) {
    return shiftByOneList(node.children.length, true, null)
  } else {
    return [[false].fill(node.children.length)]
  }
}

function genAllX (node, expRes) {
  return [new Array(node.children.length).fill(expRes)]
}

function genAllNot (node, expRes) {
  return [new Array(node.children.length).fill(!expRes)]
}

function shiftByOneList (listLen, shiftVal, defaultVal) {
  const matrix = []
  for (let nextShiftValLoc = 0; nextShiftValLoc < listLen; nextShiftValLoc++) {
    const row = []
    for (let rowLoc = 0; rowLoc < listLen; rowLoc++) {
      if (nextShiftValLoc === rowLoc) {
        row.push(shiftVal)
      } else {
        row.push(defaultVal)
      }
    }
    matrix.push(row)
  }
  return matrix
}
