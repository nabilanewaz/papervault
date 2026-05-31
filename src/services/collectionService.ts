import { supabase, isSupabaseOffline, markSupabaseUnavailable, withTimeout } from '@/lib/supabase';
import { localStorageService } from './localStorageService';

const SUPABASE_TIMEOUT = 4000;

export interface Collection {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_at?: string;
}

export const collectionService = {
  async getAllCollections(): Promise<Collection[]> {
    // Skip Supabase if offline
    if (isSupabaseOffline()) {
      return localStorageService.getAllCollections();
    }

    try {
      const { data, error } = await withTimeout(
        supabase
          .from('collections')
          .select('*')
          .order('name'),
        SUPABASE_TIMEOUT
      );
      
      if (error) throw error;
      
      // Merge with local collections
      const localCollections = localStorageService.getAllCollections();
      const allCollections = [...(data || [])];
      
      localCollections.forEach((lc: Collection) => {
        if (!allCollections.find(c => c.id === lc.id)) {
          allCollections.push(lc);
        }
      });
      
      return allCollections;
    } catch (error) {
      console.warn('Supabase unavailable for collections, using local storage:', error);
      markSupabaseUnavailable();
      return localStorageService.getAllCollections();
    }
  },

  async createCollection(collection: Omit<Collection, 'id' | 'created_at'>): Promise<Collection> {
    const newCollection: Collection = {
      ...collection,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };

    // Always save locally first
    localStorageService.saveCollection(newCollection);

    // Skip Supabase if offline
    if (isSupabaseOffline()) {
      return newCollection;
    }

    try {
      const { data, error } = await withTimeout(
        supabase
          .from('collections')
          .insert([collection])
          .select()
          .single(),
        SUPABASE_TIMEOUT
      );
      
      if (error) throw error;
      if (data) {
        // Update local with Supabase data
        localStorageService.deleteCollection(newCollection.id);
        localStorageService.saveCollection(data);
        return data;
      }
    } catch (error) {
      console.warn('Supabase unavailable, collection saved locally:', error);
      markSupabaseUnavailable();
    }

    return newCollection;
  },

  async deleteCollection(id: string): Promise<void> {
    // Delete from local storage
    localStorageService.deleteCollection(id);
    
    // Try Supabase if available
    if (!isSupabaseOffline()) {
      try {
        await withTimeout(
          supabase
            .from('collections')
            .delete()
            .eq('id', id),
          SUPABASE_TIMEOUT
        );
      } catch (error) {
        console.warn('Could not delete from Supabase:', error);
        markSupabaseUnavailable();
      }
    }
  },

  async addPaperToCollection(paperId: string, collectionId: string): Promise<void> {
    localStorageService.updatePaper(paperId, { collection_id: collectionId });

    if (isSupabaseOffline()) return;

    try {
      await withTimeout(
        supabase
          .from('papers')
          .update({ collection_id: collectionId })
          .eq('id', paperId),
        SUPABASE_TIMEOUT
      );
    } catch (error) {
      console.warn('Could not update collection in Supabase:', error);
      markSupabaseUnavailable();
    }
  },

  async removePaperFromCollection(paperId: string, collectionId: string): Promise<void> {
    if (isSupabaseOffline()) return;

    try {
      await withTimeout(
        supabase
          .from('paper_collections')
          .delete()
          .eq('paper_id', paperId)
          .eq('collection_id', collectionId),
        SUPABASE_TIMEOUT
      );
    } catch (error) {
      console.warn('Could not remove from collection in Supabase:', error);
      markSupabaseUnavailable();
    }
  },

  async getPaperCollections(paperId: string): Promise<Collection[]> {
    if (isSupabaseOffline()) return [];

    try {
      const { data, error } = await withTimeout(
        supabase
          .from('paper_collections')
          .select('collection_id, collections(*)')
          .eq('paper_id', paperId),
        SUPABASE_TIMEOUT
      );
      
      if (error) throw error;
      return data?.map(d => d.collections) || [];
    } catch (error) {
      console.warn('Could not get paper collections from Supabase:', error);
      markSupabaseUnavailable();
      return [];
    }
  }
};
