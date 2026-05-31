import { useState, useMemo, useEffect } from 'react';
import { SearchBar, SearchFilters } from './SearchBar';
import { PaperCard } from './PaperCard';
import { ProgressTracker } from './ProgressTracker';
import { MotivationWidget } from './MotivationWidget';
import { PaperOfTheDay } from './PaperOfTheDay';
import { CollectionsPanel } from './CollectionsPanel';
import { PaperDetailModal } from './PaperDetailModal';
import { PDFUploadModal } from './PDFUploadModal';
import { PaperSearchModal } from './PaperSearchModal';
import { RecommendationsPanel } from './RecommendationsPanel';
import { ImportExportModal } from './ImportExportModal';
import { ReadingScheduleWidget } from './ReadingScheduleWidget';
import { Paper, ProgressStats } from '../types/paper';
import { paperService } from '@/services/paperService';
import { collectionService, Collection } from '@/services/collectionService';
import { readingProgressService } from '@/services/readingProgressService';
import { isSupabaseOffline } from '@/lib/supabase';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Search, BookOpen, Code, Sparkles, Library,
  GraduationCap, RefreshCw, Globe,
  CheckCircle, BookMarked, WifiOff,
  LogIn, LogOut, User as UserIcon,
  FileDown, Trash2, CheckSquare, Moon, Sun,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/theme-provider';
import { AuthModal } from './AuthModal';

