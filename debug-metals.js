import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// Mock fetch
const globalFetch = global.fetch;

async function run() {
  // Use Next.js module loader or just do a simple fetch to API route
  const fileData = fs.readFileSync('/Users/angel/Downloads/metales.csv')
  const formData = new FormData()
  const blob = new Blob([fileData], { type: 'text/csv' })
  formData.append('file', blob, 'metales.csv')

  const res = await fetch('http://localhost:3000/api/import/revolut', {
    method: 'POST',
    body: formData
  })
  const json = await res.json()
  console.log(JSON.stringify(json, null, 2))
}

run()
