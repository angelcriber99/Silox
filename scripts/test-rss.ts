import Parser from 'rss-parser';

async function main() {
  const parser = new Parser();
  const url = 'https://news.google.com/rss/search?q=Alibaba+acciones&hl=es&gl=ES&ceid=ES:es';
  const feed = await parser.parseURL(url);
  console.log(feed.title);
  feed.items.slice(0, 3).forEach(item => {
    console.log(item.title + ':' + item.link);
  });
}
main();
