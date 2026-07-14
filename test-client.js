const fs = require('fs');
async function run() {
  const data = JSON.parse(fs.readFileSync('.next/server/app/api/market-data/route.js', 'utf8').match(/x/));
}
