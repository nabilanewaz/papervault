import React from 'react';
import { Paper } from '@/types/paper';
import { Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  papers: Paper[];
  onPaperClick: (paper: Paper) => void;
}

export const ReadingScheduleWidget: React.FC<Props> = ({ papers, onPaperClick }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const scheduled = papers
    .filter(p => p.due_date && p.status !== 'completed')
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
    .slice(0, 5);

  if (scheduled.length === 0) return null;

  const getLabel = (iso: string) => {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, overdue: true };
    if (diff === 0) return { text: 'Due today', overdue: false };
    if (diff === 1) return { text: 'Due tomorrow', overdue: false };
    return { text: `Due in ${diff}d`, overdue: false };
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4 text-violet-500" />
        <span className="text-xs font-semibold text-zinc-700 uppercase tracking-widest">Reading Schedule</span>
      </div>
      <div className="space-y-2">
        {scheduled.map(paper => {
          const { text, overdue } = getLabel(paper.due_date!);
          return (
            <button
              key={paper.id}
              onClick={() => onPaperClick(paper)}
              className="w-full text-left flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-zinc-50 transition group"
            >
              {overdue
                ? <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                : <Calendar className="h-4 w-4 text-violet-400 flex-shrink-0 mt-0.5" />}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-800 line-clamp-1 group-hover:text-violet-700 transition-colors">
                  {paper.title}
                </p>
                <p className={`text-[10px] font-medium mt-0.5 ${overdue ? 'text-red-500' : 'text-violet-500'}`}>
                  {text}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
