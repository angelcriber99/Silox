"use client"

import { useNotes } from "@/lib/stores/use-notes"
import { X, StickyNote, Plus, Folder, Trash2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState, useMemo } from "react"
import { toast } from "sonner"

export function NotesModal() {
  const { isOpen, setIsOpen, notes, activeNoteId, addNote, updateNote, deleteNote, setActiveNoteId } = useNotes()
  
  // Local state for smooth typing without triggering full re-renders immediately
  const [localTitle, setLocalTitle] = useState("")
  const [localContent, setLocalContent] = useState("")

  const activeNote = useMemo(() => notes.find(n => n.id === activeNoteId), [notes, activeNoteId])

  // Sync local state when active note changes
  useEffect(() => {
    if (activeNote) {
      setLocalTitle(activeNote.title)
      setLocalContent(activeNote.content)
    } else {
      setLocalTitle("")
      setLocalContent("")
    }
  }, [activeNoteId, activeNote?.id]) // intentionally only sync when ID changes, not on every content update

  // Auto-save logic
  useEffect(() => {
    if (activeNote && (localTitle !== activeNote.title || localContent !== activeNote.content)) {
      const timer = setTimeout(() => {
        updateNote(activeNote.id, localContent, localTitle)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [localTitle, localContent, activeNote, updateNote])

  const handleAddNote = () => {
    addNote("Nueva Nota")
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteNote(id)
    toast.success("Nota eliminada")
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 p-4"
          >
            <div className="bg-card/90 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl overflow-hidden flex h-[85vh]">
              
              {/* Sidebar */}
              <div className="w-64 border-r border-border/30 bg-muted/20 flex flex-col">
                <div className="px-4 py-4 border-b border-border/30 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-500 font-semibold">
                    <StickyNote className="w-4 h-4" />
                    <span>Planes</span>
                  </div>
                  <button
                    onClick={handleAddNote}
                    className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 transition-colors"
                    title="Nueva Nota"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {notes.length === 0 ? (
                    <div className="text-center p-4 text-sm text-muted-foreground">
                      No hay notas. Crea una para empezar.
                    </div>
                  ) : (
                    notes.map(note => (
                      <button
                        key={note.id}
                        onClick={() => setActiveNoteId(note.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all group ${
                          activeNoteId === note.id 
                            ? "bg-amber-500/10 text-amber-500 font-medium" 
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Folder className={`w-3.5 h-3.5 flex-shrink-0 ${activeNoteId === note.id ? "fill-amber-500/20" : ""}`} />
                          <span className="truncate">{note.title || "Sin Título"}</span>
                        </div>
                        <Trash2 
                          className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-rose-500 flex-shrink-0" 
                          onClick={(e) => handleDelete(note.id, e)}
                        />
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col bg-card/30 relative">
                <button
                  onClick={() => setIsOpen(false)}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted/80 text-muted-foreground transition-colors z-10"
                >
                  <X className="w-5 h-5" />
                </button>

                {activeNote ? (
                  <div className="flex-1 flex flex-col p-8 pt-10">
                    <input
                      type="text"
                      value={localTitle}
                      onChange={(e) => setLocalTitle(e.target.value)}
                      placeholder="Título (Ej: $BABA, Plan de Pensiones...)"
                      className="text-2xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30 mb-6"
                    />
                    <textarea
                      value={localContent}
                      onChange={(e) => setLocalContent(e.target.value)}
                      placeholder="Escribe tu tesis de inversión, niveles de entrada, alarmas..."
                      className="flex-1 w-full bg-transparent border-none outline-none resize-none font-mono text-[13px] leading-relaxed text-muted-foreground placeholder:text-muted-foreground/30"
                    />
                    <div className="text-xs text-muted-foreground/40 text-right mt-4 flex items-center justify-end gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500/50 animate-pulse" />
                      Autoguardado activado
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/50">
                    <StickyNote className="w-12 h-12 mb-4 opacity-20" />
                    <p>Selecciona una nota o crea una nueva</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
