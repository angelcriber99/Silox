import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NotesState {
  content: string
  setContent: (content: string) => void
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
}

export const useNotes = create<NotesState>()(
  persist(
    (set) => ({
      content: '',
      setContent: (content) => set({ content }),
      isOpen: false,
      setIsOpen: (isOpen) => set({ isOpen }),
    }),
    {
      name: 'silox-notes-storage',
      partialize: (state) => ({ content: state.content }), // Solo guardamos el contenido
    }
  )
)
