import React, { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Loader2, Download, ExternalLink, Code, BookOpen, Star, Plus } from 'lucide-react';
import { searchPapers, SearchResult, getCodeRepositories, CodeRepository } from '@/services/paperSearchService';
import { paperService } from '@/services/paperService';
import { useToast } from '@/hooks/use-toast';

const PAGE_SIZE = 10;

interface PaperSearchModalProps {
  open: boolean;
  onClose: () => void;
  onPaperAdded: () => void;
  initialQuery?: string;
}

export function PaperSearchModal({ open, onClose, onPaperAdded, initialQuery = '' }: PaperSearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [source, setSource] = useState<'all' | 'semantic-scholar' | 'arxiv' | 'papers-with-code'>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<SearchResult | null>(null);
  const [codeRepos, setCodeRepos] = useState<CodeRepository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [addingPaper, setAddingPaper] = useState<string | null>(null);
  const { toast } = useToast();

  // Track what was actually searched so Show More uses the same params
  const lastSearch = useRef({ query: '', source: 'all' as typeof source, offset: 0 });

  const handleSearch = useCallback(async (overrideQuery?: string, overrideSource?: string) => {
    const q = (overrideQuery ?? query).trim();
    const src = (overrideSource ?? source) as typeof source;
    if (!q) return;

    setLoading(true);
    setResults([]);
    setHasMore(false);
    setSelectedPaper(null);
    lastSearch.current = { query: q, source: src, offset: 0 };

    try {
      const papers = await searchPapers(q, src, PAGE_SIZE, 0);
      setResults(papers);
      setHasMore(papers.length === PAGE_SIZE);

      if (papers.length === 0) {
        toast({ title: 'No papers found', description: 'Try different search terms' });
      }
    } catch {
      toast({ title: 'Search failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [query, source, toast]);

  const handleLoadMore = useCallback(async () => {
    const { query: q, source: src, offset } = lastSearch.current;
    const newOffset = offset + PAGE_SIZE;
    setLoadingMore(true);

    try {
      const papers = await searchPapers(q, src, PAGE_SIZE, newOffset);
      setResults(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        return [...prev, ...papers.filter(p => !existingIds.has(p.id))];
      });
      setHasMore(papers.length === PAGE_SIZE);
      lastSearch.current.offset = newOffset;
    } catch {
      toast({ title: 'Failed to load more', variant: 'destructive' });
    } finally {
      setLoadingMore(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (open && initialQuery) {
      setQuery(initialQuery);
      setResults([]);
      setHasMore(false);
      const t = setTimeout(() => handleSearch(initialQuery), 150);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuery]);

  const handleViewDetails = async (paper: SearchResult) => {
    setSelectedPaper(paper);
    setCodeRepos([]);
    if (paper.arxiv_id || paper.title) {
      setLoadingRepos(true);
      try {
        const repos = await getCodeRepositories(paper.id, paper.arxiv_id, paper.title);
        setCodeRepos(repos);
      } catch {
        console.error('Failed to fetch repos');
      } finally {
        setLoadingRepos(false);
      }
    }
  };

  const handleAddToLibrary = async (paper: SearchResult) => {
    setAddingPaper(paper.id);
    try {
      await paperService.createPaper({
        title: paper.title,
        authors: paper.authors,
        year: paper.year || new Date().getFullYear(),
        source: paper.source,
        url: paper.url,
        pdf_url: paper.pdf_url,
        abstract: paper.abstract,
        tags: [],
        status: 'to-read',
        progress: 0,
        has_code: paper.has_code || codeRepos.length > 0,
        code_url: paper.code_url || codeRepos[0]?.url,
        citations: paper.citations,
        arxiv_id: paper.arxiv_id,
        doi: paper.doi,
      });
      toast({ title: 'Paper added to library!' });
      onPaperAdded();
    } catch {
      toast({ title: 'Failed to add paper', variant: 'destructive' });
    } finally {
      setAddingPaper(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Search className="h-6 w-6 text-indigo-600" />
            Search Research Papers
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Search for papers (e.g., 'machine learning transformers', 'neural networks')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={() => handleSearch()} disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Search</span>
            </Button>
          </div>

          {/* Source Tabs */}
          <Tabs
            value={source}
            onValueChange={(v) => {
              setSource(v as typeof source);
              if (query.trim()) handleSearch(undefined, v);
            }}
          >
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="all">All Sources</TabsTrigger>
              <TabsTrigger value="semantic-scholar">Semantic Scholar</TabsTrigger>
              <TabsTrigger value="arxiv">arXiv</TabsTrigger>
              <TabsTrigger value="papers-with-code">Papers With Code</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto mt-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
              <span className="ml-3 text-gray-600">Searching across databases...</span>
            </div>
          )}

          {!loading && results.length === 0 && query && (
            <div className="text-center py-12 text-gray-500">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No papers found. Try different search terms.</p>
            </div>
          )}

          {!loading && results.length === 0 && !query && (
            <div className="text-center py-12 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Enter a search query to find research papers</p>
              <p className="text-sm mt-2">Search across Semantic Scholar, arXiv, and Papers With Code</p>
            </div>
          )}

          {selectedPaper ? (
            <div className="bg-white rounded-lg border p-6">
              <Button variant="ghost" onClick={() => setSelectedPaper(null)} className="mb-4">
                ← Back to results
              </Button>

              <h3 className="text-xl font-bold text-gray-900 mb-2">{selectedPaper.title}</h3>
              <p className="text-gray-600 mb-2">{selectedPaper.authors.join(', ')}</p>

              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary">{selectedPaper.source}</Badge>
                {selectedPaper.year && <Badge variant="outline">{selectedPaper.year}</Badge>}
                {selectedPaper.citations && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Star className="h-3 w-3" /> {selectedPaper.citations} citations
                  </Badge>
                )}
              </div>

              {selectedPaper.abstract && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Abstract</h4>
                  <p className="text-gray-700 text-sm leading-relaxed">{selectedPaper.abstract}</p>
                </div>
              )}

              {/* Code Repositories */}
              <div className="mb-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Code className="h-4 w-4" /> Code Repositories
                </h4>
                {loadingRepos ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading repositories...
                  </div>
                ) : codeRepos.length > 0 ? (
                  <div className="space-y-2">
                    {codeRepos.map((repo, idx) => (
                      <a key={idx} href={repo.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 transition">
                        <Code className="h-4 w-4 text-gray-600" />
                        <span className="text-sm text-blue-600 hover:underline flex-1">{repo.url}</span>
                        {repo.stars && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Star className="h-3 w-3" /> {repo.stars}
                          </span>
                        )}
                        {repo.framework && <Badge variant="outline" className="text-xs">{repo.framework}</Badge>}
                      </a>
                    ))}
                  </div>
                ) : selectedPaper.code_url ? (
                  // Fall back to the paper's known code URL when live API can't confirm repos
                  <a href={selectedPaper.code_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 transition">
                    <Code className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-blue-600 hover:underline flex-1">{selectedPaper.code_url}</span>
                  </a>
                ) : (
                  <p className="text-gray-500 text-sm">No code repositories found for this paper</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={() => handleAddToLibrary(selectedPaper)} disabled={addingPaper === selectedPaper.id}>
                  {addingPaper === selectedPaper.id
                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    : <Plus className="h-4 w-4 mr-2" />}
                  Add to Library
                </Button>
                {selectedPaper.pdf_url && (
                  <a href={selectedPaper.pdf_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Download PDF</Button>
                  </a>
                )}
                {selectedPaper.url && (
                  <a href={selectedPaper.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline"><ExternalLink className="h-4 w-4 mr-2" /> View Source</Button>
                  </a>
                )}
              </div>
            </div>
          ) : (
            <>
              {results.map((paper) => (
                <div key={paper.id}
                  className="bg-white rounded-lg border p-4 hover:shadow-md transition cursor-pointer"
                  onClick={() => handleViewDetails(paper)}>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{paper.title}</h3>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-1">
                        {paper.authors.slice(0, 3).join(', ')}
                        {paper.authors.length > 3 && ` +${paper.authors.length - 3} more`}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">{paper.source}</Badge>
                        {paper.year && <Badge variant="outline" className="text-xs">{paper.year}</Badge>}
                        {paper.citations && paper.citations > 0 && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Star className="h-3 w-3" /> {paper.citations}
                          </Badge>
                        )}
                        {paper.has_code && (
                          <Badge className="text-xs bg-green-100 text-green-700">
                            <Code className="h-3 w-3 mr-1" /> Has Code
                          </Badge>
                        )}
                        {paper.pdf_url && (
                          <Badge variant="outline" className="text-xs text-blue-600">PDF Available</Badge>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="outline"
                      onClick={(e) => { e.stopPropagation(); handleAddToLibrary(paper); }}
                      disabled={addingPaper === paper.id}>
                      {addingPaper === paper.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Plus className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ))}

              {/* Show More */}
              {!loading && hasMore && (
                <div className="flex justify-center pt-2 pb-1">
                  <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore} className="w-full max-w-xs">
                    {loadingMore
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading more...</>
                      : 'Show more papers'}
                  </Button>
                </div>
              )}

              {!loading && !hasMore && results.length > 0 && (
                <p className="text-center text-xs text-gray-400 py-2">
                  {results.length} paper{results.length !== 1 ? 's' : ''} shown — no more results
                </p>
              )}
            </>
          )}
        </div>

        <div className="pt-4 border-t text-sm text-gray-500 text-center">
          Searching across Semantic Scholar, arXiv, and Papers With Code
        </div>
      </DialogContent>
    </Dialog>
  );
}
