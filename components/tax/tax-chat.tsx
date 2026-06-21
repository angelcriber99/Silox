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

    const userMessage = input.trim()
    setInput("")
    setMessages(prev => [...prev, { role: "user", text: userMessage }])
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, context }),
      })

      const data = await response.json()
      
      if (response.ok) {
        setMessages(prev => [...prev, { role: "bot", text: data.text }])
      } else {
        setMessages(prev => [...prev, { role: "bot", text: data.error || "Ocurrió un error." }])
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: "bot", text: "Error de conexión con el servidor." }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden backdrop-blur-sm h-[500px]">
      {/* Header */}
      <div className="bg-zinc-900/80 border-b border-zinc-800/60 p-4 flex items-center gap-3">
        <div className="bg-blue-500/10 p-2 rounded-lg">
          <Sparkles className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h2 className="font-bold text-white">Asistente Fiscal IA</h2>
          <p className="text-xs text-zinc-400">Responde basándose en las leyes españolas</p>
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
                : "bg-zinc-800/50 text-zinc-300 border border-zinc-700/50 rounded-tl-sm"
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
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              <span className="text-sm text-zinc-400">Pensando...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-zinc-900/80 border-t border-zinc-800/60">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta dónde va la casilla de pérdidas, o dudas sobre tus dividendos..."
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-4 pr-12 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-lg transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
