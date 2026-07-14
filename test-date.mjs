const now = new Date();
const timeZone = 'America/New_York';
const options = { timeZone, hour12: false };
const localDateString = now.toLocaleString('en-US', options);
const localDate = new Date(localDateString);
console.log("localDateString:", localDateString);
console.log("localDate:", localDate);
console.log("getHours:", localDate.getHours());
