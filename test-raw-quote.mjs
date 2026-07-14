async function run() {
  const url = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=ASTS';
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    }
  });
  const data = await response.json();
  console.log(JSON.stringify(data.quoteResponse.result[0], null, 2));
}
run();
