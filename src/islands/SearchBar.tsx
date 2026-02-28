import React, { useState } from 'react';

interface SearchBarProps {
    locale?: string;
    placeholder?: string;
}

export default function SearchBar({ locale = 'en', placeholder }: SearchBarProps) {
    const [query, setQuery] = useState('');

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            window.location.href = `/${locale}/skills?q=${encodeURIComponent(query)}`;
        }
    };

    return (
        <form onSubmit={handleSearch} className="max-w-xl mx-auto relative group">
            {/* Brutalist Solid Shadow Background */}
            <div className="absolute inset-0 bg-[var(--border)] translate-x-1 translate-y-1"></div>

            <div className="relative flex">
                <input
                    type="text"
                    id="skillSearchInput"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={placeholder || "Search for skills (e.g. 'stripe', 'pdf', 'browser')..."}
                    aria-label={placeholder || "Search for skills"}
                    className="block w-full px-6 py-4 text-lg border-2 border-[var(--border)] bg-[var(--background)] focus:outline-none focus:ring-0 focus:border-[var(--primary)] transition-all placeholder:text-[var(--muted-foreground)] text-[var(--foreground)] font-mono font-bold uppercase tracking-wider rounded-none"
                    style={{ borderRadius: 0 }}
                />

                <button
                    type="submit"
                    aria-label={placeholder ? `Search: ${placeholder}` : "Search skills"}
                    className="bg-[var(--primary)] hover:bg-[var(--foreground)] text-[var(--foreground)] hover:text-[var(--background)] px-6 border-y-2 border-r-2 border-[var(--border)] transition-colors cursor-pointer flex items-center justify-center rounded-none"
                    style={{ borderRadius: 0 }}
                >
                    <span className="font-black uppercase tracking-widest hidden sm:inline-block mr-2">RUN</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" className="w-5 h-5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                </button>
            </div>
        </form>
    );
}
