import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

export async function POST(request: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return new Response("La IA no está configurada.", { status: 500 })
    }

    const { messages, portfolioContext } = await request.json()

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    // Build the system prompt
    const systemPrompt = `
Eres Silox AI, un asesor financiero personal sumamente inteligente e integrado en el dashboard del usuario. 
Tu objetivo es ayudar al usuario a entender su cartera, contrastar ideas, debatir estrategias y dar tu opinión experta.
Mantén un tono profesional, cercano (tuteando) y directo al grano.
Si no sabes algo o no tienes información sobre un activo específico, admítelo.

Aquí tienes el contexto de la cartera actual del usuario:
${JSON.stringify(portfolioContext, null, 2)}
`

    // Start a chat session
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: systemPrompt }],
        },
        {
          role: "model",
          parts: [{ text: "Entendido. Estoy listo para ayudar al usuario con su cartera." }],
        },
        // Reconstruct the history from the user's messages
        ...messages.slice(0, -1).map((msg: any) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }))
      ],
    })

    const lastMessage = messages[messages.length - 1].content

    const result = await chat.sendMessageStream(lastMessage)

    // Create a ReadableStream to stream the response back to the client
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text()
            if (chunkText) {
              controller.enqueue(new TextEncoder().encode(chunkText))
            }
          }
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error("AI Chat Error:", error)
    return new Response("No se pudo conectar con Silox AI", { status: 500 })
  }
}
