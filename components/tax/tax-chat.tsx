"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, Loader2, Sparkles } from "lucide-react"

interface Message {
  role: "user" | "bot"
  text: string
}

interface TaxChatProps {
  context: {
    añoFiscal: number
    gains: number
    losses: number
    net: number
  }
}

export function TaxChat({ context }: TaxChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: `¡Hola! Soy tu asistente fiscal de Silox impulsado por Inteligencia Artificial. Veo que tienes un Rendimiento Neto de ${context.net}€ en el año ${context.añoFiscal}. ¿En qué casilla del borrador te puedo ayudar hoy?` }
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: "user", text: input.trim() }
    setInput("")
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Convert tax chat messages format to the format expected by the API
      const apiMessages = [...messages, userMessage].map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        content: m.text
      }))

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: apiMessages, 
          portfolioContext: context 
        }),
      })

      if (!response.ok) {
        throw new Error("Ocurrió un error al conectar con la IA.")
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantText = ""
      
      setMessages(prev => [...prev, { role: "bot", text: "" }])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          assistantText += decoder.decode(value, { stream: true })
          setMessages(prev => {
            const newMessages = [...prev]
            newMessages[newMessages.length - 1].text = assistantText
            return newMessages
          })
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: "bot", text: "Error de conexión con el servidor." }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col bg-card/40 border border-border rounded-xl overflow-hidden backdrop-blur-sm h-[500px]">
      {/* Header */}
      <div className="bg-card/80 border-b border-border p-4 flex items-center gap-3">
        <div className="bg-blue-500/10 p-2 rounded-lg">
          <Sparkles className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h2 className="font-bold text-foreground">Asistente Fiscal IA</h2>
          <p className="text-xs text-muted-foreground">Responde basándose en las leyes españolas</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
              msg.role === "user" ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"
            }`}>
              {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === "user" 
                ? "bg-emerald-600/20 text-emerald-100 border border-emerald-500/20 rounded-tr-sm" 
                : "bg-muted/50 text-foreground/80 border border-border rounded-tl-sm"
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-blue-500/20 text-blue-400">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-muted/50 border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Pensando...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-card/80 border-t border-border">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta dónde va la casilla de pérdidas, o dudas sobre tus dividendos..."
            className="w-full bg-background border border-border rounded-xl pl-4 pr-12 py-3 text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-muted disabled:text-muted-foreground/80 text-white rounded-lg transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
