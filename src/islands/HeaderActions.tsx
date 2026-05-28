import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Moon,
  Sun,
  Menu,
  X,
  Heart,
  Globe,
  ChevronDown,
  Home,
  Compass,
  Grid3X3,
  BookOpen,
  Users,
  Layers,
  Rocket,
} from 'lucide-react';
import SubmitSkillModal from './SubmitSkillModal';

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
    collections: string;
    language: string;
    theme: string;
    favorites: string;
    github: string;
    // ARIA labels
    switchLanguage: string;
    toggleTheme: string;
    toggleMenu: string;
    favoritesAria: string;
    darkMode?: string;
    lightMode?: string;
    submitSkill: string;
    search: string;
  };
}

export default function HeaderActions({ locale, localeNames, labels }: HeaderActionsProps) {
  const [isDark, setIsDark] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const updateThemeIcon = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');
      setIsDark(isDarkMode);
    };
    updateThemeIcon();

    document.addEventListener('astro:after-swap', updateThemeIcon);
    return () => document.removeEventListener('astro:after-swap', updateThemeIcon);
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

  useEffect(() => {
    const handleNavigation = () => {
      setIsMenuOpen(false);
      setIsLangOpen(false);
    };

    document.addEventListener('astro:after-swap', handleNavigation);
    window.addEventListener('popstate', handleNavigation);

    return () => {
      document.removeEventListener('astro:after-swap', handleNavigation);
      window.removeEventListener('popstate', handleNavigation);
    };
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
      setIsMenuOpen(false);
      setIsLangOpen(false);
      return;
    }
    setIsMenuOpen(false);
    setIsLangOpen(false);
    document.body.style.overflow = '';
    document.cookie = `locale=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
    const currentPath = window.location.pathname;
    const newPath = currentPath.replace(new RegExp(`^/${locale}(/|$)`), `/${newLocale}$1`);
    window.location.href = newPath;
  };

  const closeMenu = () => setIsMenuOpen(false);

  const navItems = [
    { href: `/${locale}`, label: labels.home, icon: Home },
    { href: `/${locale}/skills`, label: labels.skills, icon: Compass },
    { href: `/${locale}/collections`, label: labels.collections || 'Collections', icon: Layers },
    { href: `/${locale}/categories`, label: labels.categories, icon: Grid3X3 },
    { href: `/${locale}/blog`, label: labels.blog, icon: BookOpen },
    { href: `/${locale}/community`, label: labels.community, icon: Users },
  ];

  // Mobile overlay rendered via portal to escape header's stacking context
  const mobileOverlay = mounted
    ? createPortal(
        <div
          data-testid="mobile-menu-overlay"
          data-state={isMenuOpen ? 'open' : 'closed'}
          aria-hidden={!isMenuOpen}
          className={`fixed inset-0 z-[60] md:hidden transition-all duration-150 ease-out ${
            isMenuOpen ? 'visible opacity-100 pointer-events-auto' : 'invisible opacity-0 pointer-events-none'
          }`}
        >
          {/* Backdrop: Solid background instead of blur for Neo-Brutalist feel */}
          <div className="absolute inset-0 bg-[var(--background)] opacity-95" onClick={closeMenu} />

          {/* Content: Sharp bordered panel */}
          <div
            data-testid="mobile-menu-panel"
            className={`absolute right-4 top-4 bottom-4 left-16 border-[3px] border-[var(--border)] bg-[var(--card)] shadow-[8px_8px_0px_0px_var(--border)] flex flex-col transition-transform duration-200 ease-out ${
              isMenuOpen ? 'translate-x-0 translate-y-0' : 'translate-x-full translate-y-4'
            }`}
          >
            {/* Overlay header with stark Logo + Close */}
            <div className="flex items-center justify-between px-6 h-16 shrink-0 border-b-[3px] border-[var(--border)] bg-[var(--background)]">
              <a href={`/${locale}`} onClick={closeMenu} className="flex items-center gap-3 group">
                <div className="w-8 h-8 flex items-center justify-center bg-[var(--primary)] border-2 border-[var(--border)] text-[var(--primary-foreground)] font-black text-xs shadow-[2px_2px_0px_0px_var(--border)]">
                  KS
                </div>
                <span className="font-black text-xl tracking-tight uppercase text-[var(--foreground)]">
                  Killer-Skills
                </span>
              </a>
              <button
                onClick={closeMenu}
                className="p-2.5 border-2 border-transparent hover:border-[var(--border)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] text-[var(--foreground)] transition-colors"
                aria-label={labels.toggleMenu}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable nav */}
            <div className="flex-1 overflow-y-auto bg-[var(--background)] flex flex-col">
              <nav className="flex flex-col border-b-[3px] border-[var(--border)]">
                {navItems.map(({ href, label, icon: Icon }) => (
                  <a
                    key={href}
                    href={href}
                    onClick={closeMenu}
                    className="flex items-center gap-4 px-6 py-4 text-[16px] font-bold uppercase text-[var(--foreground)] border-b last:border-b-0 border-[var(--border)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] transition-colors"
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {label}
                  </a>
                ))}
              </nav>

              {/* Quick actions */}
              <div className="flex flex-col border-b-[3px] border-[var(--border)] bg-[var(--card)]">
                <button
                  onClick={() => {
                    closeMenu();
                    setIsSubmitOpen(true);
                  }}
                  className="flex items-center gap-4 px-6 py-4 text-[16px] font-black uppercase tracking-widest text-[#000000] bg-emerald-400 border-[3px] border-[var(--border)] shadow-[4px_4px_0px_0px_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_var(--border)] transition-all m-4 mt-2"
                >
                  <Rocket className="w-5 h-5 flex-shrink-0" />
                  {labels.submitSkill}
                </button>
                <a
                  href={`/${locale}/favorites`}
                  onClick={closeMenu}
                  className="flex items-center gap-4 px-6 py-4 text-[16px] font-bold uppercase text-[var(--foreground)] border-b border-[var(--border)] hover:bg-[#ff003c] hover:text-white transition-colors"
                >
                  <Heart className="w-5 h-5 flex-shrink-0" />
                  {labels.favorites}
                </a>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex items-center gap-4 px-6 py-4 text-[16px] font-bold uppercase text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors w-full text-left"
                >
                  {isDark ? <Moon className="w-5 h-5 flex-shrink-0" /> : <Sun className="w-5 h-5 flex-shrink-0" />}
                  <span>{isDark ? labels.darkMode || 'Dark Mode' : labels.lightMode || 'Light Mode'}</span>
                </button>
              </div>

              {/* Language Selector */}
              <div className="p-6 bg-[var(--background)] flex-1">
                <span className="text-xs font-bold text-[var(--muted-foreground)] mb-4 block font-mono">
                  // {labels.language}
                </span>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(localeNames).map(([code, name]) => (
                    <button
                      key={code}
                      type="button"
                      data-testid={`mobile-locale-option-${code}`}
                      onClick={() => switchLanguage(code)}
                      className={`text-left px-4 py-3 text-sm font-black uppercase border-2 transition-all ${
                        code === locale
                          ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--border)] shadow-[2px_2px_0px_0px_var(--border)] translate-x-[-2px] translate-y-[-2px]'
                          : 'bg-[var(--card)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--foreground)] hover:text-[var(--background)]'
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
        document.body,
      )
    : null;

  return (
    <>
      <div
        className="flex items-center gap-2 md:gap-4"
        data-testid="header-actions"
        data-mounted={mounted ? 'true' : 'false'}
      >
        {/* Language Selector Dropdown - Desktop */}
        <div className="relative hidden md:block" ref={langDropdownRef}>
          <button
            onClick={() => setIsLangOpen(!isLangOpen)}
            data-testid="desktop-locale-toggle"
            className="px-3 py-1.5 border-2 border-transparent hover:border-[var(--border)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] text-[var(--foreground)] transition-colors flex items-center gap-2 font-black uppercase text-sm tracking-wide shrink-0 whitespace-nowrap"
            aria-label={labels.switchLanguage}
            aria-expanded={isLangOpen}
          >
            <Globe className="w-4 h-4" />
            <span className="hidden md:inline">{localeNames[locale] || locale}</span>
            <ChevronDown
              className={`w-4 h-4 hidden md:inline transition-transform duration-100 ${isLangOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isLangOpen && (
            <div className="absolute right-0 top-full mt-2 w-[340px] bg-[var(--background)] border-4 border-[var(--border)] shadow-[8px_8px_0px_0px_var(--border)] z-50 p-3 font-black uppercase text-xs sm:text-sm grid grid-cols-2 gap-2">
              {Object.entries(localeNames).map(([code, name]) => (
                <button
                  key={code}
                  type="button"
                  data-testid={`desktop-locale-option-${code}`}
                  onClick={() => switchLanguage(code)}
                  className={`w-full text-left px-3 py-2 border-2 transition-all flex items-center justify-between ${
                    code === locale
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--border)] translate-x-[-2px] translate-y-[-2px] shadow-[2px_2px_0px_0px_var(--border)]'
                      : 'bg-[var(--card)] text-[var(--foreground)] border-[var(--border)] hover:bg-[var(--foreground)] hover:text-[var(--background)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[2px_2px_0px_0px_var(--border)]'
                  }`}
                >
                  <span className="truncate">{name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Submit Skill - Desktop */}
        <button
          onClick={() => setIsSubmitOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 py-2 border-2 border-[var(--border)] bg-[#00ffcc] text-black hover:bg-emerald-400 transition-all font-black uppercase tracking-widest text-sm shadow-[3px_3px_0px_0px_var(--border)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_var(--border)] whitespace-nowrap shrink-0"
          aria-label={labels.submitSkill}
        >
          <Rocket className="w-4 h-4" />
          <span>{labels.submitSkill}</span>
        </button>

        {/* Favorites - Desktop */}
        <a
          href={`/${locale}/favorites`}
          className="hidden md:flex items-center justify-center p-2 border-2 border-transparent hover:border-[var(--border)] hover:bg-[#ff003c] text-[var(--foreground)] hover:text-white transition-colors"
          aria-label={labels.favoritesAria}
        >
          <Heart className="w-5 h-5" />
        </a>

        {/* Theme Toggle - Desktop */}
        <button
          onClick={toggleTheme}
          className="hidden md:block p-2 border-2 border-transparent hover:border-[var(--border)] hover:bg-[var(--foreground)] hover:text-[var(--background)] text-[var(--foreground)] transition-colors"
          aria-label={labels.toggleTheme}
        >
          {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>

        {/* Mobile Menu Toggle */}
        <button
          data-testid="mobile-menu-toggle"
          className="md:hidden p-2.5 border-2 border-transparent hover:border-[var(--border)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] text-[var(--foreground)] transition-colors"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={labels.toggleMenu}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile overlay via portal */}
      {mobileOverlay}

      {/* Submit Skill Modal */}
      <SubmitSkillModal isOpen={isSubmitOpen} onClose={() => setIsSubmitOpen(false)} locale={locale} />
    </>
  );
}
