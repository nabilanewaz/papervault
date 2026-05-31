import React, { useState } from 'react';
import { Paper } from '../types/paper';
import { paperService } from '@/services/paperService';
import { Button } from './ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog';
import {
  BookOpen, CheckCircle, Clock, Code, MoreVertical,
  ExternalLink, Trash2, Star, FileText, Github, Calendar,
} from 'lucide-react';

interface PaperCardProps {
  paper: Paper;
  sectionCompletion?: number;
  onStatusChange: (id: string, status: Paper['status']) => void;
  onClick: (paper: Paper) => void;
  onDelete?: (id: string) => void;
  onRatingChange?: (id: string, rating: number) => void;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

const STATUS_CONFIG = {
  'to-read':   { dot: 'bg-zinc-400',    label: 'To Read',   leftBar: 'border-l-zinc-300' },
  'reading':   { dot: 'bg-amber-400',   label: 'Reading',   leftBar: 'border-l-amber-400' },
  'completed': { dot: 'bg-emerald-500', label: 'Completed', leftBar: 'border-l-emerald-500' },
} as const;

export function PaperCard({ paper, sectionCompletion = 0, onStatusChange, onClick, onDelete, onRatingChange, selected, onSelect }: PaperCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const cfg = STATUS_CONFIG[paper.status];

  const handleRating = async (e: React.MouseEvent, stars: number) => {
    e.stopPropagation();
    await paperService.updatePaper(paper.id, { rating: stars });
    onRatingChange?.(paper.id, stars);
  };

  return (
    <>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove paper?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{' '}
              <span className="font-medium text-zinc-900">"{paper.title}"</span>{' '}
              and any locally stored PDF. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => onDelete!(paper.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div
        className={`group bg-white dark:bg-zinc-900 border border-l-4 ${cfg.leftBar}
          rounded-2xl overflow-hidden cursor-pointer
          hover:-translate-y-1.5 hover:shadow-xl hover:shadow-zinc-900/[0.06]
          transition-all duration-300
          ${selected ? 'border-violet-400 ring-2 ring-violet-300' : 'border-zinc-100 dark:border-zinc-800'}`}
        onClick={() => onClick(paper)}
      >
        <div className="p-5">
          {/* Status row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              {onSelect && (
                <input
                  type="checkbox"
                  checked={selected ?? false}
                  onChange={e => { e.stopPropagation(); onSelect(paper.id); }}
                  onClick={e => e.stopPropagation()}
                  className="h-3.5 w-3.5 rounded border-zinc-300 accent-violet-600 mr-0.5"
                />
              )}
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
                {cfg.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {paper.due_date && (
                <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                  <Calendar className="h-3 w-3" />
                  {new Date(paper.due_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                </span>
              )}
              <span className="text-[11px] font-mono text-zinc-300">{paper.year}</span>
            </div>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm leading-snug mb-1.5 line-clamp-2
            group-hover:text-violet-700 dark:group-hover:text-violet-400 transition-colors duration-200">
            {paper.title}
          </h3>

          {/* Authors */}
          <p className="text-[11px] text-zinc-400 mb-3 line-clamp-1">
            {paper.authors.slice(0, 3).join(', ')}
            {paper.authors.length > 3 && ` +${paper.authors.length - 3}`}
          </p>

          {/* Tags */}
          {paper.tags && paper.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {paper.tags.slice(0, 3).map(tag => (
                <span key={tag}
                  className="px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded text-[10px] font-medium">
                  {tag}
                </span>
              ))}
              {paper.tags.length > 3 && (
                <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-400 rounded text-[10px]">
                  +{paper.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Reading progress */}
          {sectionCompletion > 0 && (
            <div className="mb-3">
              <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                <span>Progress</span>
                <span className={sectionCompletion === 100 ? 'text-emerald-500 font-semibold' : ''}>
                  {sectionCompletion}%
                </span>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-1">
                <div
                  className={`h-1 rounded-full transition-all duration-500 ${
                    sectionCompletion === 100 ? 'bg-emerald-500' : 'bg-violet-500'
                  }`}
                  style={{ width: `${sectionCompletion}%` }}
                />
              </div>
            </div>
          )}

          {/* Star rating */}
          <div
            className="flex items-center gap-0.5 mb-3"
            onClick={e => e.stopPropagation()}
            onMouseLeave={() => setHoverRating(0)}
          >
            {[1,2,3,4,5].map(star => (
              <button
                key={star}
                onMouseEnter={() => setHoverRating(star)}
                onClick={e => handleRating(e, paper.rating === star ? 0 : star)}
                className="transition-transform hover:scale-110"
                title={`Rate ${star} star${star > 1 ? 's' : ''}`}
              >
                <Star
                  className={`h-3.5 w-3.5 transition-colors ${
                    star <= (hoverRating || paper.rating || 0)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-zinc-200 hover:text-amber-200'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800"
            onClick={e => e.stopPropagation()}
          >
            {/* Meta chips */}
            <div className="flex items-center gap-2.5">
              {paper.citations != null && paper.citations > 0 && (
                <span className="text-[11px] text-zinc-400 flex items-center gap-0.5">
                  <Star className="h-3 w-3" /> {paper.citations.toLocaleString()}
                </span>
              )}
              {(paper.has_code || paper.code_url) && (
                <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-0.5">
                  <Code className="h-3 w-3" /> Code
                </span>
              )}
              {paper.pdf_url && (
                <span className="text-[11px] text-blue-500 flex items-center gap-0.5">
                  <FileText className="h-3 w-3" /> PDF
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5">
              {paper.url && (
                <a href={paper.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-zinc-100 rounded-lg">
                    <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
                  </Button>
                </a>
              )}
              {paper.code_url && (
                <a href={paper.code_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-zinc-100 rounded-lg">
                    <Github className="h-3.5 w-3.5 text-zinc-400" />
                  </Button>
                </a>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-zinc-100 rounded-lg">
                    <MoreVertical className="h-3.5 w-3.5 text-zinc-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-sm">
                  <DropdownMenuItem onClick={() => onStatusChange(paper.id, 'to-read')}>
                    <Clock className="h-4 w-4 mr-2 text-zinc-400" /> To Read
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatusChange(paper.id, 'reading')}>
                    <BookOpen className="h-4 w-4 mr-2 text-amber-400" /> Reading
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onStatusChange(paper.id, 'completed')}>
                    <CheckCircle className="h-4 w-4 mr-2 text-emerald-500" /> Completed
                  </DropdownMenuItem>
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-500 focus:text-red-600"
                        onClick={() => setConfirmOpen(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Remove
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
