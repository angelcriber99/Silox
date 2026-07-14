const now = new Date();
const timeZone = 'America/New_York';
const options = { timeZone, hour12: false, hour: 'numeric', minute: 'numeric', weekday: 'short' };
const formatter = new Intl.DateTimeFormat('en-US', options);
const parts = formatter.formatToParts(now);
console.log(parts);
