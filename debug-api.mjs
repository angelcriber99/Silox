async function run() {
  try {
    const res = await fetch('https://silox.vercel.app/api/market-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickers: ['NVO'] })
    });
    // Wait, Silox uses Server Actions, not an API route for fetchMarketPrices!
  } catch (e) {
    console.error(e);
  }
}
run();
