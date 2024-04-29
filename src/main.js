import { Parser } from './ast.js'
import { Lexer } from './lexer.js'
import { ProcedureScopeTraverse } from './mcdc-gen.js'
import lodash from 'lodash'

const lightred = '#FFCCCB'
const input = document.querySelector('input')
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

const button = document.querySelector('button')
button.addEventListener('click', () => {
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
  const table = createTable(gen.symbol_list, [...gen.false_cases, ...gen.true_cases])
  output.innerHTML = ''
  output.appendChild(table)
})

function createTable (headers, data) {
  const table = document.createElement('table')
  const tableBody = document.createElement('tbody')
  const tableHeader = document.createElement('thead')
  const headerRow = document.createElement('tr')

  // Get all headers from data[0]
  // const headers = Object.keys(data[0])

  tableHeader.appendChild(headerRow)
  table.appendChild(tableHeader)

  data.forEach(respObj => {
    const row = document.createElement('tr')

    headers.forEach(header => {
      const cell = document.createElement('td')
      cell.textContent = respObj[header]
      row.appendChild(cell)
    })

    tableBody.appendChild(row)
  })

  table.appendChild(tableBody)
  return table
}
