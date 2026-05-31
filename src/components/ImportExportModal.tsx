import React, { useState, useRef } from 'react';
import { Paper } from '@/types/paper';
import { paperService } from '@/services/paperService';
import { exportToBibTeX, exportToCSV, downloadFile } from '@/utils/exportUtils';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { X, Download, Upload, FileText, Loader2, Search, CheckCircle } from 'lucide-react';

interface Props {
  papers: Paper[];
  onClose: () => void;
  onImported: () => void;
}

interface CrossRefWork {
  title?: string[];
  author?: { given?: string; family?: string }[];
  published?: { 'date-parts'?: number[][] };
  abstract?: string;
  DOI?: string;
  URL?: string;
  'container-title'?: string[];
  'is-referenced-by-count'?: number;
}

async function fetchDOI(doi: string): Promise<Partial<Paper>> {
  const clean = doi.trim().replace(/^https?:\/\/doi\.org\//i, '');
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}`);
  if (!res.ok) throw new Error('DOI not found');
  const data = await res.json();
  const w: CrossRefWork = data.message;
  const year = w.published?.['date-parts']?.[0]?.[0] || new Date().getFullYear();
  const authors = (w.author || []).map(a => [a.given, a.family].filter(Boolean).join(' '));
  return {
    title: w.title?.[0] || 'Unknown title',
    authors: authors.length ? authors : ['Unknown'],
    year,
    abstract: w.abstract?.replace(/<[^>]*>/g, '') || undefined,
    doi: w.DOI,
    url: w.URL || (w.DOI ? `https://doi.org/${w.DOI}` : undefined),
    source: w['container-title']?.[0] || 'DOI Import',
    citations: w['is-referenced-by-count'],
    tags: [],
    status: 'to-read',
    progress: 0,
  };
}

