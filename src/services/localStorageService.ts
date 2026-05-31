import { Paper } from '@/types/paper';
import { indexedDBService } from './indexedDBService';

const PAPERS_KEY = 'research_papers';
const COLLECTIONS_KEY = 'research_collections';
const PDF_STORAGE_KEY = 'research_pdfs';

export interface StoredPDF {
  id: string;
  name: string;
  data: string; // Base64 encoded
  size: number;
  uploadedAt: string;
}

export const localStorageService = {
  // Papers
  getAllPapers(): Paper[] {
    try {
      const data = localStorage.getItem(PAPERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  savePaper(paper: Paper): Paper {
    const papers = this.getAllPapers();
    const existingIndex = papers.findIndex(p => p.id === paper.id);
    
    if (existingIndex >= 0) {
      papers[existingIndex] = { ...paper, updated_at: new Date().toISOString() };
    } else {
      papers.unshift({
        ...paper,
        id: paper.id || crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    localStorage.setItem(PAPERS_KEY, JSON.stringify(papers));
    return papers[existingIndex >= 0 ? existingIndex : 0];
  },

  deletePaper(id: string): void {
    const paper = this.getPaperById(id);
    const papers = this.getAllPapers().filter(p => p.id !== id);
    localStorage.setItem(PAPERS_KEY, JSON.stringify(papers));

    // Clean up associated PDF — either in IndexedDB or legacy localStorage
    if (paper?.pdf_url?.startsWith('idb://')) {
      indexedDBService.deletePDF(paper.pdf_url.replace('idb://', ''));
    } else {
      this.deletePDF(id);
    }
  },

  getPaperById(id: string): Paper | null {
    return this.getAllPapers().find(p => p.id === id) || null;
  },

  updatePaper(id: string, updates: Partial<Paper>): Paper | null {
    const papers = this.getAllPapers();
    const index = papers.findIndex(p => p.id === id);
    
    if (index >= 0) {
      papers[index] = { ...papers[index], ...updates, updated_at: new Date().toISOString() };
      localStorage.setItem(PAPERS_KEY, JSON.stringify(papers));
      return papers[index];
    }
    
    return null;
  },

  // PDFs
  async savePDF(file: File, paperId?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        try {
          const pdfs = this.getAllPDFs();
          const id = paperId || crypto.randomUUID();
          
          const storedPDF: StoredPDF = {
            id,
            name: file.name,
            data: reader.result as string,
            size: file.size,
            uploadedAt: new Date().toISOString()
          };
          
          // Check storage quota (roughly 5MB limit per PDF for localStorage)
          if (file.size > 5 * 1024 * 1024) {
            reject(new Error('PDF too large. Maximum size is 5MB for local storage.'));
            return;
          }
          
          // Remove old PDF with same ID if exists
          const filteredPDFs = pdfs.filter(p => p.id !== id);
          filteredPDFs.push(storedPDF);
          
          try {
            localStorage.setItem(PDF_STORAGE_KEY, JSON.stringify(filteredPDFs));
            resolve(storedPDF.data);
          } catch (e) {
            // Storage quota exceeded
            reject(new Error('Storage quota exceeded. Please delete some papers first.'));
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read PDF file'));
      reader.readAsDataURL(file);
    });
  },

  getAllPDFs(): StoredPDF[] {
    try {
      const data = localStorage.getItem(PDF_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  getPDF(id: string): StoredPDF | null {
    return this.getAllPDFs().find(p => p.id === id) || null;
  },

  deletePDF(id: string): void {
    const pdfs = this.getAllPDFs().filter(p => p.id !== id);
    localStorage.setItem(PDF_STORAGE_KEY, JSON.stringify(pdfs));
  },

  // Collections
  getAllCollections(): any[] {
    try {
      const data = localStorage.getItem(COLLECTIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveCollection(collection: any): any {
    const collections = this.getAllCollections();
    const existingIndex = collections.findIndex(c => c.id === collection.id);
    
    if (existingIndex >= 0) {
      collections[existingIndex] = collection;
    } else {
      collections.push({
        ...collection,
        id: collection.id || crypto.randomUUID(),
        created_at: new Date().toISOString()
      });
    }
    
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
    return collections[existingIndex >= 0 ? existingIndex : collections.length - 1];
  },

  deleteCollection(id: string): void {
    const collections = this.getAllCollections().filter(c => c.id !== id);
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
  },

  // Storage info
  getStorageInfo(): { used: number; available: number; percentage: number } {
    const encoder = new TextEncoder();
    let usedBytes = 0;

    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        const value = localStorage.getItem(key) || '';
        usedBytes += encoder.encode(key).length + encoder.encode(value).length;
      }
    }

    const available = 5 * 1024 * 1024; // 5 MB in bytes

    return {
      used: usedBytes,
      available,
      percentage: Math.round((usedBytes / available) * 100)
    };
  },

  // Clear all data
  clearAll(): void {
    localStorage.removeItem(PAPERS_KEY);
    localStorage.removeItem(COLLECTIONS_KEY);
    localStorage.removeItem(PDF_STORAGE_KEY);
  }
};
