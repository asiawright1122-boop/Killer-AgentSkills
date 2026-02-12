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
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-green-400 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={placeholder || "Search for skills (e.g. 'stripe', 'pdf', 'browser')..."}
                    className="block w-full px-6 py-4 text-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400 text-slate-900 dark:text-white"
                />
                <div className="absolute right-3 top-3">
                    <button type="submit" className="bg-cyan-600 hover:bg-cyan-700 text-white p-2 rounded-lg transition-colors cursor-pointer">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                    </button>
                </div>
            </div>
        </form>
    );
}
