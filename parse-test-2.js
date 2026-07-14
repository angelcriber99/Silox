import fs from 'fs'

function normalizeText(value) {
  return String(value ?? '').trim()
}
function normalizeHeader(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}
function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]
    if (char === '"' && inQuotes && next === '"') {
      cell += '"'
      i++
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim())
      cell = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

const fileData = fs.readFileSync('/Users/angel/Downloads/metales.csv', 'utf-8')
const rows = parseCsv(fileData)
const headers = rows[0].map(normalizeHeader)

console.log('Headers:', headers)

function isMetalAccountStatement(headers) {
  return (
    headers.includes('tipo') &&
    headers.includes('producto') &&
    headers.includes('fechadeinicio') &&
    headers.includes('descripcion') &&
    headers.includes('importe') &&
    headers.includes('comision') &&
    headers.includes('divisa') &&
    headers.includes('saldo')
  )
}
console.log('Is metal account statement:', isMetalAccountStatement(headers))
