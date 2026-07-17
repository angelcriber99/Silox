require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function run() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      tools: [{ googleSearch: {} }]
    });
    
    const prompt = "Busca en internet la noticia más reciente de Apple. Devuelve SOLAMENTE un JSON estructurado así: {\"noticias\":[{\"title\":\"...\",\"publisher\":\"...\"}]}. SIN NADA MAS.";
    const result = await model.generateContent(prompt);
    console.log(result.response.text());
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
