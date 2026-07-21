import { create } from 'zustand'
import { fetchNotes, syncNoteAction, deleteNoteAction } from '@/lib/actions/notes'

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
  isInitialized: boolean
  setIsOpen: (isOpen: boolean) => void
  addNote: (title: string) => void
  updateNote: (id: string, content: string, title?: string) => void
  deleteNote: (id: string) => void
  setActiveNoteId: (id: string | null) => void
  initNotes: () => Promise<void>
}

let debounceTimeout: NodeJS.Timeout;

export const useNotes = create<NotesState>((set, get) => ({
  notes: [],
  activeNoteId: null,
  isOpen: false,
  isInitialized: false,
  
  initNotes: async () => {
    if (get().isInitialized) return;
    try {
      const cloudNotes = await fetchNotes();
      const notes = cloudNotes.map(n => ({
        id: n.id,
        title: n.title,
        content: n.content,
        updatedAt: new Date(n.updated_at).getTime()
      }));
      set({ notes, isInitialized: true, activeNoteId: notes.length > 0 ? notes[0].id : null });
    } catch (error) {
      console.error('Failed to init notes', error);
    }
  },

  setIsOpen: (isOpen) => {
    set({ isOpen })
    if (isOpen) {
      get().initNotes()
    }
  },

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
    
    syncNoteAction({
      id: newNote.id,
      title: newNote.title,
      content: newNote.content,
      updated_at: new Date(newNote.updatedAt).toISOString()
    }).catch(console.error)
  },

  updateNote: (id, content, title) => {
    let updatedNote: Note | undefined;
    
    set((state) => ({
      notes: state.notes.map((n) => {
        if (n.id === id) {
          updatedNote = { ...n, content, title: title ?? n.title, updatedAt: Date.now() };
          return updatedNote;
        }
        return n;
      }),
    }))

    if (updatedNote) {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        syncNoteAction({
          id: updatedNote!.id,
          title: updatedNote!.title,
          content: updatedNote!.content,
          updated_at: new Date(updatedNote!.updatedAt).toISOString()
        }).catch(console.error)
      }, 1000);
    }
  },

  deleteNote: (id) => {
    set((state) => {
      const newNotes = state.notes.filter((n) => n.id !== id)
      return {
        notes: newNotes,
        activeNoteId: state.activeNoteId === id ? (newNotes[0]?.id || null) : state.activeNoteId,
      }
    })
    
    deleteNoteAction(id).catch(console.error)
  },
  
  setActiveNoteId: (id) => set({ activeNoteId: id }),
}))
