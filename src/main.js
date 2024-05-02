import { Parser } from './ast.js'
import { Lexer } from './lexer.js'
import { ProcedureScopeTraverse } from './mcdc-gen.js'
import './styles.css'

const lightred = '#FFCCCB'
const input = document.querySelector('input')
input.value = '(((a | b) & (!c | d) & (e | f) & (!g | h)) & ((i | j) & k & (!l | m)) & ((n | !o) & (p | !q) & (r & !s) & t))'
const output = document.querySelector('#output-container')
let lex = null
let errorMsg = null

function Generator (condition_string) {
  let tree = null
  try {
    lex = new Lexer(condition_string)
    tree = new Parser(lex.tokens, lex.symbols)
  } catch (error) {
    input.style.backgroundColor = lightred
    errorMsg = error
    return
  }

  return new ProcedureScopeTraverse(
    tree.ast_root,
    tree.leaf_nodes,
    tree.symbol_list,
    tree.all_nodes,
    new Array(tree.symbol_list.length).fill(null)
  )
}

input.addEventListener('input', (event) => {
  console.log(event.target)
  event.stopPropagation()
  try {
    lex = new Lexer(input.value)
    input.style.backgroundColor = 'white'
    errorMsg = null
  } catch (error) {
    input.style.backgroundColor = lightred
    errorMsg = error
  }
})

function generateOnClick (event) {
  event.stopPropagation()
  event.preventDefault()
  const errorOut = document.querySelector('#error-out')
  if (errorMsg !== null) {
    errorOut.textContent = errorMsg.message
    return
  }
  errorOut.textContent = ''
  const gen = Generator(input.value)

  if (gen === undefined) {
    errorOut.textContent = 'Invalid input'
    return
  }
  const symbolNames = gen.symbol_list.map((symbol) => symbol.value)
  let testCases = [...gen.false_cases, ...gen.true_cases]
  testCases = testCases.map((testCase) => {
    const boolAssigns = testCase[0]
    const criticalNodeValues = testCase[1]
    const expectedResult = testCase[2]
    const testCaseRecord = {}
    boolAssigns.forEach((bool, index) => {
      testCaseRecord[symbolNames[index]] = bool
    })
    testCaseRecord.critical_nodes = criticalNodeValues.map((nodeVal) => symbolNames[nodeVal])
    testCaseRecord.expected_result = expectedResult
    return testCaseRecord
  })
  const table = createTable(Object.keys(testCases[0]), testCases)
  output.innerHTML = ''
  output.appendChild(table)
}

const button = document.querySelector('button')
button.addEventListener('click', generateOnClick)

function createTable (headers, data) {
  const table = document.createElement('table')
  const tableBody = document.createElement('tbody')
  const tableHeader = document.createElement('thead')
  const headerRow = document.createElement('tr')

  // Get all headers from data[0]
  // const headers = Object.keys(data[0])

  headers.forEach(header => {
    const headerCell = document.createElement('th')
    headerCell.textContent = header
    headerRow.appendChild(headerCell)
  })

  tableHeader.appendChild(headerRow)
  table.appendChild(tableHeader)

  data.forEach(respObj => {
    const row = document.createElement('tr')

    headers.forEach(header => {
      const cell = document.createElement('td')
      cell.textContent = respObj[header]
      if (cell.textContent === 'true') {
        cell.style.backgroundColor = 'lightgreen'
      } else if (cell.textContent === 'false') {
        cell.style.backgroundColor = lightred
      }
      if (respObj.critical_nodes.includes(header)) {
        cell.style.fontWeight = 'bold';
      }
      row.appendChild(cell)
    })

    tableBody.appendChild(row)
  })

  table.appendChild(tableBody)
  return table
}
