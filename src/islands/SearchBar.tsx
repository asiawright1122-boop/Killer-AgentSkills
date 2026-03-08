import React, { useState, useEffect, useRef } from 'react';
import withErrorBoundary from './withErrorBoundary';

interface SearchBarProps {
  locale?: string;
  placeholder?: string;
  buttonText?: string;
}

interface SearchResult {
  id: string;
  name: string;
  owner: string;
  repo: string;
  category?: string;
  stars?: number;
  score: number;
}

function SearchBar({ locale = 'en', placeholder, buttonText = 'RUN' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click outside handler to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced semantic search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = (await res.json()) as { results?: any[] };
          setResults(data.results || []);
          setIsOpen(true);
        }
      } catch (e) {
        console.error('Search failed', e);
      } finally {
        setIsSearching(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.location.href = `/${locale}/skills?q=${encodeURIComponent(query)}`;
    }
  };

  return (
    <div ref={wrapperRef} className="max-w-xl mx-auto relative group z-50">
      <form onSubmit={handleSearch}>
        {/* Brutalist Solid Shadow Background */}
        <div className="absolute inset-0 bg-[var(--border)] translate-x-1 translate-y-1"></div>

        <div className="relative flex">
          <input
            type="text"
            id="skillSearchInput"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => query.trim() && setIsOpen(true)}
            placeholder={placeholder || "Try: 'find a database tool'"}
            aria-label={placeholder || 'Search for skills'}
            className="block w-full px-6 py-4 text-lg border-2 border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-0 focus:border-[var(--primary)] transition-all placeholder:text-[var(--muted-foreground)] text-[var(--foreground)] font-mono font-bold tracking-wider rounded-none relative z-10"
            style={{ borderRadius: 0 }}
          />

          <button
            type="submit"
            aria-label={placeholder ? `Search: ${placeholder}` : 'Search skills'}
            className="bg-[var(--primary)] hover:bg-[var(--foreground)] text-[var(--foreground)] hover:text-[var(--background)] px-6 border-y-2 border-r-2 border-[var(--border)] transition-colors cursor-pointer flex items-center justify-center rounded-none relative z-10"
            style={{ borderRadius: 0 }}
          >
            <span className="font-black tracking-widest whitespace-nowrap hidden sm:inline-block mr-2">
              {buttonText}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="square"
              strokeLinejoin="miter"
              className="w-5 h-5 flex-shrink-0"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>
        </div>
      </form>

      {/* AI Semantic Search Results Dropdown */}
      {isOpen && query.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-3 border-2 border-[var(--border)] bg-[var(--background)] shadow-[4px_4px_0px_0px_var(--border)] max-h-96 overflow-y-auto">
          {isSearching ? (
            <div className="p-6 text-center text-[var(--muted-foreground)] font-mono animate-pulse flex items-center justify-center gap-3">
              <span className="text-xl">🤖</span> AI Semantic Search...
            </div>
          ) : results.length > 0 ? (
            <ul className="flex flex-col">
              {results.map((r, _i) => (
                <li key={r.id} className={`border-b-2 border-[var(--border)] last:border-b-0`}>
                  <a
                    href={`/${locale}/skills/${r.owner}/${r.repo}`}
                    className="flex items-center justify-between p-4 hover:bg-[var(--primary)] hover:text-[var(--foreground)] transition-colors group"
                  >
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-bold truncate text-lg group-hover:text-black">{r.name}</span>
                      <span className="text-sm opacity-70 truncate font-mono mt-1 group-hover:text-black">
                        {r.owner}/{r.repo} {r.category ? `• ${r.category}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {r.stars !== undefined && (
                        <span className="text-sm font-bold flex items-center bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-500 px-2 py-1 rounded">
                          ★ {r.stars}
                        </span>
                      )}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6 text-center text-[var(--muted-foreground)] font-mono">No semantic matches found.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default withErrorBoundary(SearchBar);
