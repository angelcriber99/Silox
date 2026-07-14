import YahooFinance from 'yahoo-finance2';
(async () => {
  try {
    const yf = new YahooFinance();
    const q = await yf.quote('NVO');
    console.log(JSON.stringify(q, null, 2));
  } catch (e) {
    console.error(e);
  }
})();
