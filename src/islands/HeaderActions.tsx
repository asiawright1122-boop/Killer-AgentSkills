import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Moon from 'lucide-react/dist/esm/icons/moon';
import Sun from 'lucide-react/dist/esm/icons/sun';
import Menu from 'lucide-react/dist/esm/icons/menu';
import X from 'lucide-react/dist/esm/icons/x';
import Heart from 'lucide-react/dist/esm/icons/heart';
import Globe from 'lucide-react/dist/esm/icons/globe';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down';
import Home from 'lucide-react/dist/esm/icons/home';
import Compass from 'lucide-react/dist/esm/icons/compass';
import Grid3X3 from 'lucide-react/dist/esm/icons/grid-3x3';
import BookOpen from 'lucide-react/dist/esm/icons/book-open';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Terminal from 'lucide-react/dist/esm/icons/terminal';
import Users from 'lucide-react/dist/esm/icons/users';

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
    const [mounted, setMounted] = useState(false);
    const langDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
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

    // Body scroll lock when mobile menu is open
    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMenuOpen]);

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
        document.cookie = `locale=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
        const currentPath = window.location.pathname;
        const newPath = currentPath.replace(
            new RegExp(`^/${locale}(/|$)`),
            `/${newLocale}$1`
        );
        window.location.href = newPath;
    };

    const closeMenu = () => setIsMenuOpen(false);

    const navItems = [
        { href: `/${locale}`, label: labels.home, icon: Home },
        { href: `/${locale}/skills`, label: labels.skills, icon: Compass },
        { href: `/${locale}/categories`, label: labels.categories, icon: Grid3X3 },
        { href: `/${locale}/blog`, label: labels.blog, icon: BookOpen },
        { href: `/${locale}/docs`, label: labels.docs, icon: FileText },
        { href: `/${locale}/cli`, label: labels.cli, icon: Terminal },
        { href: `/${locale}/community`, label: labels.community, icon: Users },
    ];

    // Mobile overlay rendered via portal to escape header's stacking context
    const mobileOverlay = mounted ? createPortal(
        <div
            className={`fixed inset-0 z-[60] md:hidden transition-all duration-300 ease-out ${isMenuOpen
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
                }`}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-white/98 dark:bg-slate-950/98 backdrop-blur-2xl"
                onClick={closeMenu}
            />

            {/* Content */}
            <div
                className={`relative flex flex-col h-full transition-transform duration-300 ease-out ${isMenuOpen ? 'translate-x-0' : 'translate-x-4'
                    }`}
            >
                {/* Overlay header with Logo + Close */}
                <div className="flex items-center justify-between px-6 h-16 shrink-0">
                    <a href={`/${locale}`} onClick={closeMenu} className="flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                            K
                        </div>
                        <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300">
                            Killer-Skills
                        </span>
                    </a>
                    <button
                        onClick={closeMenu}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label={labels.toggleMenu}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Scrollable nav */}
                <div className="flex-1 overflow-y-auto px-4 pb-8">
                    <nav className="flex flex-col gap-1 mt-2">
                        {navItems.map(({ href, label, icon: Icon }) => (
                            <a
                                key={href}
                                href={href}
                                onClick={closeMenu}
                                className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all active:scale-[0.98]"
                            >
                                <Icon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                                {label}
                            </a>
                        ))}
                    </nav>

                    <div className="my-4 mx-4 border-t border-slate-200/80 dark:border-slate-800/50" />

                    {/* Quick actions */}
                    <div className="flex flex-col gap-1">
                        <a
                            href={`/${locale}/favorites`}
                            onClick={closeMenu}
                            className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-medium text-slate-700 dark:text-slate-200 hover:bg-pink-50 dark:hover:bg-pink-900/10 hover:text-pink-600 dark:hover:text-pink-400 transition-all active:scale-[0.98]"
                        >
                            <Heart className="w-5 h-5 text-pink-400 dark:text-pink-500" />
                            {labels.favorites}
                        </a>

                        <button
                            type="button"
                            onClick={toggleTheme}
                            className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-medium text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-900/10 hover:text-amber-600 dark:hover:text-amber-400 transition-all w-full text-left active:scale-[0.98]"
                        >
                            {isDark
                                ? <Moon className="w-5 h-5 text-indigo-400" />
                                : <Sun className="w-5 h-5 text-amber-500" />
                            }
                            <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
                        </button>
                    </div>

                    <div className="my-4 mx-4 border-t border-slate-200/80 dark:border-slate-800/50" />

                    {/* Language Selector */}
                    <div className="px-4">
                        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-3 block uppercase tracking-wider">
                            {labels.language}
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(localeNames).map(([code, name]) => (
                                <button
                                    key={code}
                                    type="button"
                                    onClick={() => switchLanguage(code)}
                                    className={`text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.97] ${code === locale
                                        ? 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800 shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                                        }`}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <>
            <div className="flex items-center gap-2 md:gap-4">
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
                                    type="button"
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
                    className="md:hidden p-2 text-slate-600 dark:text-slate-300"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label={labels.toggleMenu}
                    aria-expanded={isMenuOpen}
                >
                    {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Mobile overlay via portal */}
            {mobileOverlay}
        </>
    );
}
