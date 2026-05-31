import React, { useState, useEffect, useCallback } from 'react';
import { Paper } from '../types/paper';
import { PDFViewer } from './PDFViewer';
import { RecommendationsPanel } from './RecommendationsPanel';
import { FlashcardTab } from './FlashcardTab';
import { paperService } from '@/services/paperService';
import { getCodeRepositories, CodeRepository } from '@/services/paperSearchService';
import {
  readingProgressService,
  PAPER_SECTIONS,
  PaperSection,
  SectionProgress,
} from '@/services/readingProgressService';
import { useToast } from '@/hooks/use-toast';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Tabs, TabsContent } from './ui/tabs';
import {
  X, BookOpen, FileText, StickyNote, Code, Sparkles,
  ExternalLink, Star, Calendar, Users, Loader2, Save,
  Github, Download, FolderOpen, CheckSquare, CheckCircle2, Trash2,
  Clock, CreditCard,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Collection } from '@/services/collectionService';
import { indexedDBService } from '@/services/indexedDBService';

interface PaperDetailModalProps {
  paper: Paper;
  collections: Collection[];
  onClose: () => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onPaperAdded?: () => void;
  onProgressChange?: (paperId: string, percentage: number) => void;
  onDelete?: (id: string) => void;
}

export const PaperDetailModal: React.FC<PaperDetailModalProps> = ({
  paper,
  collections,
  onClose,
  onUpdateNotes,
  onPaperAdded,
  onProgressChange,
  onDelete,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'notes' | 'pdf' | 'code' | 'recommendations' | 'checklist' | 'flashcards'>('summary');
  const [notes, setNotes] = useState(paper.notes || '');
  const [saving, setSaving] = useState(false);
  const [codeRepos, setCodeRepos] = useState<CodeRepository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState(paper.collection_id || '');
  const [rating, setRating] = useState(paper.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [paperStatus, setPaperStatus] = useState(paper.status);
  const [dueDate, setDueDate] = useState(paper.due_date ? paper.due_date.substring(0, 10) : '');
  const [sectionProgress, setSectionProgress] = useState<SectionProgress>(
    () => readingProgressService.getProgress(paper.id)
  );
  const { toast } = useToast();

  const completedCount = Object.values(sectionProgress.sections).filter(Boolean).length;
  const completionPct = Math.round((completedCount / PAPER_SECTIONS.length) * 100);

  const handleSectionChange = (section: PaperSection, checked: boolean) => {
    const newPct = readingProgressService.updateSection(paper.id, section, checked);
    setSectionProgress(readingProgressService.getProgress(paper.id));
    if (onProgressChange) onProgressChange(paper.id, newPct);
  };

  const handleStatusChange = async (status: Paper['status']) => {
    setPaperStatus(status);
    try {
      await paperService.updatePaper(paper.id, { status });
      if (onPaperAdded) onPaperAdded();
      toast({ title: `Marked as ${status === 'to-read' ? 'To Read' : status === 'reading' ? 'Reading' : 'Completed'}` });
    } catch {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleRating = async (stars: number) => {
    const newRating = rating === stars ? 0 : stars;
    setRating(newRating);
    await paperService.updatePaper(paper.id, { rating: newRating }).catch(() => {});
  };

  const handleDueDateChange = async (date: string) => {
    setDueDate(date);
    await paperService.updatePaper(paper.id, { due_date: date || undefined }).catch(() => {});
    if (onPaperAdded) onPaperAdded();
  };

  const handleAssignCollection = async (collectionId: string) => {
    setSelectedCollectionId(collectionId);
    try {
      await paperService.updatePaper(paper.id, { collection_id: collectionId || undefined });
      toast({ title: collectionId ? 'Added to collection' : 'Removed from collection' });
      if (onPaperAdded) onPaperAdded();
    } catch {
      toast({ title: 'Failed to update collection', variant: 'destructive' });
    }
  };

  useEffect(() => {
    // Fetch code repositories when code tab is selected
    if (activeTab === 'code' && codeRepos.length === 0 && !loadingRepos) {
      fetchCodeRepositories();
    }
  }, [activeTab]);

  const fetchCodeRepositories = async () => {
    setLoadingRepos(true);
    try {
      const repos = await getCodeRepositories(paper.id, paper.arxiv_id, paper.title);
      setCodeRepos(repos);
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
      // Set default repos based on paper
      setCodeRepos(getDefaultRepos(paper.title));
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await paperService.updatePaper(paper.id, { notes });
      onUpdateNotes(paper.id, notes);
      toast({ title: 'Notes saved!' });
    } catch (error) {
      toast({ title: 'Failed to save notes', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handlePaperAdded = () => {
    if (onPaperAdded) {
      onPaperAdded();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden shadow-2xl flex flex-col" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-6 text-white">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 pr-8">
              <h2 className="text-2xl font-bold mb-2">{paper.title}</h2>
              <div className="flex items-center gap-2 text-white/90 text-sm">
                <Users className="h-4 w-4" />
                <span>{paper.authors.join(', ')}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="text-white/70 hover:text-red-300 p-2 hover:bg-white/10 rounded-full transition">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove paper?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete <span className="font-medium text-gray-900">"{paper.title}"</span> and any locally stored PDF. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => { onDelete(paper.id); onClose(); }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-full transition"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="bg-white/20 text-white border-0">
              <Calendar className="h-3 w-3 mr-1" /> {paper.year}
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white border-0">
              {paper.source}
            </Badge>
            {paper.citations && (
              <Badge variant="secondary" className="bg-white/20 text-white border-0">
                <Star className="h-3 w-3 mr-1" /> {paper.citations} citations
              </Badge>
            )}
            {paper.has_code && (
              <Badge className="bg-green-500/80 text-white border-0">
                <Code className="h-3 w-3 mr-1" /> Has Code
              </Badge>
            )}
            {/* Clickable status selector */}
            <div className="flex gap-1">
              {(['to-read', 'reading', 'completed'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition font-medium ${
                    paperStatus === s
                      ? s === 'completed' ? 'bg-emerald-500 border-emerald-400 text-white'
                        : s === 'reading' ? 'bg-amber-500 border-amber-400 text-white'
                        : 'bg-white/30 border-white/40 text-white'
                      : 'bg-white/10 border-white/20 text-white/60 hover:bg-white/20'
                  }`}
                >
                  {s === 'to-read' ? 'To Read' : s === 'reading' ? 'Reading' : 'Completed'}
                </button>
              ))}
            </div>
          </div>

          {/* Star rating + due date row */}
          <div className="flex flex-wrap items-center gap-4 mt-3">
            <div
              className="flex items-center gap-1"
              onMouseLeave={() => setHoverRating(0)}
            >
              {[1,2,3,4,5].map(star => (
                <button
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onClick={() => handleRating(star)}
                  className="transition-transform hover:scale-110"
                  title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <Star className={`h-4 w-4 transition-colors ${
                    star <= (hoverRating || rating)
                      ? 'fill-amber-300 text-amber-300'
                      : 'text-white/30 hover:text-amber-200'
                  }`} />
                </button>
              ))}
              <span className="text-xs text-white/50 ml-1">{rating ? `${rating}/5` : 'Rate'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-white/60" />
              <span className="text-xs text-white/60">Due:</span>
              <input
                type="date"
                value={dueDate}
                onChange={e => handleDueDateChange(e.target.value)}
                className="bg-white/10 border border-white/20 text-white text-xs rounded-lg px-2 py-1
                  focus:outline-none focus:ring-1 focus:ring-white/40 [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Collection Selector */}
          {collections.length > 0 && (
            <div className="flex items-center gap-2 mt-4">
              <FolderOpen className="h-4 w-4 text-white/70" />
              <select
                value={selectedCollectionId}
                onChange={(e) => handleAssignCollection(e.target.value)}
                className="bg-white/10 border border-white/20 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <option value="" className="text-gray-800">No collection</option>
                {collections.map(c => (
                  <option key={c.id} value={c.id} className="text-gray-800">{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* External Links */}
          <div className="flex gap-2 mt-4">
            {paper.url && (
              <a href={paper.url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                  <ExternalLink className="h-4 w-4 mr-1" /> View Source
                </Button>
              </a>
            )}
            {paper.pdf_url && (
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={async () => {
                  if (paper.pdf_url!.startsWith('idb://')) {
                    const blob = await indexedDBService.getPDF(paper.pdf_url!.replace('idb://', ''));
                    if (!blob) return;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${paper.title}.pdf`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } else {
                    window.open(paper.pdf_url!, '_blank');
                  }
                }}
              >
                <Download className="h-4 w-4 mr-1" /> Download PDF
              </Button>
            )}
            {paper.code_url && (
              <a href={paper.code_url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                  <Github className="h-4 w-4 mr-1" /> View Code
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-gray-200 dark:border-zinc-700 overflow-x-auto scrollbar-none flex-shrink-0">
            <div className="flex flex-nowrap">
              {([
                { value: 'summary',         icon: BookOpen,    label: 'Summary' },
                { value: 'pdf',             icon: FileText,    label: 'PDF' },
                { value: 'notes',           icon: StickyNote,  label: 'Notes' },
                { value: 'code',            icon: Code,        label: 'Code' },
                { value: 'recommendations', icon: Sparkles,    label: 'Related' },
                { value: 'checklist',       icon: CheckSquare, label: 'Checklist' },
                { value: 'flashcards',      icon: CreditCard,  label: 'Flashcards' },
              ] as const).map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setActiveTab(value as any)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === value
                      ? 'border-violet-600 text-violet-700 bg-transparent'
                      : 'border-transparent text-zinc-500 hover:text-zinc-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  {label}
                  {value === 'code' && (codeRepos.length > 0 || paper.has_code) && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{codeRepos.length || 1}</Badge>
                  )}
                  {value === 'checklist' && completionPct > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{completionPct}%</Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <TabsContent value="summary" className="m-0 h-full">
              <div className="space-y-6">
                {paper.abstract && (
                  <div>
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-indigo-600" />
                      Abstract
                    </h3>
                    <p className="text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-lg">
                      {paper.abstract}
                    </p>
                  </div>
                )}
                
                {paper.summary && (
                  <div>
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                      AI Summary
                    </h3>
                    <p className="text-gray-600 leading-relaxed bg-purple-50 p-4 rounded-lg">
                      {paper.summary}
                    </p>
                  </div>
                )}

                {paper.tags && paper.tags.length > 0 && (
                  <div>
                    <h3 className="font-bold text-gray-800 mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {paper.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="bg-indigo-100 text-indigo-700">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {!paper.abstract && !paper.summary && (
                  <div className="text-center py-12 text-gray-500">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No abstract or summary available yet.</p>
                    <p className="text-sm mt-2">Go to PDF Reader tab to generate an AI summary.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="pdf" className="m-0 h-full">
              <PDFViewer
                pdfUrl={paper.pdf_url || ''}
                paperId={paper.id}
                paperTitle={paper.title}
                paperAbstract={paper.abstract}
                initialSummary={paper.summary}
                initialKeyPoints={paper.key_points}
              />
            </TabsContent>

            <TabsContent value="notes" className="m-0 h-full">
              <div className="h-full flex flex-col">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add your notes, insights, key takeaways, and study points...

Tips for CSE students:
• Note down key algorithms and their complexity
• Record implementation details
• List potential applications
• Write questions for further research"
                  className="flex-1 min-h-[400px] p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none font-mono text-sm"
                />
                <div className="flex justify-end mt-4">
                  <Button onClick={handleSaveNotes} disabled={saving}>
                    {saving ? (
                      <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Notes
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="code" className="m-0 h-full">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Github className="h-5 w-5" />
                    Code Repositories
                  </h3>
                  <Button variant="outline" size="sm" onClick={fetchCodeRepositories} disabled={loadingRepos}>
                    {loadingRepos && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Refresh
                  </Button>
                </div>

                {loadingRepos ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    <span className="ml-3 text-gray-600">Searching for code repositories...</span>
                  </div>
                ) : codeRepos.length > 0 ? (
                  <div className="space-y-3">
                    {codeRepos.map((repo, idx) => (
                      <a
                        key={idx}
                        href={repo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <Github className="h-6 w-6 text-gray-700" />
                          <div className="flex-1">
                            <p className="font-medium text-blue-600 hover:underline">{repo.url}</p>
                            {repo.description && (
                              <p className="text-sm text-gray-600 mt-1">{repo.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {repo.stars && (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Star className="h-3 w-3" /> {repo.stars}
                              </Badge>
                            )}
                            {repo.framework && (
                              <Badge variant="secondary">{repo.framework}</Badge>
                            )}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : paper.code_url ? (
                  <a
                    href={paper.code_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <Github className="h-6 w-6 text-gray-700" />
                      <p className="font-medium text-blue-600 hover:underline">{paper.code_url}</p>
                    </div>
                  </a>
                ) : (
                  <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
                    <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No code repositories found for this paper.</p>
                    <p className="text-sm mt-2">Try searching on GitHub or Papers With Code manually.</p>
                    <div className="flex justify-center gap-2 mt-4">
                      <a 
                        href={`https://github.com/search?q=${encodeURIComponent(paper.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          <Github className="h-4 w-4 mr-2" /> Search GitHub
                        </Button>
                      </a>
                      <a 
                        href={`https://paperswithcode.com/search?q=${encodeURIComponent(paper.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          <Code className="h-4 w-4 mr-2" /> Papers With Code
                        </Button>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="recommendations" className="m-0 h-full">
              <RecommendationsPanel
                currentPaper={paper}
                onPaperAdded={handlePaperAdded}
              />
            </TabsContent>

            <TabsContent value="checklist" className="m-0 h-full">
              <div className="space-y-6 max-w-2xl mx-auto">
                {/* Progress header */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-indigo-600" />
                      Reading Checklist
                    </h3>
                    <span className={`text-3xl font-bold ${completionPct === 100 ? 'text-green-600' : 'text-indigo-600'}`}>
                      {completionPct}%
                    </span>
                  </div>
                  <div className="w-full bg-white/70 rounded-full h-3 mb-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        completionPct === 100
                          ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                          : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                      }`}
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">
                    {completedCount} of {PAPER_SECTIONS.length} sections completed
                    {completionPct === 100 && ' — Paper fully read!'}
                  </p>
                </div>

                {/* Section checkboxes */}
                <div className="space-y-3">
                  {PAPER_SECTIONS.map((section, idx) => {
                    const checked = sectionProgress.sections[section.key];
                    return (
                      <div
                        key={section.key}
                        className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 ${
                          checked
                            ? 'bg-green-50 border-green-200'
                            : 'bg-white border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <Checkbox
                            id={`section-${section.key}`}
                            checked={checked}
                            onCheckedChange={(val) => handleSectionChange(section.key, val as boolean)}
                            className={checked ? 'border-green-500 data-[state=checked]:bg-green-500' : ''}
                          />
                        </div>
                        <label
                          htmlFor={`section-${section.key}`}
                          className="flex-1 cursor-pointer min-w-0"
                        >
                          <span className={`font-semibold block ${checked ? 'text-green-800 line-through decoration-green-400' : 'text-gray-800'}`}>
                            {section.label}
                          </span>
                          <span className="text-sm text-gray-500 mt-0.5 block">{section.description}</span>
                        </label>
                        {checked && (
                          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Completion banner */}
                {completionPct === 100 && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 text-center">
                    <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
                    <p className="font-bold text-green-800 text-lg">Paper Fully Read!</p>
                    <p className="text-sm text-green-600 mt-1">
                      Great work. Consider adding notes or exploring related papers next.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="flashcards" className="m-0 h-full">
              <FlashcardTab paper={paper} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

// Default repos based on paper title
function getDefaultRepos(title: string): CodeRepository[] {
  const t = title.toLowerCase();
  
  if (t.includes('transformer') || t.includes('attention')) {
    return [
      { url: 'https://github.com/huggingface/transformers', framework: 'PyTorch', stars: 120000, description: 'State-of-the-art transformers' }
    ];
  }
  
  if (t.includes('bert') || t.includes('language model')) {
    return [
      { url: 'https://github.com/google-research/bert', framework: 'TensorFlow', stars: 37000, description: 'BERT implementation' }
    ];
  }
  
  if (t.includes('resnet') || t.includes('image') || t.includes('vision')) {
    return [
      { url: 'https://github.com/pytorch/vision', framework: 'PyTorch', stars: 15000, description: 'Computer vision models' }
    ];
  }
  
  return [];
}
