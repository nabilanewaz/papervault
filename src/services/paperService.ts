import { supabase, isSupabaseOffline, markSupabaseUnavailable, withTimeout } from '@/lib/supabase';
import { Paper } from '@/types/paper';
import { localStorageService } from './localStorageService';
import { indexedDBService } from './indexedDBService';
import { getCachedUserId } from './authService';

const SUPABASE_TIMEOUT = 4000; // 4 seconds max for any Supabase call

// Filter papers so only the current user's papers (plus legacy papers with no
// owner) are visible. When no user is logged in, only un-owned papers show.
function filterByCurrentUser(papers: Paper[]): Paper[] {
  const userId = getCachedUserId();
  if (!userId) {
    return papers.filter(p => !p.user_id);
  }
  return papers.filter(p => p.user_id === userId || !p.user_id);
}

export const paperService = {
  async getAllPapers(): Promise<Paper[]> {
    // Skip Supabase entirely if we know it's offline
    if (isSupabaseOffline()) {
      return filterByCurrentUser(localStorageService.getAllPapers());
    }

    try {
      const { data, error } = await withTimeout(
        supabase
          .from('papers')
          .select('*')
          .order('created_at', { ascending: false }),
        SUPABASE_TIMEOUT
      );
      
      if (error) throw error;
      
      // Also get local papers and merge
      const localPapers = localStorageService.getAllPapers();
      const allPapers = [...(data || [])];
      
      // Add local papers that aren't in Supabase
      localPapers.forEach(lp => {
        if (!allPapers.find(p => p.id === lp.id)) {
          allPapers.push(lp);
        }
      });
      
      return filterByCurrentUser(allPapers);
    } catch (error) {
      console.warn('Supabase unavailable, using local storage:', error);
      markSupabaseUnavailable();
      return filterByCurrentUser(localStorageService.getAllPapers());
    }
  },


  async getPaperById(id: string): Promise<Paper | null> {
    // Check local storage first (fast)
    const localPaper = localStorageService.getPaperById(id);
    if (localPaper) return localPaper;
    
    // Skip Supabase if offline
    if (isSupabaseOffline()) return null;

    try {
      const { data, error } = await withTimeout(
        supabase
          .from('papers')
          .select('*')
          .eq('id', id)
          .single(),
        SUPABASE_TIMEOUT
      );
      
      if (error) throw error;
      return data;
    } catch (error) {
      markSupabaseUnavailable();
      return null;
    }
  },

  async createPaper(paper: Omit<Paper, 'id' | 'created_at' | 'updated_at'>): Promise<Paper> {
    // Associate the paper with the currently logged-in user (if any)
    const userId = getCachedUserId();
    const paperWithUser = userId ? { ...paper, user_id: userId } : paper;

    // Always save to local storage for reliability
    const newPaper: Paper = {
      ...paperWithUser,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Save locally first
    localStorageService.savePaper(newPaper);

    // Skip Supabase if offline
    if (isSupabaseOffline()) {
      return newPaper;
    }

    // Try Supabase in the background (non-blocking)
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('papers')
          .insert([paperWithUser])
          .select()
          .single(),
        SUPABASE_TIMEOUT
      );
      
      if (error) throw error;
      // Update local storage with the Supabase-generated ID
      if (data) {
        localStorageService.deletePaper(newPaper.id);
        localStorageService.savePaper(data);
        return data;
      }
    } catch (error) {
      console.warn('Supabase unavailable, paper saved locally:', error);
      markSupabaseUnavailable();
    }
    
    return newPaper;
  },

  async updatePaper(id: string, updates: Partial<Paper>): Promise<Paper> {
    // Always update local storage first
    const localPaper = localStorageService.getPaperById(id);
    if (localPaper) {
      const updated = localStorageService.updatePaper(id, updates);
      if (updated) {
        // Try Supabase in background if available
        if (!isSupabaseOffline()) {
          try {
            await withTimeout(
              supabase
                .from('papers')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id),
              SUPABASE_TIMEOUT
            );
          } catch (error) {
            markSupabaseUnavailable();
          }
        }
        return updated;
      }
    }
    
    // If not in local storage, try Supabase
    if (!isSupabaseOffline()) {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from('papers')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single(),
          SUPABASE_TIMEOUT
        );
        
        if (error) throw error;
        return data;
      } catch (error) {
        markSupabaseUnavailable();
      }
    }
    
    // Return a merged paper as fallback
    return { ...localPaper, ...updates, id, updated_at: new Date().toISOString() } as Paper;
  },

  async deletePaper(id: string): Promise<void> {
    // Delete from local storage
    localStorageService.deletePaper(id);
    
    // Try Supabase if available
    if (!isSupabaseOffline()) {
      try {
        await withTimeout(
          supabase
            .from('papers')
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

  async uploadPDF(file: File, paperId?: string): Promise<string> {
    const idbId = paperId || crypto.randomUUID();

    // Always try IndexedDB first for local storage (no size limit issues)
    if (isSupabaseOffline()) {
      await indexedDBService.savePDF(idbId, file);
      return `idb://${idbId}`;
    }

    try {
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data, error } = await withTimeout(
        supabase.storage
          .from('pdfs')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          }),
        10000
      );

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('pdfs')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.warn('Supabase storage unavailable, saving to IndexedDB:', error);
      markSupabaseUnavailable();
      await indexedDBService.savePDF(idbId, file);
      return `idb://${idbId}`;
    }
  },

  // Summarize paper - uses edge function with fast fallback
  async summarizePaper(text: string, paperId: string): Promise<string> {
    // Skip edge function if Supabase is offline
    if (isSupabaseOffline()) {
      return generateFallbackSummary(text);
    }

    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke('summarize-paper', {
          body: { text, paperId, action: 'summarize' }
        }),
        8000 // 8 second timeout for AI operations
      );
      
      if (error) throw error;
      return data.summary || data.error || 'Unable to generate summary.';
    } catch (error) {
      console.warn('Summarization service unavailable, using fallback:', error);
      return generateFallbackSummary(text);
    }
  },

  // Extract key points from paper
  async extractKeyPoints(text: string, paperId: string): Promise<string> {
    if (isSupabaseOffline()) {
      return generateFallbackKeyPoints(text);
    }

    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke('summarize-paper', {
          body: { text, paperId, action: 'extract-key-points' }
        }),
        8000
      );

      if (error) throw error;
      return data.summary || data.error || 'Unable to extract key points.';
    } catch (error) {
      console.warn('Key points extraction service unavailable, using fallback:', error);
      return generateFallbackKeyPoints(text);
    }
  },

  // Generate flashcards from paper content
  async generateFlashcards(text: string, paperId: string): Promise<string> {
    if (isSupabaseOffline()) {
      return generateFallbackFlashcards(text);
    }
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke('summarize-paper', {
          body: { text, paperId, action: 'flashcards' }
        }),
        8000
      );
      if (error) throw error;
      return data.summary || data.error || generateFallbackFlashcards(text);
    } catch {
      return generateFallbackFlashcards(text);
    }
  },

  // Get storage info
  getStorageInfo() {
    return localStorageService.getStorageInfo();
  },

  // Check if using local storage
  isUsingLocalStorage(): boolean {
    return isSupabaseOffline();
  }
};