function parseBibTeX(bib: string): Partial<Paper>[] {
  const entries: Partial<Paper>[] = [];
  const entryRe = /@\w+\s*\{[^@]*/g;
  const matches = bib.match(entryRe) || [];

  for (const entry of matches) {
    const getField = (name: string): string => {
      const re = new RegExp(`${name}\\s*=\\s*[{"']([^}"']*)[}"']`, 'i');
      return entry.match(re)?.[1]?.trim() || '';
    };
    const title = getField('title');
    if (!title) continue;
    const authorStr = getField('author');
    const authors = authorStr ? authorStr.split(/\s+and\s+/i).map(s => s.trim()) : ['Unknown'];
    const year = parseInt(getField('year')) || new Date().getFullYear();
    entries.push({
      title,
      authors,
      year,
      abstract: getField('abstract') || undefined,
      doi: getField('doi') || undefined,
      url: getField('url') || (getField('doi') ? `https://doi.org/${getField('doi')}` : undefined),
      source: getField('journal') || getField('booktitle') || 'BibTeX Import',
      tags: [],
      status: 'to-read',
      progress: 0,
    });
  }
  return entries;
}

export const ImportExportModal: React.FC<Props> = ({ papers, onClose, onImported }) => {
  const [tab, setTab] = useState<'export' | 'doi' | 'bibtex'>('export');
  const [doi, setDoi] = useState('');
  const [doiLoading, setDoiLoading] = useState(false);
  const [doiResult, setDoiResult] = useState<Partial<Paper> | null>(null);
  const [doiAdding, setDoiAdding] = useState(false);
  const [bibText, setBibText] = useState('');
  const [bibParsed, setBibParsed] = useState<Partial<Paper>[]>([]);
  const [bibImporting, setBibImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDOILookup = async () => {
    if (!doi.trim()) return;
    setDoiLoading(true);
    setDoiResult(null);
    try {
      const result = await fetchDOI(doi);
      setDoiResult(result);
    } catch {
      toast({ title: 'DOI not found', description: 'Check the DOI and try again', variant: 'destructive' });
    } finally {
      setDoiLoading(false);
    }
  };

  const handleAddDOI = async () => {
    if (!doiResult) return;
    setDoiAdding(true);
    try {
      await paperService.createPaper(doiResult as any);
      toast({ title: 'Paper added to library!' });
      onImported();
      setDoiResult(null);
      setDoi('');
    } catch {
      toast({ title: 'Failed to add paper', variant: 'destructive' });
    } finally {
      setDoiAdding(false);
    }
  };

  const handleBibFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setBibText(text);
      setBibParsed(parseBibTeX(text));
    };
    reader.readAsText(file);
  };

  const handleBibImport = async () => {
    if (!bibParsed.length) return;
    setBibImporting(true);
    let added = 0;
    for (const p of bibParsed) {
      try {
        await paperService.createPaper(p as any);
        added++;
      } catch {
        // skip duplicates / errors
      }
    }
    setBibImporting(false);
    toast({ title: `Imported ${added} of ${bibParsed.length} papers` });
    onImported();
    setBibText('');
    setBibParsed([]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Import / Export</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800">
          {([
            { key: 'export', label: 'Export Library' },
            { key: 'doi',    label: 'DOI Lookup' },
            { key: 'bibtex', label: 'Import BibTeX' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition ${
                tab === t.key
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Export */}
          {tab === 'export' && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">Export your entire library ({papers.length} papers) for use in LaTeX, Zotero, or spreadsheets.</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => downloadFile(exportToBibTeX(papers), 'papervault.bib', 'text/plain')}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition group"
                >
                  <FileText className="h-8 w-8 text-zinc-400 group-hover:text-violet-600" />
                  <div className="text-center">
                    <p className="font-semibold text-zinc-800">BibTeX (.bib)</p>
                    <p className="text-xs text-zinc-500 mt-1">For LaTeX / Overleaf / Zotero</p>
                  </div>
                  <Download className="h-4 w-4 text-zinc-400 group-hover:text-violet-500" />
                </button>
                <button
                  onClick={() => downloadFile(exportToCSV(papers), 'papervault.csv', 'text/csv')}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition group"
                >
                  <FileText className="h-8 w-8 text-zinc-400 group-hover:text-violet-600" />
                  <div className="text-center">
                    <p className="font-semibold text-zinc-800">CSV (.csv)</p>
                    <p className="text-xs text-zinc-500 mt-1">For Excel / Google Sheets</p>
                  </div>
                  <Download className="h-4 w-4 text-zinc-400 group-hover:text-violet-500" />
                </button>
              </div>
            </div>
          )}

          {/* DOI Lookup */}
          {tab === 'doi' && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">Paste a DOI to auto-fill all paper metadata from CrossRef.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={doi}
                  onChange={e => setDoi(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDOILookup()}
                  placeholder="10.1145/3123939.3124540 or https://doi.org/..."
                  className="flex-1 text-sm border border-zinc-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
                <Button onClick={handleDOILookup} disabled={doiLoading || !doi.trim()} className="bg-violet-600 hover:bg-violet-700">
                  {doiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              {doiResult && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-2 bg-zinc-50 dark:bg-zinc-800">
                  <h3 className="font-semibold text-zinc-900 text-sm leading-snug">{doiResult.title}</h3>
                  <p className="text-xs text-zinc-500">{(doiResult.authors || []).join(', ')} · {doiResult.year}</p>
                  {doiResult.abstract && (
                    <p className="text-xs text-zinc-600 line-clamp-3">{doiResult.abstract}</p>
                  )}
                  {doiResult.doi && <p className="text-xs text-zinc-400">DOI: {doiResult.doi}</p>}
                  <Button
                    onClick={handleAddDOI}
                    disabled={doiAdding}
                    className="w-full bg-violet-600 hover:bg-violet-700 mt-2"
                    size="sm"
                  >
                    {doiAdding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    Add to Library
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* BibTeX Import */}
          {tab === 'bibtex' && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500">Upload a <code>.bib</code> file exported from Zotero, Mendeley, or any reference manager.</p>
              <div
                className="border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-zinc-400 mb-2" />
                <p className="text-sm font-medium text-zinc-600">Click to select a .bib file</p>
                <p className="text-xs text-zinc-400 mt-1">or drag and drop</p>
                <input ref={fileRef} type="file" accept=".bib,.txt" className="hidden" onChange={handleBibFile} />
              </div>
              {bibParsed.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-zinc-700">{bibParsed.length} papers found:</p>
                  <div className="max-h-48 overflow-y-auto space-y-1.5">
                    {bibParsed.map((p, i) => (
                      <div key={i} className="text-xs bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-2 border border-zinc-100 dark:border-zinc-700">
                        <p className="font-medium text-zinc-800 line-clamp-1">{p.title}</p>
                        <p className="text-zinc-400">{(p.authors || []).slice(0,2).join(', ')} · {p.year}</p>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={handleBibImport}
                    disabled={bibImporting}
                    className="w-full bg-violet-600 hover:bg-violet-700"
                  >
                    {bibImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Import {bibParsed.length} Papers
                  </Button>
                </div>
              )}
              {bibText && bibParsed.length === 0 && (
                <p className="text-sm text-red-500 text-center">No valid BibTeX entries found in the file.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
