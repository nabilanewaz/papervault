import React, { useState } from 'react';
import { Collection } from '@/services/collectionService';
import { Plus, X, Folder, FolderOpen } from 'lucide-react';

const PALETTE = [
  '#8B5CF6', '#6366F1', '#EC4899', '#F59E0B',
  '#10B981', '#3B82F6', '#EF4444', '#14B8A6',
];

interface CollectionsPanelProps {
  collections: Collection[];
  selectedCollection: string | null;
  onSelectCollection: (id: string | null) => void;
  onAddCollection: (name: string, color: string) => void;
}

export const CollectionsPanel: React.FC<CollectionsPanelProps> = ({
  collections,
  selectedCollection,
  onSelectCollection,
  onAddCollection,
}) => {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAddCollection(trimmed, color);
    setName('');
    setColor(PALETTE[0]);
    setAdding(false);
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest">Collections</span>
        <button
          onClick={() => setAdding(v => !v)}
          className={`h-6 w-6 rounded-md flex items-center justify-center transition
            ${adding
              ? 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
              : 'bg-violet-50 text-violet-600 hover:bg-violet-100'}`}
          title={adding ? 'Cancel' : 'New collection'}
        >
          {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Inline add form */}
      {adding && (
        <div className="mb-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 space-y-2">
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') { setAdding(false); setName(''); }
            }}
            placeholder="Collection name…"
            className="w-full text-sm bg-white dark:bg-zinc-700 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-600 rounded-lg px-3 py-1.5
              focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 placeholder:text-zinc-300"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {PALETTE.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-5 w-5 rounded-full transition hover:scale-110 ${color === c ? 'ring-2 ring-offset-1 ring-zinc-400' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <button
              onClick={handleSubmit}
              disabled={!name.trim()}
              className="text-xs font-medium px-3 py-1 rounded-lg bg-violet-600 text-white
                hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* All Papers */}
      <button
        onClick={() => onSelectCollection(null)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition mb-1
          ${selectedCollection === null
            ? 'bg-violet-50 text-violet-700 font-medium'
            : 'text-zinc-600 hover:bg-zinc-50'}`}
      >
        {selectedCollection === null
          ? <FolderOpen className="h-4 w-4 text-violet-500 flex-shrink-0" />
          : <Folder className="h-4 w-4 text-zinc-400 flex-shrink-0" />}
        <span className="flex-1 text-left">All Papers</span>
      </button>

      {/* Collection list */}
      {collections.length > 0 && (
        <div className="space-y-0.5">
          {collections.map(c => (
            <button
              key={c.id}
              onClick={() => onSelectCollection(c.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition
                ${selectedCollection === c.id
                  ? 'bg-violet-50 text-violet-700 font-medium'
                  : 'text-zinc-600 hover:bg-zinc-50'}`}
            >
              <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
              <span className="flex-1 text-left truncate">{c.name}</span>
              {c.paperCount != null && c.paperCount > 0 && (
                <span className="text-[10px] text-zinc-400 font-mono">{c.paperCount}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {collections.length === 0 && !adding && (
        <p className="text-[11px] text-zinc-400 text-center py-2">
          No collections yet
        </p>
      )}
    </div>
  );
};
