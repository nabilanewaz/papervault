export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number;
  source: string;
  url?: string;
  pdf_url?: string;
  abstract?: string;
  tags: string[];
  status: 'to-read' | 'reading' | 'completed';
  progress: number;
  has_code?: boolean;
  code_url?: string;
  notes?: string;
  summary?: string;
  key_points?: string;
  citations?: number;
  arxiv_id?: string;
  doi?: string;
  collection_id?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  rating?: number;       // 1–5 stars
  due_date?: string;     // ISO date string for reading schedule
}

export interface ProgressStats {
  totalPapers: number;
  completedPapers: number;
  readingStreak: number;
  weeklyGoal: number;
  weeklyProgress: number;
  monthlyProgress: number;
}

export interface CodeRepository {
  url: string;
  framework?: string;
  stars?: number;
  description?: string;
}

export interface SearchFilters {
  source: 'all' | 'semantic-scholar' | 'arxiv' | 'papers-with-code';
  dateRange: 'all' | 'week' | 'month' | 'year';
  hasCode: boolean;
  sortBy?: 'relevance' | 'date' | 'citations';
}
