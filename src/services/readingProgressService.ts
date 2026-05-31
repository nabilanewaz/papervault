const READING_PROGRESS_KEY = 'paper_reading_progress';

export type PaperSection =
  | 'abstract'
  | 'introduction'
  | 'methods'
  | 'results'
  | 'discussion'
  | 'conclusion';

export const PAPER_SECTIONS: {
  key: PaperSection;
  label: string;
  description: string;
}[] = [
  { key: 'abstract', label: 'Abstract', description: 'Overview, goals, and main findings' },
  { key: 'introduction', label: 'Introduction', description: 'Background, problem statement, and motivation' },
  { key: 'methods', label: 'Methods', description: 'Methodology, approach, and experimental design' },
  { key: 'results', label: 'Results', description: 'Experimental results and data' },
  { key: 'discussion', label: 'Discussion', description: 'Analysis, implications, and comparison to prior work' },
  { key: 'conclusion', label: 'Conclusion', description: 'Summary, contributions, and future directions' },
];

export interface SectionProgress {
  sections: Record<PaperSection, boolean>;
  lastUpdated: string;
}

const EMPTY_SECTIONS: Record<PaperSection, boolean> = {
  abstract: false,
  introduction: false,
  methods: false,
  results: false,
  discussion: false,
  conclusion: false,
};

function loadAll(): Record<string, SectionProgress> {
  try {
    const data = localStorage.getItem(READING_PROGRESS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, SectionProgress>): void {
  try {
    localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(data));
  } catch {
    // localStorage full — silently ignore
  }
}

function pct(sections: Record<PaperSection, boolean>): number {
  const done = Object.values(sections).filter(Boolean).length;
  return Math.round((done / PAPER_SECTIONS.length) * 100);
}

export const readingProgressService = {
  getProgress(paperId: string): SectionProgress {
    const all = loadAll();
    return (
      all[paperId] ?? {
        sections: { ...EMPTY_SECTIONS },
        lastUpdated: new Date().toISOString(),
      }
    );
  },

  /** Toggle one section and persist. Returns the new completion percentage. */
  updateSection(
    paperId: string,
    section: PaperSection,
    checked: boolean,
  ): number {
    const all = loadAll();
    const current = all[paperId] ?? {
      sections: { ...EMPTY_SECTIONS },
      lastUpdated: '',
    };
    all[paperId] = {
      sections: { ...current.sections, [section]: checked },
      lastUpdated: new Date().toISOString(),
    };
    saveAll(all);
    return pct(all[paperId].sections);
  },

  getCompletionPercentage(paperId: string): number {
    const all = loadAll();
    if (!all[paperId]) return 0;
    return pct(all[paperId].sections);
  },

  /** Returns a map of paperId → completion % for a batch of IDs. */
  getBulkPercentages(paperIds: string[]): Record<string, number> {
    const all = loadAll();
    const result: Record<string, number> = {};
    for (const id of paperIds) {
      result[id] = all[id] ? pct(all[id].sections) : 0;
    }
    return result;
  },
};
