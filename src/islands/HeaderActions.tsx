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

    return (
        <>
            <div className="flex items-center gap-2 md:gap-4">
                {/* Language Selector Dropdown */}
                <div className="relative" ref={langDropdownRef}>
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

                {/* Favorites */}
                <a
                    href={`/${locale}/favorites`}
                    className="hidden md:flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-pink-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    aria-label={labels.favoritesAria}
                >
                    <Heart className="w-5 h-5" />
                </a>



                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-indigo-950 dark:text-slate-400 dark:hover:text-amber-400 transition-colors"
                    aria-label={labels.toggleTheme}
                >
                    {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>

                {/* Mobile Menu Toggle */}
                <button
                    className="md:hidden p-2 text-slate-600 dark:text-slate-300"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label={labels.toggleMenu}
                >
                    {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="absolute top-16 left-0 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 p-6 md:hidden z-50 animate-in slide-in-from-top-2 shadow-xl">
                    <nav className="flex flex-col gap-4">
                        <a href={`/${locale}`} className="text-lg font-medium text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400">{labels.home}</a>
                        <a href={`/${locale}/skills`} className="text-lg font-medium text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400">{labels.skills}</a>
                        <a href={`/${locale}/categories`} className="text-lg font-medium text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400">{labels.categories}</a>
                        <a href={`/${locale}/blog`} className="text-lg font-medium text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400">{labels.blog}</a>
                        <a href={`/${locale}/docs`} className="text-lg font-medium text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400">{labels.docs}</a>
                        <a href={`/${locale}/cli`} className="text-lg font-medium text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400">{labels.cli}</a>
                        <a href={`/${locale}/community`} className="text-lg font-medium text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400">{labels.community}</a>

                        <hr className="border-slate-200 dark:border-slate-800" />

                        <div className="space-y-2">
                            <span className="text-slate-500 text-sm">{labels.language}</span>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(localeNames).map(([code, name]) => (
                                    <button
                                        key={code}
                                        onClick={() => switchLanguage(code)}
                                        className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${code === locale
                                            ? 'bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 font-medium border border-cyan-200 dark:border-cyan-800'
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
                                            }`}
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <hr className="border-slate-200 dark:border-slate-800" />

                        <div className="flex items-center justify-between">
                            <span className="text-slate-500">{labels.theme}</span>
                            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                                <button onClick={() => { if (!isDark) toggleTheme() }} className={`p-1 rounded ${isDark ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}><Moon size={16} /></button>
                                <button onClick={() => { if (isDark) toggleTheme() }} className={`p-1 rounded ${!isDark ? 'bg-white shadow text-slate-900' : 'text-slate-400'}`}><Sun size={16} /></button>
                            </div>
                        </div>

                        <hr className="border-slate-200 dark:border-slate-800" />

                        <a href={`/${locale}/favorites`} className="flex items-center gap-2 text-lg font-medium text-slate-600 dark:text-slate-300">
                            <Heart className="w-5 h-5" /> {labels.favorites}
                        </a>

                    </nav>
                </div>
            )}
        </>
    );
}
