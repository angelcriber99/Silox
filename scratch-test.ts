import { GET } from './app/api/cron/sync-dividends/route.ts'
async function run() {
  console.log('Running sync-dividends cron job locally...')
  try {
    const req = new Request('http://localhost:3000/api/cron/sync-dividends')
    const res = await GET(req)
    const data = await res.json()
    console.log('Result:', JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error:', error)
  }
}
run()
