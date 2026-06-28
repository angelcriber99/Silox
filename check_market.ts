import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()

async function check() {
  try {
    const q = await yahooFinance.quote('REVOLUT')
    console.log("REVOLUT:", q)
  } catch(e) {
    console.log("REVOLUT not found", e.message)
  }
}

check()
