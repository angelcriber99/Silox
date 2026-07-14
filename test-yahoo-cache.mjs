import YahooFinance from 'yahoo-finance2';
const yf = new YahooFinance();
yf.setGlobalConfig({
  fetchOptions: {
    cache: 'no-store'
  }
});
console.log(yf._env.fetchOptions);
