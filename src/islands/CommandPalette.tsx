import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, ArrowRight, Server, FileText, X } from 'lucide-react';

interface ResultItem {
  id: string;
  score: number;
  owner: string;
  repo: string;
  name: string;
  category: string;
  stars: number;
  source: string;
}

interface CommandPaletteProps {
  locale: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function CommandPalette({ locale, isOpen: externalIsOpen, onClose }: CommandPaletteProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = (nextState: boolean | ((prev: boolean) => boolean)) => {
    if (typeof nextState === 'function') {
      const stateObj = nextState(isOpen);
      if (onClose && !stateObj) onClose();
      setInternalIsOpen(stateObj);
    } else {
      if (onClose && !nextState) onClose();
      setInternalIsOpen(nextState);
    }
  };
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Toggle Modal on Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Prevent scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Debounced API Search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&locale=${locale}`);
        if (!res.ok) throw new Error('Search failed');
        const data = (await res.json()) as { results: ResultItem[] };
        setResults(data.results || []);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(debounceTimer);
  }, [query, locale]);

  // Handle Keyboard Navigation
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0 && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  // Keep selected item active in scroll view
  useEffect(() => {
    if (!listRef.current || results.length === 0) return;
    const activeChild = listRef.current.children[selectedIndex] as HTMLElement;
    if (activeChild) {
      activeChild.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, results]);

  const handleSelect = (item: ResultItem) => {
    setIsOpen(false);
    window.location.href = `/${locale}/skills/${item.owner}/${item.repo}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex pt-[10vh] items-start justify-center p-4 sm:p-0">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsOpen(false)} />

      <div className="relative w-full max-w-2xl bg-[var(--background)] border-4 border-[var(--foreground)] shadow-[12px_12px_0px_0px_var(--foreground)] overflow-hidden flex flex-col">
        {/* Search Header */}
        <div className="flex items-center border-b-4 border-[var(--foreground)] px-4 py-3 bg-[var(--card)]">
          <Search className="w-6 h-6 text-[var(--foreground)] mr-3 opacity-50" strokeWidth={3} />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none text-xl font-black text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:ring-0 focus:outline-none"
            placeholder="Search agents, skills, workflows..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
          {isLoading && (
            <div className="w-5 h-5 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin ml-3"></div>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="ml-3 p-1 hover:bg-[var(--foreground)] hover:text-[var(--background)] border-2 border-transparent hover:border-[var(--foreground)] transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={3} />
          </button>
        </div>

        {/* Search Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {query.trim() === '' ? (
            <div className="p-8 text-center text-[var(--muted-foreground)] font-bold">
              <Command className="w-12 h-12 mx-auto mb-4 opacity-20" strokeWidth={2} />
              <p className="text-lg">Type something to search...</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <span className="px-3 py-1 bg-[var(--card)] border-2 border-[var(--border)] text-xs uppercase tracking-widest font-black">
                  Trending: C++ Optimization
                </span>
                <span className="px-3 py-1 bg-[var(--card)] border-2 border-[var(--border)] text-xs uppercase tracking-widest font-black">
                  Trending: Python CI/CD
                </span>
                <span className="px-3 py-1 bg-[var(--card)] border-2 border-[var(--border)] text-xs uppercase tracking-widest font-black">
                  Trending: AI Prompt
                </span>
              </div>
            </div>
          ) : results.length === 0 && !isLoading ? (
            <div className="p-8 text-center text-[var(--muted-foreground)] font-bold">
              <p className="text-lg">No results found for "{query}"</p>
              <p className="text-sm mt-2 opacity-70">Try adjusting your generic keywords or category terms.</p>
            </div>
          ) : (
            results.map((item, index) => {
              const isActive = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b-2 border-[var(--border)] cursor-pointer transition-colors ${
                    isActive ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'hover:bg-[var(--muted)]'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2 sm:mb-0">
                    <div
                      className={`p-2 border-2 ${isActive ? 'bg-black text-[var(--primary)] border-black' : 'bg-[var(--background)] border-[var(--foreground)]'}`}
                    >
                      {item.source === 'admin' ? (
                        <Server size={18} strokeWidth={3} />
                      ) : (
                        <FileText size={18} strokeWidth={3} />
                      )}
                    </div>
                    <div>
                      <h4 className="font-black text-lg tracking-tight leading-none mb-1">{item.name}</h4>
                      <p
                        className={`font-mono text-xs font-bold opacity-80 ${isActive ? 'text-black/80' : 'text-[var(--muted-foreground)]'}`}
                      >
                        {item.owner}/{item.repo}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border-2 ${isActive ? 'border-black/50 text-black/80' : 'border-[var(--border)] text-[var(--muted-foreground)]'}`}
                    >
                      {item.category || 'General'}
                    </span>
                    <span
                      className={`font-mono text-xs font-bold flex items-center gap-1 ${isActive ? 'text-black' : 'text-[var(--foreground)]'}`}
                    >
                      {item.score >= 0.8 ? '🔥' : '✨'} {(item.score * 100).toFixed(0)}% Match
                    </span>
                    <ArrowRight
                      className={`w-5 h-5 hidden sm:block ${isActive ? 'opacity-100 translate-x-1' : 'opacity-0'}`}
                      strokeWidth={3}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="border-t-4 border-[var(--foreground)] bg-[var(--card)] p-3 flex items-center justify-between text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 border-2 border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]">
                ↑↓
              </kbd>{' '}
              to Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 border-2 border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]">
                ↵
              </kbd>{' '}
              to Select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 border-2 border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]">
              ESC
            </kbd>{' '}
            to Dismiss
          </span>
        </div>
      </div>
    </div>
  );
}
