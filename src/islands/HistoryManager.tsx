import { useState, useEffect, useCallback } from 'react';
import { Clock, ArrowUpRight, X, Trash2 } from 'lucide-react';
import {
  loadHistory,
  removeFromHistory as removeItem,
  clearHistory as clearAll,
  formatRelativeTime,
  type HistoryItem,
} from '../lib/history';

// ── Props ──────────────────────────────────────────────────────────────────────

interface HistoryManagerProps {
  locale: string;
  translations: {
    browsingHistory: string;
    historyCount: string;     // contains "{count}" placeholder
    clearHistory: string;
    noHistory: string;
    noHistoryHint: string;
    browseSkills: string;
    removeHistory: string;
    time: {
      justNow: string;
      agoM: string;           // contains "{count}" placeholder
      agoH: string;           // contains "{count}" placeholder
      agoD: string;           // contains "{count}" placeholder
    };
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function HistoryManager({ locale, translations: t }: HistoryManagerProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setHistory(loadHistory());
    setIsLoaded(true);
  }, []);

  // Remove a single history entry
  const handleRemove = useCallback((id: string) => {
    setHistory((prev) => removeItem(prev, id));
  }, []);

  // Clear all history
  const handleClear = useCallback(() => {
    clearAll();
    setHistory([]);
  }, []);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const count = history.length;

  return (
    <div className="min-h-[60vh]">
      {/* Page header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a
                href={`/${locale}/skills`}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                aria-label="Back to skills"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              </a>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30">
                  <Clock className="w-6 h-6 text-cyan-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                    {t.browsingHistory}
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t.historyCount.replace('{count}', String(count))}
                  </p>
                </div>
              </div>
            </div>
            {count > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {t.clearHistory}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {count === 0 ? (
          /* ── Empty state ──────────────────────────────────────────────── */
          <div className="text-center py-20">
            <div className="inline-flex p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
              <Clock className="w-12 h-12 text-slate-400 dark:text-slate-500" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              {t.noHistory}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              {t.noHistoryHint}
            </p>
            <a
              href={`/${locale}/skills`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-600 text-white font-medium hover:bg-cyan-700 transition-colors"
            >
              {t.browseSkills}
            </a>
          </div>
        ) : (
          /* ── History grid ─────────────────────────────────────────────── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.map((item) => (
              <HistoryCard
                key={item.id + item.visitedAt}
                item={item}
                locale={locale}
                onRemove={handleRemove}
                removeHistoryLabel={t.removeHistory}
                timeLabels={t.time}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export the type so consumers of this island can use it
export type { HistoryItem };

// ── HistoryCard ────────────────────────────────────────────────────────────────

interface HistoryCardProps {
  item: HistoryItem;
  locale: string;
  onRemove: (id: string) => void;
  removeHistoryLabel: string;
  timeLabels: { justNow: string; agoM: string; agoH: string; agoD: string };
}

function HistoryCard({ item, locale, onRemove, removeHistoryLabel, timeLabels }: HistoryCardProps) {
  const { owner, repo } = item;
  const detailUrl = `/${locale}/skills/${owner}/${repo}`;

  return (
    <a href={detailUrl} className="block group">
      <div className="relative h-full p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300 ease-out hover:border-cyan-400/50 hover:-translate-y-1">
        {/* Remove button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(item.id);
          }}
          className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 text-slate-400"
          title={removeHistoryLabel}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0 pr-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors line-clamp-1">
                {item.name}
              </h3>
              <div className="flex items-center gap-2 mt-2 px-2.5 py-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/50 dark:border-slate-700/50 w-fit transition-colors group-hover:bg-slate-100 dark:group-hover:bg-slate-800 group-hover:border-cyan-200/30 dark:group-hover:border-cyan-800/30">
                <img
                  src={`https://github.com/${owner}.png`}
                  alt={owner}
                  className="w-4 h-4 rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${owner}&background=random`;
                  }}
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {owner}
                </span>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-cyan-500 transition-colors flex-shrink-0" />
          </div>

          {/* Description */}
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2 leading-relaxed">
            {item.description || 'No description available'}
          </p>

          {/* Footer */}
          <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatRelativeTime(item.visitedAt, timeLabels)}</span>
          </div>
        </div>
      </div>
    </a>
  );
}
