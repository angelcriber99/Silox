import yf from 'yahoo-finance2';
(async () => {
  const q = await yf.quote('ASTS');
  console.log(JSON.stringify(q, null, 2));
})();
