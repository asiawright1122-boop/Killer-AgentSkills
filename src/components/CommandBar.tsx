import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Command, CornerDownLeft, X, Bot, Star, Terminal } from 'lucide-react';

interface CommandBarProps {
  locale: string;
}

interface SearchResult {
  id: string;
  score: number;
  owner: string;
  repo: string;
  name: string;
  stars: number;
  category: string;
  source: string;
}

export default function CommandBar({ locale }: CommandBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  // Toggle CommandBar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === '/' && !isOpen && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Slight delay to ensure element is mounted before focusing
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = '';
      setQuery('');
      setResults([]);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle Search
  const fetchResults = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&locale=${locale}`);
      if (!res.ok) throw new Error('Search failed');
      const data = (await res.json()) as { results?: SearchResult[] };
      setResults(data.results || []);
      setSelectedIndex(0); // Reset selection on new results
    } catch (error) {
      console.error('CommandBar search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  // Handle Input Change with Debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setLoading(true);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      fetchResults(value);
    }, 300);
  };

  const navigateToResult = (index: number) => {
    if (results.length > 0 && results[index]) {
      const result = results[index];
      window.location.href = `/${locale}/skills/${result.owner}/${result.repo}`;
    }
  };

  // Handle Keyboard Navigation
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      navigateToResult(selectedIndex);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center pt-[10vh] px-4 sm:px-6">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal / Dialog */}
      <div 
        className="relative w-full max-w-2xl bg-[var(--background)] border-[3px] border-[var(--border)] shadow-[12px_12px_0px_0px_var(--border)] overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Search Input Header */}
        <div className="flex items-center px-4 py-4 border-b-4 border-[var(--border)] relative bg-[var(--background)]">
          <Search className="w-6 h-6 text-[var(--foreground)] shrink-0 ml-2" strokeWidth={3} />
          <input
            ref={inputRef}
            className="flex-1 w-full bg-transparent border-none text-lg md:text-xl font-black px-4 py-2 outline-none text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:ring-0 placeholder:font-bold"
            placeholder={locale === 'zh' ? "搜索 AI Skills, 仓库或命令..." : "Search AI Skills, repositories, or commands..."}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            autoComplete="off"
            spellCheck="false"
          />
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] border-2 border-transparent hover:border-[var(--border)] transition-colors shrink-0 mr-1"
          >
            <X className="w-5 h-5" strokeWidth={3} />
          </button>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="absolute top-[72px] left-0 w-full h-[3px] bg-transparent z-10 overflow-hidden">
            <div className="h-full bg-cyan-500 w-1/3 animate-[slide_1s_ease-in-out_infinite]" />
          </div>
        )}

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto min-h-[100px] bg-gray-50/50 dark:bg-[#0c0c0c]/50 p-2">
          {!query.trim() && !loading && (
            <div className="py-14 text-center flex flex-col items-center justify-center opacity-70">
              <Terminal className="w-12 h-12 text-[var(--muted-foreground)] mb-4" strokeWidth={1.5} />
              <p className="text-sm font-mono font-bold text-[var(--muted-foreground)]">
                {locale === 'zh' ? "输入关键词以探索 Agent 宇宙" : "Type to explore the Agent universe"}
              </p>
            </div>
          )}

          {query.trim() && results.length === 0 && !loading && (
            <div className="py-14 text-center flex flex-col items-center justify-center">
              <Bot className="w-12 h-12 text-[var(--muted-foreground)] mb-4 opacity-50" strokeWidth={1.5} />
              <p className="text-[var(--foreground)] font-bold mb-1">
                {locale === 'zh' ? "未找到匹配技能" : "No matching skills found"}
              </p>
              <p className="text-sm text-[var(--muted-foreground)]">
                {locale === 'zh' ? `找不到匹配 "${query}" 的结果` : `We couldn't find anything matching "${query}"`}
              </p>
            </div>
          )}

          {results.length > 0 && (
            <ul className="space-y-1 pb-2">
              {results.map((result, index) => {
                const isSelected = selectedIndex === index;
                return (
                  <li key={result.id}>
                    <button
                      className={`w-full text-left px-4 py-4 flex items-center gap-4 border-2 transition-all ${
                        isSelected 
                          ? 'bg-[var(--foreground)] text-[var(--background)] border-[var(--border)] translate-x-1 shadow-[4px_4px_0px_0px_var(--primary)]' 
                          : 'bg-transparent border-transparent text-[var(--foreground)] hover:bg-[var(--border)] hover:bg-opacity-10'
                      }`}
                      onClick={() => navigateToResult(index)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className={`p-2 border-2 ${isSelected ? 'bg-[var(--background)] text-[var(--foreground)] border-transparent' : 'bg-transparent border-[var(--border)] text-[var(--foreground)]'}`}>
                        <Terminal size={20} strokeWidth={2.5} />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <div className="flex justify-between items-baseline gap-2">
                          <span className="font-black text-base truncate">{result.name}</span>
                          <span className={`text-xs font-mono font-bold tracking-widest uppercase shrink-0 px-1.5 py-0.5 border-2 ${isSelected ? 'border-[var(--background)] opacity-90' : 'border-[var(--border)]'}`}>
                            {result.category || 'Tool'}
                          </span>
                        </div>
                        <div className={`flex items-center gap-3 text-sm font-mono truncate ${isSelected ? 'opacity-90' : 'text-[var(--muted-foreground)]'}`}>
                          <span className="truncate">{result.owner}/{result.repo}</span>
                          <span className="shrink-0 flex items-center gap-1"><Star size={12} strokeWidth={3} /> {result.stars}</span>
                        </div>
                      </div>
                      
                      {isSelected && (
                        <div className="hidden sm:flex shrink-0 ml-2">
                          <CornerDownLeft size={20} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="hidden sm:flex items-center justify-between px-4 py-3 border-t-4 border-[var(--border)] bg-[var(--background)] font-mono text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 min-w-[20px] text-center border-2 border-[var(--border)] bg-[var(--foreground)] text-[var(--background)]">↓</kbd>
              <kbd className="px-1.5 py-0.5 min-w-[20px] text-center border-2 border-[var(--border)] bg-[var(--foreground)] text-[var(--background)]">↑</kbd>
              <span>{locale === 'zh' ? '导航' : 'Navigate'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 min-w-[20px] flex justify-center text-center border-2 border-[var(--border)] bg-[var(--foreground)] text-[var(--background)]">
                <CornerDownLeft size={12} strokeWidth={3} />
              </kbd>
              <span>{locale === 'zh' ? '打开' : 'Open'}</span>
            </span>
          </div>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 min-w-[20px] text-center border-2 border-[var(--border)] bg-[var(--foreground)] text-[var(--background)]">ESC</kbd>
            <span>{locale === 'zh' ? '关闭' : 'Close'}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
