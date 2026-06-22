"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Send, Sparkles, User, Loader2, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface AiChatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  portfolioContext: any
  initialMessage?: string
}

export function AiChatDialog({ open, onOpenChange, portfolioContext, initialMessage }: AiChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load history on mount or set initial message
  useEffect(() => {
    if (messages.length > 0) return

    const saved = localStorage.getItem('silox-ai-chat')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.length > 0) {
          setMessages(parsed)
          return
        }
      } catch (e) {}
    }

    if (open && initialMessage) {
      setMessages([
        { id: '1', role: 'assistant', content: initialMessage }
      ])
    }
  }, [open, initialMessage]) // deliberately excluded messages.length to avoid infinite loops

  // Save history on change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('silox-ai-chat', JSON.stringify(messages))
    }
  }, [messages])

  const clearChat = () => {
    localStorage.removeItem('silox-ai-chat')
    if (initialMessage) {
      setMessages([{ id: Date.now().toString(), role: 'assistant', content: initialMessage }])
    } else {
      setMessages([])
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          portfolioContext
        })
      })

      if (!res.ok) {
        throw new Error('Failed to fetch')
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''
      
      const assistantId = (Date.now() + 1).toString()
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          assistantContent += decoder.decode(value, { stream: true })
          setMessages(prev => prev.map(m => 
            m.id === assistantId ? { ...m, content: assistantContent } : m
          ))
        }
      }
    } catch (error) {
      console.error(error)
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Lo siento, hubo un error al conectar con Silox AI.' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-background border-border p-0 flex flex-col h-[80vh] sm:h-[600px] overflow-hidden gap-0">
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center gap-2 m-0 bg-card/50">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <DialogTitle className="text-foreground text-base m-0">Silox AI</DialogTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 ml-auto text-muted-foreground/80 hover:text-red-400 hover:bg-red-400/10" 
            onClick={clearChat}
            title="Borrar historial"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </DialogHeader>
        
        <ScrollArea className="flex-1 p-4 bg-background">
          <div className="space-y-4 pb-4">
            {messages.map(m => (
              <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </div>
                )}
                
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-muted text-foreground/90 rounded-bl-none'
                }`}>
                  {m.content.split('\n').map((line, i) => (
                    <span key={i}>
                      {line}
                      <br />
                    </span>
                  ))}
                </div>

                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-blue-400" />
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div className="bg-muted text-muted-foreground rounded-2xl rounded-bl-none px-4 py-2 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Escribiendo...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-2" />
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border bg-card/50 mt-auto">
          <form onSubmit={handleSubmit} className="flex gap-2 relative">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregúntale a Silox AI..."
              className="bg-background border-border text-foreground pr-12 focus-visible:ring-purple-500"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="absolute right-1 top-1 bottom-1 h-auto bg-purple-600 hover:bg-purple-700 text-white shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
