import { useState, useEffect, useRef } from 'react';
import { Moon, Sun, Menu, X, Heart, Globe, ChevronDown } from 'lucide-react';

interface HeaderActionsProps {
    locale: string;
    localeNames: Record<string, string>;
    labels: {
        home: string;
        skills: string;
        categories: string;
        docs: string;
        blog: string;
        cli: string;
        community: string;
        language: string;
        theme: string;
        favorites: string;
        github: string;
        // ARIA labels
        switchLanguage: string;
        toggleTheme: string;
        toggleMenu: string;
        favoritesAria: string;
    };
}

export default function HeaderActions({ locale, localeNames, labels }: HeaderActionsProps) {
    const [isDark, setIsDark] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const langDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Sync initial theme
        const isDarkMode = document.documentElement.classList.contains('dark');
        setIsDark(isDarkMode);
    }, []);

    // Close language dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
                setIsLangOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleTheme = () => {
        const newTheme = !isDark ? 'dark' : 'light';
        setIsDark(!isDark);
        localStorage.setItem('theme', newTheme);

        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    const switchLanguage = (newLocale: string) => {
        if (newLocale === locale) {
            setIsLangOpen(false);
            return;
        }

        // Set locale cookie (expires in 1 year)
        document.cookie = `locale=${newLocale};path=/;max-age=31536000;SameSite=Lax`;

        // Replace current locale in URL path with new locale
        const currentPath = window.location.pathname;
        const newPath = currentPath.replace(
            new RegExp(`^/${locale}(/|$)`),
            `/${newLocale}$1`
        );

        window.location.href = newPath;
    };

    const closeMenu = () => setIsMenuOpen(false);

    return (
        <>
            <div className="relative z-50 flex items-center gap-2 md:gap-4">
                {/* Language Selector Dropdown - Desktop */}
                <div className="relative hidden md:block" ref={langDropdownRef}>
                    <button
                        onClick={() => setIsLangOpen(!isLangOpen)}
                        className="p-2 rounded-lg text-slate-500 hover:text-cyan-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 font-medium text-sm"
                        aria-label={labels.switchLanguage}
                        aria-expanded={isLangOpen}
                    >
                        <Globe className="w-4 h-4" />
                        <span className="hidden md:inline">{localeNames[locale] || locale}</span>
                        <ChevronDown className={`w-3 h-3 hidden md:inline transition-transform ${isLangOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isLangOpen && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1 max-h-80 overflow-y-auto">
                            {Object.entries(localeNames).map(([code, name]) => (
                                <button
                                    key={code}
                                    onClick={() => switchLanguage(code)}
                                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${code === locale
                                        ? 'bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 font-medium'
                                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <span>{name}</span>
                                    {code === locale && (
                                        <span className="ml-2 text-cyan-500">✓</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Favorites - Desktop */}
                <a
                    href={`/${locale}/favorites`}
                    className="hidden md:flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-pink-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    aria-label={labels.favoritesAria}
                >
                    <Heart className="w-5 h-5" />
                </a>

                {/* Theme Toggle - Desktop */}
                <button
                    onClick={toggleTheme}
                    className="hidden md:block p-2 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-indigo-950 dark:text-slate-400 dark:hover:text-amber-400 transition-colors"
                    aria-label={labels.toggleTheme}
                >
                    {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>

                {/* Mobile Menu Toggle */}
                <button
                    className="md:hidden p-2 text-slate-600 dark:text-slate-300 z-50 relative"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label={labels.toggleMenu}
                >
                    {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl md:hidden animate-in fade-in slide-in-from-top-5 duration-200">
                    <div className="flex flex-col h-full overflow-y-auto pt-24 pb-8 px-6">
                        <nav className="flex flex-col gap-2">
                            <a
                                href={`/${locale}`}
                                onClick={closeMenu}
                                className="flex items-center gap-4 p-4 rounded-xl text-lg font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-cyan-500"></span>
                                {labels.home}
                            </a>
                            <a
                                href={`/${locale}/skills`}
                                onClick={closeMenu}
                                className="flex items-center gap-4 p-4 rounded-xl text-lg font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-cyan-500"></span>
                                {labels.skills}
                            </a>
                            <a
                                href={`/${locale}/categories`}
                                onClick={closeMenu}
                                className="flex items-center gap-4 p-4 rounded-xl text-lg font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-cyan-500"></span>
                                {labels.categories}
                            </a>
                            <a
                                href={`/${locale}/blog`}
                                onClick={closeMenu}
                                className="flex items-center gap-4 p-4 rounded-xl text-lg font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-cyan-500"></span>
                                {labels.blog}
                            </a>
                            <a
                                href={`/${locale}/docs`}
                                onClick={closeMenu}
                                className="flex items-center gap-4 p-4 rounded-xl text-lg font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-cyan-500"></span>
                                {labels.docs}
                            </a>
                            <a
                                href={`/${locale}/cli`}
                                onClick={closeMenu}
                                className="flex items-center gap-4 p-4 rounded-xl text-lg font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-cyan-500"></span>
                                {labels.cli}
                            </a>
                            <a
                                href={`/${locale}/community`}
                                onClick={closeMenu}
                                className="flex items-center gap-4 p-4 rounded-xl text-lg font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-cyan-500"></span>
                                {labels.community}
                            </a>

                            <div className="my-4 border-t border-slate-200 dark:border-slate-800/50"></div>

                            {/* Favorites Action */}
                            <a
                                href={`/${locale}/favorites`}
                                onClick={closeMenu}
                                className="flex items-center gap-4 p-4 rounded-xl text-lg font-medium text-slate-700 dark:text-slate-200 hover:bg-pink-50 dark:hover:bg-pink-900/10 hover:text-pink-600 dark:hover:text-pink-400 transition-all"
                            >
                                <Heart className="w-5 h-5" />
                                {labels.favorites}
                            </a>

                            {/* Mobile Theme Toggle */}
                            <button
                                onClick={toggleTheme}
                                className="flex items-center gap-4 p-4 rounded-xl text-lg font-medium text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-900/10 hover:text-amber-600 dark:hover:text-amber-400 transition-all w-full text-left"
                            >
                                {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                                <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
                            </button>

                            <div className="my-4 border-t border-slate-200 dark:border-slate-800/50"></div>

                            {/* Mobile Language Selector */}
                            <div className="px-4">
                                <span className="text-sm font-semibold text-slate-400 dark:text-slate-500 mb-3 block uppercase tracking-wider">{labels.language}</span>
                                <div className="grid grid-cols-2 gap-3">
                                    {Object.entries(localeNames).map(([code, name]) => (
                                        <button
                                            key={code}
                                            onClick={() => switchLanguage(code)}
                                            className={`text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${code === locale
                                                ? 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                                                }`}
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </nav>
                    </div>
                </div>
            )}
        </>
    );
}
