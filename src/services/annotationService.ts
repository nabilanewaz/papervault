const KEY = 'paper_annotations';

export interface AnnotationRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Annotation {
  id: string;
  paperId: string;
  page: number;
  selectedText: string;
  comment?: string;
  color: string;
  rects: AnnotationRect[];
  createdAt: string;
}

function getAll(): Annotation[] {
  try {
    const data = localStorage.getItem(KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveAll(annotations: Annotation[]): void {
  localStorage.setItem(KEY, JSON.stringify(annotations));
}

export const annotationService = {
  getAnnotations(paperId: string): Annotation[] {
    return getAll().filter(a => a.paperId === paperId);
  },

  addAnnotation(data: Omit<Annotation, 'id' | 'createdAt'>): Annotation {
    const all = getAll();
    const annotation: Annotation = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    all.push(annotation);
    saveAll(all);
    return annotation;
  },

  updateComment(id: string, comment: string): void {
    const all = getAll();
    const idx = all.findIndex(a => a.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], comment };
      saveAll(all);
    }
  },

  deleteAnnotation(id: string): void {
    saveAll(getAll().filter(a => a.id !== id));
  },

  deleteAllForPaper(paperId: string): void {
    saveAll(getAll().filter(a => a.paperId !== paperId));
  },
};
