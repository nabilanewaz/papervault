import React from 'react';
import { Flame } from 'lucide-react';

const QUOTES = [
  { text: "Research is creating new knowledge.", author: "Neil Armstrong" },
  { text: "The important thing is not to stop questioning. Curiosity has its own reason for existing.", author: "Albert Einstein" },
  { text: "Science knows no country, because knowledge belongs to humanity.", author: "Louis Pasteur" },
  { text: "In science, there are no shortcuts to truth.", author: "Karl Popper" },
  { text: "No great discovery was ever made without a bold guess.", author: "Isaac Newton" },
  { text: "The measure of intelligence is the ability to change.", author: "Albert Einstein" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
  { text: "Research is what I'm doing when I don't know what I'm doing.", author: "Wernher von Braun" },
  { text: "Every great advance in science has issued from a new audacity of imagination.", author: "John Dewey" },
  { text: "Somewhere, something incredible is waiting to be known.", author: "Carl Sagan" },
  { text: "The good thing about science is that it's true whether or not you believe in it.", author: "Neil deGrasse Tyson" },
  { text: "It's not that I'm so smart, it's just that I stay with problems longer.", author: "Albert Einstein" },
  { text: "Imagination is more important than knowledge.", author: "Albert Einstein" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "Education is not the filling of a pail, but the lighting of a fire.", author: "W.B. Yeats" },
  { text: "To read without reflecting is like eating without digesting.", author: "Edmund Burke" },
  { text: "What we know is a drop, what we don't know is an ocean.", author: "Isaac Newton" },
  { text: "Science is organized knowledge. Wisdom is organized life.", author: "Immanuel Kant" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "Consistency is what transforms average into excellence.", author: "Anonymous" },
  { text: "The only way to discover the limits of the possible is to go beyond them into the impossible.", author: "Arthur C. Clarke" },
  { text: "If we knew what it was we were doing, it would not be called research, would it?", author: "Albert Einstein" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "A person who never made a mistake never tried anything new.", author: "Albert Einstein" },
  { text: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch" },
  { text: "Equipped with his five senses, man explores the universe around him and calls the adventure Science.", author: "Edwin Hubble" },
  { text: "The strength of a theory is what it forbids.", author: "Richard Feynman" },
  { text: "Study hard what interests you the most in the most undisciplined, irreverent and original manner possible.", author: "Richard Feynman" },
  { text: "The greatest enemy of knowledge is not ignorance, it is the illusion of knowledge.", author: "Stephen Hawking" },
  { text: "Genius is one percent inspiration and ninety-nine percent perspiration.", author: "Thomas Edison" },
  { text: "The cure for boredom is curiosity. There is no cure for curiosity.", author: "Dorothy Parker" },
  { text: "Science and everyday life cannot and should not be separated.", author: "Rosalind Franklin" },
  { text: "Do not go where the path may lead, go instead where there is no path and leave a trail.", author: "Ralph Waldo Emerson" },
  { text: "The universe is under no obligation to make sense to you.", author: "Neil deGrasse Tyson" },
  { text: "Real knowledge is to know the extent of one's ignorance.", author: "Confucius" },
];

function getDayIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

interface MotivationWidgetProps {
  streak: number;
  papersThisWeek: number;
}

export const MotivationWidget: React.FC<MotivationWidgetProps> = ({ streak, papersThisWeek }) => {
  const quote = QUOTES[getDayIndex() % QUOTES.length];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold mb-0.5">
            Quote of the Day
          </p>
          <p className="text-[11px] text-zinc-400">{today}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-amber-500 font-medium">
          <Flame className="h-3.5 w-3.5" />
          {streak}d
        </div>
      </div>

      <div className="relative pl-3 mb-4">
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-violet-200 rounded-full" />
        <p className="text-sm text-zinc-700 leading-relaxed italic">"{quote.text}"</p>
        <p className="text-[11px] text-zinc-400 mt-1">— {quote.author}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-zinc-100">
        <div className="text-center">
          <div className="text-xl font-bold text-violet-600">{streak}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">Day Streak</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-amber-500">{papersThisWeek}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">This Week</div>
        </div>
      </div>
    </div>
  );
};
