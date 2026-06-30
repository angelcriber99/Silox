import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Note {
  id: string
  title: string
  content: string
  updatedAt: number
}

interface NotesState {
  notes: Note[]
  activeNoteId: string | null
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  addNote: (title: string) => void
  updateNote: (id: string, content: string, title?: string) => void
  deleteNote: (id: string) => void
  setActiveNoteId: (id: string | null) => void
}

export const useNotes = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],
      activeNoteId: null,
      isOpen: false,
      setIsOpen: (isOpen) => set({ isOpen }),
      addNote: (title) => {
        const newNote: Note = {
          id: crypto.randomUUID(),
          title,
          content: '',
          updatedAt: Date.now(),
        }
        set((state) => ({
          notes: [newNote, ...state.notes],
          activeNoteId: newNote.id,
        }))
      },
      updateNote: (id, content, title) => {
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, content, title: title ?? n.title, updatedAt: Date.now() } : n
          ),
        }))
      },
      deleteNote: (id) => {
        set((state) => {
          const newNotes = state.notes.filter((n) => n.id !== id)
          return {
            notes: newNotes,
            activeNoteId: state.activeNoteId === id ? (newNotes[0]?.id || null) : state.activeNoteId,
          }
        })
      },
      setActiveNoteId: (id) => set({ activeNoteId: id }),
    }),
    {
      name: 'silox-notes-storage',
      partialize: (state) => ({ notes: state.notes, activeNoteId: state.activeNoteId }),
    }
  )
)
