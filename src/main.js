import { Parser } from "../ast";
import { Lexer } from "./lexer";
import { ProcedureScopeTraverse } from "./mcdc-gen";

inputValid = true;
const input = document.querySelector("input");
let lexer = new Lexer(input.value);
let errorMsg = null;

function Generator(condition) {
  try {
    const tree = generate_ast(condition);
  } catch (error) {
    input.style.backgroundColor = "lightred";
    errorMsg = error;
    return
  }

  return ProcedureScopeTraverse(
    tree.ast_root,
    tree.leaf_nodes,
    tree.symbol_list,
    tree.all_nodes,
    new Array(tree.symbol_list.length).fill(null)
  );
}

document.addEventListener("DOMContentLoaded", () => {
  input.addEventListener("keypress", () => {
    try {
      lexer = new Lexer(input.value);
      input.style.backgroundColor = "white";
      errorMsg = null;
    } catch (error) {
      input.style.backgroundColor = "lightred";
      errorMsg = error;
    }
  });
});

const button = document.querySelector("button");
button.addEventListener("click", () => {
  const errorOut = document.querySelector("#error-out");
  if (errorMsg !== null) {
    errorOut.textContent = lexerError.message;
    return
  }
  errorOut.textContent = "";
  const gen = Generator(input.value);

  if (gen === null) {
    errorOut.textContent = "Invalid input";
    return
  }
  

  const table = createTable(gen);


});

function createTable (data) {
  const table = document.createElement('table')
  const tableBody = document.createElement('tbody')
  const tableHeader = document.createElement('thead')
  const headerRow = document.createElement('tr')

  // Get all headers from data[0]
  const headers = Object.keys(data[0])

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
      row.appendChild(cell)
    })

    tableBody.appendChild(row)
  })

  table.appendChild(tableBody)
  return table
}