// Generate fallback summary when AI is unavailable
function generateFallbackSummary(text: string): string {
  const title = typeof text === 'string' ? text.substring(0, 100) : 'this paper';
  
  return `## Summary Unavailable

The AI summarization service is temporarily unavailable. Here are some tips for understanding "${title}":

### How to Read This Paper

1. **Start with the Abstract** - Get a high-level overview of the research
2. **Read the Introduction** - Understand the problem being solved and motivation
3. **Skip to Conclusion** - See the main findings and contributions
4. **Review Figures and Tables** - Visual summaries of key results
5. **Read Related Work** - Understand the context and prior research

### Key Sections to Focus On
- **Methodology/Approach** - How the authors solved the problem
- **Experiments** - What was tested and how
- **Results** - The main findings and metrics
- **Discussion** - Implications and limitations

*Tip: Try again later when the AI service is available for an automated summary.*`;
}

// Generate fallback key points when AI is unavailable
function generateFallbackKeyPoints(text: string): string {
  return `## Key Points Extraction Unavailable

The AI service is temporarily unavailable. Here's how to extract key points manually:

### Look for These Elements:

1. **Problem Statement** - What challenge does this paper address?
2. **Main Contribution** - What's new or novel about this work?
3. **Methodology** - What approach or technique is used?
4. **Key Results** - What are the main experimental findings?
5. **Comparisons** - How does it compare to existing methods?
6. **Limitations** - What are the acknowledged weaknesses?
7. **Future Work** - What directions do the authors suggest?

### Quick Tips:
- Check the **abstract** for a condensed summary
- Look at **section headings** for structure
- Review **bold/italic text** for emphasis
- Examine **figures and tables** for visual summaries
- Read the **conclusion** for main takeaways

*Try again later for AI-powered extraction.*`;
}

function generateFallbackFlashcards(text: string): string {
  return `Q: What is the main research problem this paper addresses?
A: Read the Introduction section to identify the core problem or gap in existing work.

Q: What is the key contribution or novelty of this paper?
A: Check the abstract and conclusion — authors usually state contributions explicitly.

Q: What methodology or approach is used?
A: Look at the Methods/Approach section for the core technique or algorithm.

Q: What dataset or benchmark was used to evaluate the method?
A: Find the Experiments section for dataset names and evaluation metrics.

Q: What were the main quantitative results?
A: Check Tables and Figure captions in the Results section for performance numbers.

Q: How does this method compare to prior work (baselines)?
A: Look for comparison tables in the Experiments section.

Q: What are the stated limitations of this work?
A: Usually found in a Limitations or Discussion section near the end.

Q: What future work do the authors suggest?
A: Check the Conclusion section for suggested directions.`;
}
