import React, { useState } from 'react';
import { ProgressStats } from '../types/paper';
import { Flame, Pencil, Check } from 'lucide-react';

const GOAL_KEY = 'research_weekly_goal';

interface ProgressTrackerProps {
  stats: ProgressStats;
  onGoalChange?: (goal: number) => void;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ stats, onGoalChange }) => {
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(stats.weeklyGoal));

  const completionRate = stats.totalPapers > 0
    ? Math.round((stats.completedPapers / stats.totalPapers) * 100)
    : 0;
  const weeklyRate = Math.min(Math.round((stats.weeklyProgress / stats.weeklyGoal) * 100), 100);

  const commitGoal = () => {
    const val = Math.max(1, Math.min(100, parseInt(goalInput) || stats.weeklyGoal));
    setGoalInput(String(val));
    setEditingGoal(false);
    localStorage.setItem(GOAL_KEY, String(val));
    onGoalChange?.(val);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Progress</h3>
        <div className="flex items-center gap-1 text-xs text-amber-500 font-medium">
          <Flame className="h-3.5 w-3.5" />
          {stats.readingStreak}d streak
        </div>
      </div>

      <div className="space-y-4">
        {/* Overall */}
        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
            <span>Overall</span>
            <span className="font-semibold text-zinc-700">
              {stats.completedPapers} / {stats.totalPapers}
            </span>
          </div>
          <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-violet-500 h-full rounded-full transition-all duration-700"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <div className="text-right text-[10px] text-zinc-400 mt-0.5">{completionRate}%</div>
        </div>

        {/* Weekly */}
        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
            <span>Weekly goal</span>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-zinc-700">{stats.weeklyProgress} /</span>
              {editingGoal ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    type="number"
                    min={1} max={100}
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitGoal(); if (e.key === 'Escape') setEditingGoal(false); }}
                    className="w-10 text-center text-xs border border-violet-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-400"
                  />
                  <button onClick={commitGoal} className="text-violet-600 hover:text-violet-800">
                    <Check className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setGoalInput(String(stats.weeklyGoal)); setEditingGoal(true); }}
                  className="flex items-center gap-0.5 font-semibold text-zinc-700 hover:text-violet-600 group"
                  title="Edit weekly goal"
                >
                  {stats.weeklyGoal}
                  <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
          </div>
          <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-700"
              style={{ width: `${weeklyRate}%` }}
            />
          </div>
          <div className="text-right text-[10px] text-zinc-400 mt-0.5">{weeklyRate}%</div>
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
        <div className="text-center">
          <div className="text-xl font-bold text-violet-600">{stats.monthlyProgress}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">This Month</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-amber-500">{stats.readingStreak}</div>
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">Day Streak</div>
        </div>
      </div>
    </div>
  );
};
