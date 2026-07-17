require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
async function run() {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} }]
  });
  const prompt = "Busca las 2 noticias más recientes e importantes en español sobre 'Apple' y 'AST SpaceMobile' de fuentes verificadas. Devuelve un JSON con este formato: { noticias: [{ ticker: string, title: string, publisher: string, link: string, publishDate: string }]}. Responde SOLO con el JSON.";
  const res = await model.generateContent(prompt);
  console.log(res.response.text());
}
run().catch(console.error);
