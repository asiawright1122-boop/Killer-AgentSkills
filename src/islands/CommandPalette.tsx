import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Search from 'lucide-react/dist/esm/icons/search';
import X from 'lucide-react/dist/esm/icons/x';
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';

interface SkillResult {
  title: string;
  description: string;
  url: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
}

export default function CommandPalette({ isOpen, onClose, locale }: CommandPaletteProps) {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SkillResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock scroll and auto-focus
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = '';
      setTimeout(() => {
        setQuery('');
        setResults([]);
        setSelectedIndex(0);
      }, 300); // Wait for exit animation
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Debounced Search API Hook
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = (await res.json()) as SkillResult[];
          setResults(data.slice(0, 8)); // Top 8 results
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  // Keyboard Navigation Support
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      window.location.href = results[selectedIndex].url;
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Neo-Brutalism Modal Palette */}
      <div className="relative w-full max-w-2xl bg-[var(--background)] border-4 border-[var(--border)] shadow-[8px_8px_0px_0px_var(--border)] overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Input Header */}
        <div className="flex items-center px-4 py-3 border-b-4 border-[var(--border)] bg-[var(--card)]">
          <Search strokeWidth={3} className="w-6 h-6 text-[var(--muted-foreground)] mr-3" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-xl font-black text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
            placeholder={locale === 'zh' ? '搜索技能、工作流与智能体...' : 'Search skills, workflows, agents...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {loading && <Loader2 strokeWidth={3} className="w-5 h-5 animate-spin text-[var(--muted-foreground)] ml-3" />}
          <button onClick={onClose} className="p-1 ml-2 uppercase font-bold text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <X strokeWidth={3} className="w-6 h-6" />
          </button>
        </div>
        
        {/* Results Area */}
        {results.length > 0 && (
          <div className="overflow-y-auto p-2 scrollbar-hide">
            {results.map((result, i) => (
              <a
                key={i}
                href={result.url}
                className={`block p-4 mb-2 border-2 transition-all ${
                  i === selectedIndex 
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] -translate-y-1' 
                    : 'border-transparent hover:bg-[var(--muted)] hover:border-[var(--border)]'
                }`}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="font-black text-lg truncate tracking-tight">{result.title}</div>
                <div className={`text-sm mt-1 line-clamp-1 opacity-90 font-bold ${i === selectedIndex ? 'text-current' : 'text-[var(--muted-foreground)]'}`}>
                  {result.description}
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Empty States */}
        {!loading && query.trim() && results.length === 0 && (
          <div className="p-10 text-center text-lg text-[var(--muted-foreground)] font-black uppercase tracking-widest">
            {locale === 'zh' ? '未找到相关结果，换个词试试？' : 'No results found. Try something else!'}
          </div>
        )}
        {!query.trim() && (
          <div className="p-10 text-center text-[var(--muted-foreground)] font-black">
            <p className="mb-6 uppercase tracking-widest">{locale === 'zh' ? '输入任意关键词检索全库' : 'Type to search the entire database'}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <span className="px-3 py-1 border-2 border-[var(--border)] text-xs text-[var(--foreground)] tracking-wider bg-[var(--card)] shadow-[2px_2px_0px_0px_var(--border)] cursor-pointer hover:-translate-y-0.5" onClick={() => setQuery('UI')}>UI Design</span>
              <span className="px-3 py-1 border-2 border-[var(--border)] text-xs text-[var(--foreground)] tracking-wider bg-[var(--card)] shadow-[2px_2px_0px_0px_var(--border)] cursor-pointer hover:-translate-y-0.5" onClick={() => setQuery('SEO')}>SEO Audit</span>
              <span className="px-3 py-1 border-2 border-[var(--border)] text-xs text-[var(--foreground)] tracking-wider bg-[var(--card)] shadow-[2px_2px_0px_0px_var(--border)] cursor-pointer hover:-translate-y-0.5" onClick={() => setQuery('Python')}>Python</span>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