export default function AppLayout() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchModalQuery, setSearchModalQuery] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [activeView, setActiveView] = useState<'all' | 'reading' | 'completed' | 'to-read'>('all');
  const [filters, setFilters] = useState<SearchFilters>({
    source: 'all',
    dateRange: 'all',
    hasCode: false,
    status: 'all'
  });
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [weeklyGoal, setWeeklyGoal] = useState<number>(() => {
    const saved = localStorage.getItem('research_weekly_goal');
    return saved ? parseInt(saved) || 5 : 5;
  });
  const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'year' | 'citations' | 'title' | 'rating'>('date');
  const [importExportOpen, setImportExportOpen] = useState(false);
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();


  useEffect(() => {
    loadPapers();
    loadCollections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    toast({ title: 'Signed out' });
  };

  const loadPapers = async () => {
    setLoading(true);
    try {
      const data = await paperService.getAllPapers();
      setPapers(data);
      setProgressMap(readingProgressService.getBulkPercentages(data.map(p => p.id)));
      setOfflineMode(isSupabaseOffline());
    } catch (error) {
      toast({ title: 'Failed to load papers', variant: 'destructive' });
      setOfflineMode(true);
    } finally {
      setLoading(false);
    }
  };

  const handleProgressChange = (paperId: string, percentage: number) => {
    setProgressMap(prev => ({ ...prev, [paperId]: percentage }));
  };


  const loadCollections = async () => {
    try {
      const data = await collectionService.getAllCollections();
      setCollections(data);
    } catch (error) {
      toast({ title: 'Failed to load collections', variant: 'destructive' });
    }
  };

  const stats: ProgressStats = useMemo(() => {
    // Collect dates where a paper was actively read/completed
    const activeDates = new Set<string>();
    papers.forEach(p => {
      if ((p.status === 'reading' || p.status === 'completed') && p.updated_at) {
        activeDates.add(p.updated_at.substring(0, 10));
      }
    });

    // Count consecutive days ending today (or yesterday if today has no activity yet)
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().substring(0, 10);
      if (activeDates.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    return {
      totalPapers: papers.length,
      completedPapers: papers.filter(p => p.status === 'completed').length,
      readingStreak: streak,
      weeklyGoal,
      weeklyProgress: papers.filter(p =>
        (p.status === 'reading' || p.status === 'completed') &&
        p.updated_at && new Date(p.updated_at) >= oneWeekAgo
      ).length,
      monthlyProgress: papers.length,
    };
  }, [papers, weeklyGoal]);

  const filteredPapers = useMemo(() => {
    const filtered = papers.filter(paper => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = paper.title.toLowerCase().includes(query);
        const matchesAuthors = paper.authors.some(a => a.toLowerCase().includes(query));
        const matchesTags = paper.tags.some(tag => tag.toLowerCase().includes(query));
        const matchesAbstract = paper.abstract?.toLowerCase().includes(query);
        const matchesNotes = paper.notes?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesAuthors && !matchesTags && !matchesAbstract && !matchesNotes) return false;
      }
      if (filters.source !== 'all' && paper.source !== filters.source) return false;
      if (filters.hasCode && !paper.code_url && !paper.has_code) return false;
      if (filters.status && filters.status !== 'all' && paper.status !== filters.status) return false;
      if (activeView !== 'all' && paper.status !== activeView) return false;
      if (selectedCollection && paper.collection_id !== selectedCollection) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'year': return (b.year || 0) - (a.year || 0);
        case 'citations': return (b.citations || 0) - (a.citations || 0);
        case 'title': return a.title.localeCompare(b.title);
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        default: return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
    });
  }, [papers, searchQuery, filters, activeView, selectedCollection, sortBy]);

  const handleSearch = (query: string, newFilters: SearchFilters) => {
    setSearchQuery(query);
    setFilters(newFilters);
  };

  const handleStatusChange = async (id: string, status: Paper['status']) => {
    try {
      await paperService.updatePaper(id, { status });
      setPapers(papers.map(p => p.id === id ? { ...p, status } : p));
      toast({ title: `Paper marked as ${status}` });
    } catch (error) {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleUpdateNotes = (id: string, notes: string) => {
    setPapers(papers.map(p => p.id === id ? { ...p, notes } : p));
    if (selectedPaper?.id === id) {
      setSelectedPaper({ ...selectedPaper, notes });
    }
  };

  const handleAddCollection = (name: string, color: string) => {
    collectionService.createCollection({ name, color })
      .then(() => loadCollections())
      .catch(() => toast({ title: 'Failed to create collection', variant: 'destructive' }));
  };

  const handleRatingChange = (id: string, rating: number) => {
    setPapers(prev => prev.map(p => p.id === id ? { ...p, rating } : p));
  };

  const toggleSelectPaper = (id: string) => {
    setSelectedPapers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedPapers(new Set());

  const bulkStatusChange = async (status: Paper['status']) => {
    await Promise.all([...selectedPapers].map(id => paperService.updatePaper(id, { status })));
    setPapers(prev => prev.map(p => selectedPapers.has(p.id) ? { ...p, status } : p));
    toast({ title: `${selectedPapers.size} papers marked as ${status}` });
    clearSelection();
  };

  const bulkDelete = async () => {
    await Promise.all([...selectedPapers].map(id => paperService.deletePaper(id)));
    setPapers(prev => prev.filter(p => !selectedPapers.has(p.id)));
    toast({ title: `${selectedPapers.size} papers removed` });
    clearSelection();
  };

  const handleDeletePaper = async (id: string) => {
    try {
      await paperService.deletePaper(id);
      setPapers(prev => prev.filter(p => p.id !== id));
      if (selectedPaper?.id === id) setSelectedPaper(null);
      toast({ title: 'Paper removed' });
    } catch (error) {
      toast({ title: 'Failed to delete paper', variant: 'destructive' });
    }
  };

  const CSE_TOPICS = [
    'Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision',
    'Algorithms', 'Distributed Systems', 'Cybersecurity', 'Databases',
    'Cloud Computing', 'Blockchain', 'Quantum Computing', 'Reinforcement Learning',
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">

      {/* ── HERO ───────────────────────────── */}
      <div className="relative overflow-hidden bg-zinc-950 text-white">
        {/* Blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-48 left-1/3 h-[700px] w-[700px] rounded-full bg-violet-600/20 blur-[130px]" />
          <div className="absolute top-1/2 -right-24 h-[500px] w-[500px] rounded-full bg-indigo-500/15 blur-[100px]" />
          <div className="absolute -bottom-24 left-10 h-[400px] w-[400px] rounded-full bg-cyan-500/10 blur-[90px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:64px_64px]" />
        </div>

        {offlineMode && (
          <div className="relative z-10 border-b border-amber-500/30 bg-amber-500/10">
            <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-6 py-2 text-xs text-amber-300">
              <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="font-semibold">Offline Mode</span>
              <span className="text-amber-400/70">—</span>
              <span className="text-amber-300/90">Papers you upload now are saved <span className="font-semibold text-amber-200">only in this browser</span>. Clearing browser data will delete them permanently.</span>
            </div>
          </div>
        )}

        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-6">
          {/* Nav */}
          <div className="mb-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">PaperVault</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Dark mode toggle */}
              <Button
                size="sm" variant="ghost"
                className="text-zinc-400 hover:bg-white/10 hover:text-white"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              {user ? (
                <>
                  <Button size="sm" variant="ghost"
                    className="text-zinc-300 hover:bg-white/10 hover:text-white"
                    onClick={() => navigate('/account')}>
                    <UserIcon className="mr-1.5 h-4 w-4" />
                    {user.name || user.email.split('@')[0]}
                  </Button>
                  <Button size="sm" variant="ghost"
                    className="text-zinc-400 hover:bg-white/10 hover:text-white"
                    onClick={handleSignOut}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button size="sm"
                  className="bg-white text-zinc-900 hover:bg-zinc-100"
                  onClick={() => setAuthModalOpen(true)}>
                  <LogIn className="mr-1.5 h-4 w-4" /> Sign In
                </Button>
              )}
            </div>
          </div>

          {/* Hero text */}
          <div className="mx-auto mb-10 max-w-4xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs text-violet-300">
              <Sparkles className="h-3 w-3" />
              AI-powered research platform for CS students
            </div>
            <h1 className="mb-4 text-6xl font-bold leading-[1.05] tracking-tight md:text-7xl">
              Research,{' '}
              <span className="bg-gradient-to-r from-violet-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent">
                reimagined.
              </span>
            </h1>
            <p className="mx-auto max-w-xl text-lg text-zinc-400">
              Search, annotate, and understand academic papers with AI. Your personal vault for Computer Science research.
            </p>
          </div>

          {/* Search */}
          <div className="mx-auto mb-7 max-w-3xl">
            <SearchBar onSearch={handleSearch} />
            <div className="mt-3 flex flex-wrap gap-2 justify-center">
              {CSE_TOPICS.map(topic => (
                <button key={topic}
                  onClick={() => { setSearchModalQuery(topic); setSearchModalOpen(true); }}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-zinc-300
                    transition-colors hover:border-violet-400/50 hover:bg-violet-500/20 hover:text-violet-200">
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mb-14 flex flex-wrap justify-center gap-3">
            <Button onClick={() => setSearchModalOpen(true)}
              className="bg-violet-600 text-white shadow-lg shadow-violet-500/25 hover:bg-violet-500">
              <Globe className="mr-2 h-4 w-4" /> Search Papers
            </Button>
            <Button variant="outline" onClick={() => setUploadModalOpen(true)}
              className="border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10">
              <Upload className="mr-2 h-4 w-4" /> Upload PDF
            </Button>
            <Button variant="ghost" onClick={loadPapers}
              className="text-zinc-400 hover:bg-white/5 hover:text-white">
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>

          {/* Stats */}
          <div className="mx-auto grid max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
            {([
              { icon: Library,      label: 'Papers',    value: stats.totalPapers,                                      color: 'text-violet-300' },
              { icon: BookOpen,     label: 'Reading',   value: papers.filter(p => p.status === 'reading').length,      color: 'text-amber-300' },
              { icon: CheckCircle,  label: 'Completed', value: stats.completedPapers,                                  color: 'text-emerald-300' },
              { icon: Code,         label: 'With Code', value: papers.filter(p => p.has_code || p.code_url).length,    color: 'text-cyan-300' },
            ] as const).map(({ icon: Icon, label, value, color }) => (
              <div key={label}
                className="rounded-xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm">
                <Icon className={`mx-auto mb-2 h-5 w-5 ${color}`} />
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-xs text-zinc-400">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ───────────────────── */}
      <div className="mx-auto max-w-7xl px-6 py-10 dark:text-zinc-100">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">

          {/* Sidebar */}
          <div className="space-y-5">
            <CollectionsPanel
              collections={collections}
              selectedCollection={selectedCollection}
              onSelectCollection={setSelectedCollection}
              onAddCollection={handleAddCollection}
            />
            <ProgressTracker stats={stats} onGoalChange={setWeeklyGoal} />
            <ReadingScheduleWidget papers={papers} onPaperClick={setSelectedPaper} />
            <MotivationWidget streak={stats.readingStreak} papersThisWeek={stats.weeklyProgress} />
            <PaperOfTheDay papers={papers} onPaperClick={setSelectedPaper} onPaperAdded={loadPapers} />


            {selectedPaper && (
              <RecommendationsPanel currentPaper={selectedPaper} onPaperAdded={loadPapers} />
            )}
          </div>

          {/* Main area */}
          <div className="lg:col-span-3">
            {/* Filter row */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
                <TabsList className="bg-zinc-100">
                  <TabsTrigger value="all">
                    All <Badge variant="secondary" className="ml-1.5 text-[10px]">{papers.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="to-read">
                    <BookMarked className="mr-1.5 h-3.5 w-3.5" />To Read
                  </TabsTrigger>
                  <TabsTrigger value="reading">
                    <BookOpen className="mr-1.5 h-3.5 w-3.5" />Reading
                  </TabsTrigger>
                  <TabsTrigger value="completed">
                    <CheckCircle className="mr-1.5 h-3.5 w-3.5" />Done
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex gap-2 flex-wrap">
                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  className="text-xs border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5
                    bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300
                    focus:outline-none focus:ring-2 focus:ring-violet-300 cursor-pointer"
                >
                  <option value="date">Sort: Date Added</option>
                  <option value="year">Sort: Year</option>
                  <option value="citations">Sort: Citations</option>
                  <option value="rating">Sort: Rating</option>
                  <option value="title">Sort: Title A–Z</option>
                </select>
                <Button variant="outline" size="sm" className="border-zinc-200"
                  onClick={() => setImportExportOpen(true)}>
                  <FileDown className="mr-1.5 h-3.5 w-3.5" /> Import/Export
                </Button>
                <Button variant="outline" size="sm" className="border-zinc-200"
                  onClick={() => setSearchModalOpen(true)}>
                  <Search className="mr-1.5 h-3.5 w-3.5" /> Find Papers
                </Button>
                <Button size="sm" className="bg-violet-600 hover:bg-violet-500"
                  onClick={() => setUploadModalOpen(true)}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload
                </Button>
              </div>
            </div>

            {/* Section heading */}
            <h2 className="mb-5 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {selectedCollection
                ? collections.find(c => c.id === selectedCollection)?.name
                : activeView === 'all'       ? 'All Papers'
                : activeView === 'to-read'   ? 'To Read'
                : activeView === 'reading'   ? 'Currently Reading'
                :                              'Completed Papers'}
              <span className="ml-2 text-base font-normal text-zinc-400">({filteredPapers.length})</span>
            </h2>

            {/* Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-6 w-6 animate-spin text-violet-500" />
                <span className="ml-3 text-sm text-zinc-500">Loading papers…</span>
              </div>
            ) : filteredPapers.length === 0 ? (
              <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-8 py-16 text-center">
                <BookOpen className="mx-auto mb-3 h-12 w-12 text-zinc-200" />
                <h3 className="mb-1 text-lg font-semibold text-zinc-700">No papers yet</h3>
                <p className="mx-auto mb-6 max-w-sm text-sm text-zinc-400">
                  Start building your library by searching for papers or uploading a PDF.
                </p>
                <div className="flex justify-center gap-3">
                  <Button className="bg-violet-600 hover:bg-violet-500"
                    onClick={() => setSearchModalOpen(true)}>
                    <Globe className="mr-2 h-4 w-4" /> Search Papers
                  </Button>
                  <Button variant="outline" onClick={() => setUploadModalOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" /> Upload PDF
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredPapers.map(paper => (
                    <PaperCard
                      key={paper.id}
                      paper={paper}
                      sectionCompletion={progressMap[paper.id] ?? 0}
                      onStatusChange={handleStatusChange}
                      onClick={setSelectedPaper}
                      onDelete={handleDeletePaper}
                      onRatingChange={handleRatingChange}
                      selected={selectedPapers.has(paper.id)}
                      onSelect={toggleSelectPaper}
                    />
                  ))}
                </div>

                {/* Bulk action bar */}
                {selectedPapers.size > 0 && (
                  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40
                    flex items-center gap-2 bg-zinc-900 text-white rounded-2xl px-5 py-3 shadow-2xl
                    border border-zinc-700">
                    <CheckSquare className="h-4 w-4 text-violet-400 mr-1" />
                    <span className="text-sm font-medium mr-3">{selectedPapers.size} selected</span>
                    <button
                      onClick={() => bulkStatusChange('reading')}
                      className="text-xs bg-amber-500 hover:bg-amber-400 px-3 py-1.5 rounded-lg font-medium transition"
                    >Reading</button>
                    <button
                      onClick={() => bulkStatusChange('completed')}
                      className="text-xs bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg font-medium transition"
                    >Completed</button>
                    <button
                      onClick={() => bulkStatusChange('to-read')}
                      className="text-xs bg-zinc-600 hover:bg-zinc-500 px-3 py-1.5 rounded-lg font-medium transition"
                    >To Read</button>
                    <div className="w-px h-5 bg-zinc-700 mx-1" />
                    <button
                      onClick={bulkDelete}
                      className="text-xs bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                    <button
                      onClick={clearSelection}
                      className="text-xs text-zinc-400 hover:text-white ml-2 transition"
                    >✕</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>


      {/* ── FOOTER ─────────────────────────── */}
      <footer className="bg-zinc-950 py-12 text-white">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-600">
                  <GraduationCap className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="font-bold">PaperVault</span>
              </div>
              <p className="text-sm text-zinc-500">
                AI-powered research vault for Computer Science students.
              </p>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-semibold text-zinc-300">Resources</h4>
              <ul className="space-y-1.5 text-sm text-zinc-500">
                <li><a href="https://semanticscholar.org" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Semantic Scholar</a></li>
                <li><a href="https://arxiv.org" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">arXiv</a></li>
                <li><a href="https://paperswithcode.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Papers With Code</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-zinc-800 pt-8 text-center text-xs text-zinc-600">
            PaperVault — Built for CSE Students · Powered by AI
          </div>
        </div>
      </footer>

      {/* ── MODALS ─────────────────────────── */}
      {selectedPaper && (
        <PaperDetailModal
          paper={selectedPaper}
          collections={collections}
          onClose={() => setSelectedPaper(null)}
          onUpdateNotes={handleUpdateNotes}
          onPaperAdded={loadPapers}
          onProgressChange={handleProgressChange}
          onDelete={handleDeletePaper}
        />
      )}
      <PDFUploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => {
          setActiveView('all');
          setSelectedCollection(null);
          loadPapers();
        }}
      />
      <PaperSearchModal
        open={searchModalOpen}
        onClose={() => { setSearchModalOpen(false); setSearchModalQuery(''); }}
        onPaperAdded={loadPapers}
        initialQuery={searchModalQuery}
      />
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
      {importExportOpen && (
        <ImportExportModal
          papers={papers}
          onClose={() => setImportExportOpen(false)}
          onImported={() => { loadPapers(); setImportExportOpen(false); }}
        />
      )}
    </div>
  );
}
