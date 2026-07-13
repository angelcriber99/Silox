import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from "@google/generative-ai"
import { z } from 'zod'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

const ChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'model']),
    content: z.string().max(2000)
  })).max(50),
  portfolioContext: z.any()
})

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    
    const parsed = ChatSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { messages, portfolioContext } = parsed.data

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

    const contextStr = JSON.stringify(portfolioContext, null, 2)
    if (contextStr.length > 50000) {
      return NextResponse.json({ error: 'Portfolio context is too large' }, { status: 400 })
    }

    // Build the system prompt
    const systemPrompt = `
Eres Silox AI, un asesor financiero personal sumamente inteligente e integrado en el dashboard del usuario. 
Tu objetivo es ayudar al usuario a entender su cartera, contrastar ideas, debatir estrategias y dar tu opinión experta.
Mantén un tono profesional, cercano (tuteando) y directo al grano.
Si no sabes algo o no tienes información sobre un activo específico, admítelo.

Aquí tienes el contexto de la cartera actual del usuario:
${contextStr}
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
