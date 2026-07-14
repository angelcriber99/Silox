async function run() {
  const url = 'https://finance.yahoo.com/quote/ASTS';
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    }
  });
  const html = await response.text();
  console.log("HTML length:", html.length);
  // look for preMarketPrice
  const match = html.match(/"preMarketPrice":\{"raw":([^}]+)\}/);
  if (match) {
    console.log("preMarketPrice:", match[1]);
  } else {
    console.log("Not found preMarketPrice in HTML");
  }
}
run();
