import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  MessageSquare, Highlighter, Trash2, X, PanelRightClose, PanelRightOpen,
  Loader2,
} from 'lucide-react';
import { annotationService, Annotation } from '@/services/annotationService';
import { useToast } from '@/hooks/use-toast';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const COLORS = [
  { name: 'Yellow', bg: '#FACC15', overlay: 'rgba(250,204,21,0.45)' },
  { name: 'Green',  bg: '#4ADE80', overlay: 'rgba(74,222,128,0.4)' },
  { name: 'Blue',   bg: '#60A5FA', overlay: 'rgba(96,165,250,0.4)' },
  { name: 'Pink',   bg: '#F472B6', overlay: 'rgba(244,114,182,0.4)' },
  { name: 'Orange', bg: '#FB923C', overlay: 'rgba(251,146,60,0.4)' },
];

interface SelectionState {
  text: string;
  rects: { x: number; y: number; width: number; height: number }[];
  page: number;
  popupX: number;
  popupY: number;
}

interface PDFInlineViewerProps {
  pdfUrl: string;
  paperId: string;
}

export function PDFInlineViewer({ pdfUrl, paperId }: PDFInlineViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setAnnotations(annotationService.getAnnotations(paperId));
  }, [paperId]);

  const handleLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoadError(false);
  };

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;

    const range = sel.getRangeAt(0);
    const container = pageRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) return;

    const containerRect = container.getBoundingClientRect();
    const clientRects = Array.from(range.getClientRects()).filter(r => r.width > 0);
    if (clientRects.length === 0) return;

    const rects = clientRects.map(r => ({
      x: (r.left - containerRect.left) / containerRect.width,
      y: (r.top - containerRect.top) / containerRect.height,
      width: r.width / containerRect.width,
      height: r.height / containerRect.height,
    }));

    const last = clientRects[clientRects.length - 1];
    setSelection({
      text: sel.toString().trim(),
      rects,
      page: currentPage,
      popupX: Math.min(last.right, window.innerWidth - 300),
      popupY: last.bottom + 8,
    });
    setCommentDraft('');
  }, [currentPage]);

  const saveHighlight = (colorOverlay: string) => {
    if (!selection) return;
    const ann = annotationService.addAnnotation({
      paperId,
      page: selection.page,
      selectedText: selection.text,
      comment: commentDraft.trim() || undefined,
      color: colorOverlay,
      rects: selection.rects,
    });
    setAnnotations(prev => [...prev, ann]);
    setSelection(null);
    setCommentDraft('');
    window.getSelection()?.removeAllRanges();
    toast({ title: 'Highlight saved' });
  };

  const deleteAnnotation = (id: string) => {
    annotationService.deleteAnnotation(id);
    setAnnotations(prev => prev.filter(a => a.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const saveComment = (id: string) => {
    annotationService.updateComment(id, editDraft);
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, comment: editDraft } : a));
    setEditingId(null);
  };

  const pageAnnotations = annotations.filter(a => a.page === currentPage);

  return (
    <div className="flex border rounded-lg overflow-hidden bg-gray-100" style={{ height: 700 }}>
      {/* ── PDF pane ───────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Toolbar */}
        <div className="bg-white border-b px-3 py-2 flex items-center gap-3 flex-shrink-0 flex-wrap">
          {/* Page nav */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-gray-600 min-w-[64px] text-center">
              {currentPage} / {numPages || '—'}
            </span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
              onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage >= numPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="w-px h-4 bg-gray-200" />

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
              onClick={() => setScale(s => Math.max(0.5, +(s - 0.15).toFixed(2)))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-gray-600 w-10 text-center">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
              onClick={() => setScale(s => Math.min(3, +(s + 0.15).toFixed(2)))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <div className="w-px h-4 bg-gray-200" />

          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Highlighter className="h-3 w-3" /> Select text to highlight
          </span>

          <div className="ml-auto flex items-center gap-2">
            {annotations.length > 0 && (
              <Badge variant="secondary" className="text-xs">{annotations.length}</Badge>
            )}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
              onClick={() => setShowSidebar(s => !s)}
              title={showSidebar ? 'Hide annotations' : 'Show annotations'}>
              {showSidebar
                ? <PanelRightClose className="h-4 w-4" />
                : <PanelRightOpen className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* PDF canvas */}
        <div className="flex-1 overflow-auto">
          <div className="flex justify-center p-4">
            <div ref={pageRef} className="relative select-text" onMouseUp={handleMouseUp}>
              <Document
                file={pdfUrl}
                onLoadSuccess={handleLoadSuccess}
                onLoadError={() => setLoadError(true)}
                loading={
                  <div className="flex flex-col items-center justify-center gap-3 py-24 px-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                    <span className="text-sm text-gray-500">Loading PDF…</span>
                  </div>
                }
                error={
                  <div className="py-16 px-8 text-center text-gray-500">
                    <p className="font-medium text-red-500 mb-2">Could not load PDF</p>
                    <p className="text-sm">The file may be corrupted or unsupported.</p>
                  </div>
                }
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  renderTextLayer
                  renderAnnotationLayer={false}
                />
              </Document>

              {/* Highlight overlay */}
              <div className="absolute inset-0 pointer-events-none">
                {pageAnnotations.map(ann =>
                  ann.rects.map((rect, i) => (
                    <div
                      key={`${ann.id}-${i}`}
                      className="absolute rounded-sm"
                      style={{
                        left: `${rect.x * 100}%`,
                        top: `${rect.y * 100}%`,
                        width: `${rect.width * 100}%`,
                        height: `${rect.height * 100}%`,
                        backgroundColor: ann.color,
                        mixBlendMode: 'multiply',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setActiveId(ann.id);
                        setShowSidebar(true);
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Annotations sidebar ────────────────── */}
      {showSidebar && (
        <div className="w-72 bg-white border-l flex flex-col flex-shrink-0">
          <div className="px-3 py-2.5 border-b flex items-center justify-between">
            <span className="font-semibold text-sm text-gray-800 flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-indigo-500" />
              Annotations
            </span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowSidebar(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {annotations.length === 0 ? (
              <div className="px-4 py-10 text-center text-gray-400">
                <Highlighter className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No annotations yet</p>
                <p className="text-xs mt-1">Select any text in the PDF to highlight it</p>
              </div>
            ) : (
              <div className="divide-y">
                {annotations.map(ann => (
                  <div
                    key={ann.id}
                    className={`p-3 cursor-pointer transition ${activeId === ann.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                    onClick={() => { setCurrentPage(ann.page); setActiveId(ann.id); }}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: ann.color }} />
                          <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                            Page {ann.page}
                          </span>
                        </div>

                        <p className="text-xs text-gray-700 leading-relaxed line-clamp-3 pl-2"
                          style={{ borderLeft: `3px solid ${ann.color}` }}>
                          {ann.selectedText}
                        </p>

                        {/* Comment */}
                        {editingId === ann.id ? (
                          <div className="mt-2 space-y-1" onClick={e => e.stopPropagation()}>
                            <Textarea
                              value={editDraft}
                              onChange={e => setEditDraft(e.target.value)}
                              className="text-xs h-16 resize-none"
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveComment(ann.id); } }}
                            />
                            <div className="flex gap-1">
                              <Button size="sm" className="h-6 text-xs flex-1" onClick={() => saveComment(ann.id)}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : ann.comment ? (
                          <p className="text-xs text-indigo-600 mt-1.5 flex items-start gap-1 cursor-text"
                            onClick={e => { e.stopPropagation(); setEditingId(ann.id); setEditDraft(ann.comment ?? ''); }}>
                            <MessageSquare className="h-3 w-3 flex-shrink-0 mt-0.5" />
                            {ann.comment}
                          </p>
                        ) : (
                          <button
                            className="text-xs text-gray-400 hover:text-indigo-500 mt-1.5 flex items-center gap-1 transition"
                            onClick={e => { e.stopPropagation(); setEditingId(ann.id); setEditDraft(''); }}>
                            <MessageSquare className="h-3 w-3" /> Add note
                          </button>
                        )}
                      </div>

                      <button
                        className="text-gray-300 hover:text-red-500 transition flex-shrink-0 mt-0.5"
                        onClick={e => { e.stopPropagation(); deleteAnnotation(ann.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* ── Selection popup ────────────────────── */}
      {selection && (
        <div
          className="fixed z-50 bg-white rounded-xl shadow-2xl border p-3 w-72"
          style={{ left: selection.popupX, top: selection.popupY }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
              <Highlighter className="h-3 w-3 text-indigo-500" /> Add Highlight
            </span>
            <button onClick={() => { setSelection(null); window.getSelection()?.removeAllRanges(); }}>
              <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>

          <p className="text-[11px] text-gray-500 bg-gray-50 rounded p-1.5 mb-2 line-clamp-2">
            "{selection.text.slice(0, 120)}{selection.text.length > 120 ? '…' : ''}"
          </p>

          {/* Color picker — clicking immediately saves */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-gray-400">Color:</span>
            {COLORS.map(c => (
              <button
                key={c.bg}
                className="h-6 w-6 rounded-full border-2 border-transparent hover:scale-110 transition"
                style={{ backgroundColor: c.bg }}
                title={c.name}
                onClick={() => saveHighlight(c.overlay)}
              />
            ))}
          </div>

          <Textarea
            placeholder="Add a note (optional) — Enter to save"
            value={commentDraft}
            onChange={e => setCommentDraft(e.target.value)}
            className="text-xs h-14 resize-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveHighlight(COLORS[0].overlay);
              }
            }}
          />
          <Button size="sm" className="w-full mt-2 h-7 text-xs"
            onClick={() => saveHighlight(COLORS[0].overlay)}>
            Save (yellow)
          </Button>
        </div>
      )}
    </div>
  );
}
