import { supabase, isSupabaseOffline, markSupabaseUnavailable, withTimeout } from '@/lib/supabase';

const SUPABASE_TIMEOUT = 4000;

export interface Note {
  id: string;
  paper_id: string;
  content: string;
  created_at?: string;
  updated_at?: string;
}

export interface Highlight {
  id: string;
  paper_id: string;
  page_number: number;
  text: string;
  position: any;
  color: string;
  created_at?: string;
}

export const noteService = {
  async getNotesByPaper(paperId: string): Promise<Note[]> {
    if (isSupabaseOffline()) return [];

    try {
      const { data, error } = await withTimeout(
        supabase
          .from('notes')
          .select('*')
          .eq('paper_id', paperId)
          .order('created_at', { ascending: false }),
        SUPABASE_TIMEOUT
      );
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('Could not get notes from Supabase:', error);
      markSupabaseUnavailable();
      return [];
    }
  },

  async createNote(note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<Note> {
    const localNote: Note = {
      ...note,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isSupabaseOffline()) return localNote;

    try {
      const { data, error } = await withTimeout(
        supabase
          .from('notes')
          .insert([note])
          .select()
          .single(),
        SUPABASE_TIMEOUT
      );
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.warn('Could not create note in Supabase:', error);
      markSupabaseUnavailable();
      return localNote;
    }
  },

  async updateNote(id: string, content: string): Promise<Note> {
    const fallbackNote: Note = { id, paper_id: '', content, updated_at: new Date().toISOString() };

    if (isSupabaseOffline()) return fallbackNote;

    try {
      const { data, error } = await withTimeout(
        supabase
          .from('notes')
          .update({ content, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single(),
        SUPABASE_TIMEOUT
      );
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.warn('Could not update note in Supabase:', error);
      markSupabaseUnavailable();
      return fallbackNote;
    }
  },

  async getHighlightsByPaper(paperId: string): Promise<Highlight[]> {
    if (isSupabaseOffline()) return [];

    try {
      const { data, error } = await withTimeout(
        supabase
          .from('highlights')
          .select('*')
          .eq('paper_id', paperId),
        SUPABASE_TIMEOUT
      );
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('Could not get highlights from Supabase:', error);
      markSupabaseUnavailable();
      return [];
    }
  },

  async createHighlight(highlight: Omit<Highlight, 'id' | 'created_at'>): Promise<Highlight> {
    const localHighlight: Highlight = {
      ...highlight,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };

    if (isSupabaseOffline()) return localHighlight;

    try {
      const { data, error } = await withTimeout(
        supabase
          .from('highlights')
          .insert([highlight])
          .select()
          .single(),
        SUPABASE_TIMEOUT
      );
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.warn('Could not create highlight in Supabase:', error);
      markSupabaseUnavailable();
      return localHighlight;
    }
  }
};
