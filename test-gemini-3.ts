import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

async function run() {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      // @ts-ignore
      tools: [{ googleSearch: {} }]
    })
    
    const prompt = `Actúa como un analista financiero experto. Tienes a tu disposición la herramienta de Google Search.
Busca las noticias y eventos más recientes para el ticker: AAPL.
Devuelve EXACTAMENTE un JSON con "noticias" y "events".
`
    const result = await model.generateContent(prompt)
    console.log(result.response.text())
  } catch(e) {
    console.error("Error:", e)
  }
}
run()
