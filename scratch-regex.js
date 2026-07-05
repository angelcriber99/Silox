const text = '18 Jun 2026 14:36:33 GMTGRRRTrade - Market14.51800232US$17.22BuyUS$250US$0US$0';
console.log(text.match(/GMT([A-Z]+)/));
console.log(text.match(/Trade - Market([\d\.]+)/));
console.log(text.match(/([\d\.]+)US\$([\d\.,]+)(Buy|Sell)/));

const regex = /(\d{2}\s+[A-Za-z]{3}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT)([A-Z]+)Trade\s*-\s*[A-Za-z]+([\d\.]+)(?:US\$|€|£|US\$\s)?([\d\.,]+)(Buy|Sell)(?:US\$|€|£|US\$\s)?([\d\.,]+)(?:US\$|€|£|US\$\s)?([\d\.,]+)(?:US\$|€|£|US\$\s)?([\d\.,]+)/g;

const matches = [...text.matchAll(regex)];
console.log(matches.length, matches[0]);
