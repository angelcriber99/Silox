function getMarketState(timezone) {
  const now = new Date();
  const options = { timeZone: timezone, hour12: false, hour: 'numeric', minute: 'numeric', weekday: 'short' };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  
  const parts = formatter.formatToParts(now);
  const weekday = parts.find(p => p.type === 'weekday')?.value;
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  const time = hour * 100 + minute;
  
  if (isWeekend) return 'CLOSED';
  if (time >= 400 && time < 930) return 'PRE';
  if (time >= 930 && time < 1600) return 'REGULAR';
  if (time >= 1600 && time < 2000) return 'POST';
  return 'CLOSED';
}
console.log(getMarketState('America/New_York'));
