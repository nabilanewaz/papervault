import React, { useState } from 'react';
import { Paper } from '@/types/paper';
import { paperService } from '@/services/paperService';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap, ChevronLeft, ChevronRight, RotateCcw, RefreshCw } from 'lucide-react';

interface Flashcard {
  question: string;
  answer: string;
}

function parseFlashcards(text: string): Flashcard[] {
  const cards: Flashcard[] = [];
  const lines = text.split('\n').filter(l => l.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('Q:')) {
      const question = line.replace(/^Q:\s*/, '').trim();
      const nextLine = lines[i + 1];
      if (nextLine?.startsWith('A:')) {
        const answer = nextLine.replace(/^A:\s*/, '').trim();
        cards.push({ question, answer });
        i++;
      }
    }
  }
  return cards;
}

interface Props {
  paper: Paper;
}

export const FlashcardTab: React.FC<Props> = ({ paper }) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const generate = async () => {
    setLoading(true);
    try {
      const text = paper.abstract
        ? `Title: ${paper.title}\n\nAbstract: ${paper.abstract}`
        : paper.title;
      const raw = await paperService.generateFlashcards(text, paper.id);
      const parsed = parseFlashcards(raw);
      if (parsed.length === 0) throw new Error('No cards parsed');
      setCards(parsed);
      setCurrent(0);
      setFlipped(false);
      setKnown(new Set());
      toast({ title: `${parsed.length} flashcards generated!` });
    } catch {
      toast({ title: 'Failed to generate flashcards', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const go = (dir: 1 | -1) => {
    setFlipped(false);
    setCurrent(c => Math.max(0, Math.min(cards.length - 1, c + dir)));
  };

  const markKnown = () => {
    setKnown(prev => {
      const next = new Set(prev);
      if (next.has(current)) next.delete(current); else next.add(current);
      return next;
    });
  };

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="h-16 w-16 rounded-2xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
          <Zap className="h-8 w-8 text-violet-500" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-1">Generate Study Flashcards</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
            AI will create Q&amp;A cards based on this paper's abstract and key concepts.
          </p>
        </div>
        <Button onClick={generate} disabled={loading} className="bg-violet-600 hover:bg-violet-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
          Generate Flashcards
        </Button>
      </div>
    );
  }

  const card = cards[current];
  const isKnown = known.has(current);
  const knownCount = known.size;

  return (
    <div className="max-w-lg mx-auto space-y-5 py-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{current + 1} / {cards.length}</span>
        <span className="text-emerald-600 font-medium">{knownCount} known</span>
        <button onClick={generate} disabled={loading} className="flex items-center gap-1 hover:text-violet-600 transition">
          <RefreshCw className="h-3 w-3" /> Regenerate
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-zinc-100 rounded-full h-1">
        <div
          className="bg-violet-500 h-full rounded-full transition-all duration-300"
          style={{ width: `${((current + 1) / cards.length) * 100}%` }}
        />
      </div>

      {/* Card */}
      <div
        className={`relative cursor-pointer select-none`}
        style={{ perspective: '1000px' }}
        onClick={() => setFlipped(f => !f)}
      >
        <div
          className="relative w-full transition-all duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            minHeight: '200px',
          }}
        >
          {/* Front */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition
              ${isKnown ? 'border-emerald-300 bg-emerald-50' : 'border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50'}`}
            style={{ backfaceVisibility: 'hidden' }}
          >
            <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest mb-3">Question</p>
            <p className="text-zinc-800 font-medium text-center leading-relaxed">{card.question}</p>
            <p className="text-xs text-zinc-400 mt-4">Click to reveal answer</p>
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-widest mb-3">Answer</p>
            <p className="text-zinc-800 text-center leading-relaxed">{card.answer}</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => go(-1)} disabled={current === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-2">
          <button
            onClick={() => { setFlipped(false); setCurrent(0); setKnown(new Set()); }}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition"
          >
            <RotateCcw className="h-3 w-3" /> Restart
          </button>
          <button
            onClick={markKnown}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition ${
              isKnown
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            {isKnown ? '✓ Known' : 'Mark as known'}
          </button>
        </div>
        <Button variant="outline" size="sm" onClick={() => go(1)} disabled={current === cards.length - 1}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {knownCount === cards.length && (
        <div className="text-center py-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-medium">
          All cards mastered!
        </div>
      )}
    </div>
  );
};
