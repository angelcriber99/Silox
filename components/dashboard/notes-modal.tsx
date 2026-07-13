"use client"

import { useNotes } from "@/lib/stores/use-notes"
import { X, StickyNote, Plus, Folder, Trash2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState, useMemo } from "react"
import { toast } from "sonner"

export function NotesModal() {
  const { isOpen, setIsOpen, notes, activeNoteId, addNote, updateNote, deleteNote, setActiveNoteId } = useNotes()
  
  const [localTitle, setLocalTitle] = useState("")
  const [localContent, setLocalContent] = useState("")

  const activeNote = useMemo(() => notes.find(n => n.id === activeNoteId), [notes, activeNoteId])

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setLocalTitle(activeNote?.title ?? "")
      setLocalContent(activeNote?.content ?? "")
    }, 0)
    return () => window.clearTimeout(syncTimer)
  }, [activeNoteId, activeNote?.id])

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
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 pointer-events-none"
          >
            <div 
              className="bg-background border border-border shadow-2xl rounded-2xl overflow-hidden flex w-full max-w-5xl h-[85vh] max-h-[800px] pointer-events-auto"
            >
              
              {/* Sidebar */}
              <div className="w-72 border-r border-border bg-card/50 flex flex-col flex-shrink-0">
                <div className="px-5 py-5 border-b border-border flex items-center justify-between bg-card flex-shrink-0">
                  <div className="flex items-center gap-2 text-amber-500 font-bold text-lg">
                    <StickyNote className="w-5 h-5" />
                    <span>Mis Planes</span>
                  </div>
                  <button
                    onClick={handleAddNote}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 transition-colors font-medium text-sm"
                    title="Nueva Nota"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nueva</span>
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {notes.length === 0 ? (
                    <div className="text-center p-6 mt-10">
                      <p className="text-sm text-muted-foreground mb-4">No tienes ninguna nota todavía.</p>
                      <button
                        onClick={handleAddNote}
                        className="px-4 py-2 bg-amber-500 text-amber-950 font-semibold rounded-xl hover:bg-amber-400 transition-colors w-full"
                      >
                        Crear mi primer plan
                      </button>
                    </div>
                  ) : (
                    notes.map(note => (
                      <button
                        key={note.id}
                        onClick={() => setActiveNoteId(note.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all group ${
                          activeNoteId === note.id 
                            ? "bg-amber-500/15 text-amber-500 font-bold border border-amber-500/30 shadow-sm" 
                            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <Folder className={`w-4 h-4 flex-shrink-0 ${activeNoteId === note.id ? "fill-amber-500/20" : ""}`} />
                          <span className="truncate">{note.title || "Sin Título"}</span>
                        </div>
                        <Trash2 
                          className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-rose-500/70 hover:text-rose-500 flex-shrink-0" 
                          onClick={(e) => handleDelete(note.id, e)}
                        />
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 flex flex-col bg-background relative">
                <button
                  onClick={() => setIsOpen(false)}
                  className="absolute top-5 right-5 p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors z-10"
                >
                  <X className="w-6 h-6" />
                </button>

                {activeNote ? (
                  <div className="flex-1 flex flex-col p-10 pt-12">
                    <input
                      type="text"
                      value={localTitle}
                      onChange={(e) => setLocalTitle(e.target.value)}
                      placeholder="Título (Ej: $BABA, Plan de Pensiones...)"
                      className="text-3xl font-extrabold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 mb-8"
                    />
                    <textarea
                      value={localContent}
                      onChange={(e) => setLocalContent(e.target.value)}
                      placeholder="Escribe tu tesis de inversión, niveles de entrada, alarmas..."
                      className="flex-1 w-full bg-transparent border-none outline-none resize-none font-mono text-[14px] leading-relaxed text-muted-foreground placeholder:text-muted-foreground/30"
                    />
                    <div className="text-xs text-muted-foreground/70 text-right mt-4 flex items-center justify-end gap-2 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                      Autoguardado activado
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                    <StickyNote className="w-16 h-16 mb-6 opacity-20" />
                    <p className="text-lg font-medium mb-2 text-foreground">Selecciona una nota para empezar</p>
                    <p className="text-sm text-muted-foreground mb-6">O crea una nueva desde el panel lateral.</p>
                    <button
                      onClick={handleAddNote}
                      className="px-6 py-3 bg-amber-500/10 text-amber-500 font-semibold rounded-xl hover:bg-amber-500/20 transition-colors border border-amber-500/20"
                    >
                      <Plus className="w-4 h-4 inline mr-2 -mt-0.5" />
                      Crear nueva nota
                    </button>
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
