import { useState, useEffect, useCallback } from 'react';
import { Heart, ArrowUpRight, X } from 'lucide-react';
import {
  loadFavorites,
  removeFavorite as removeFav,
  type FavoriteSkill,
} from '../lib/favorites';

// ── Props ──────────────────────────────────────────────────────────────────────

interface FavoritesManagerProps {
  locale: string;
  translations: {
    myFavorites: string;
    favoritesCount: string;   // contains "{count}" placeholder
    noFavorites: string;
    noFavoritesHint: string;
    browseSkills: string;
    removeFavorite: string;
    savedAt: string;          // contains "{date}" placeholder
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function FavoritesManager({ locale, translations: t }: FavoritesManagerProps) {
  const [favorites, setFavorites] = useState<FavoriteSkill[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setFavorites(loadFavorites());
    setIsLoaded(true);
  }, []);

  // Remove a favorite
  const handleRemove = useCallback((id: string) => {
    setFavorites((prev) => removeFav(prev, id));
  }, []);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const count = favorites.length;

  return (
    <div className="min-h-[60vh]">
      {/* Page header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <a
              href={`/${locale}/skills`}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              aria-label="Back to skills"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </a>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-pink-500/20 border border-pink-500/30">
                <Heart className="w-6 h-6 text-pink-500 fill-pink-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {t.myFavorites}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t.favoritesCount.replace('{count}', String(count))}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {count === 0 ? (
          /* ── Empty state ──────────────────────────────────────────────── */
          <div className="text-center py-20">
            <div className="inline-flex p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
              <Heart className="w-12 h-12 text-slate-400 dark:text-slate-500" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              {t.noFavorites}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              {t.noFavoritesHint}
            </p>
            <a
              href={`/${locale}/skills`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-600 text-white font-medium hover:bg-cyan-700 transition-colors"
            >
              {t.browseSkills}
            </a>
          </div>
        ) : (
          /* ── Favorites grid ───────────────────────────────────────────── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((skill) => (
              <FavoriteCard
                key={skill.id}
                skill={skill}
                locale={locale}
                onRemove={handleRemove}
                removeFavoriteLabel={t.removeFavorite}
                savedAtTemplate={t.savedAt}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export the type so consumers of this island can use it
export type { FavoriteSkill };

// ── FavoriteCard ────────────────────────────────────────────────────────────────

interface FavoriteCardProps {
  skill: FavoriteSkill;
  locale: string;
  onRemove: (id: string) => void;
  removeFavoriteLabel: string;
  savedAtTemplate: string;
}

function FavoriteCard({ skill, locale, onRemove, removeFavoriteLabel, savedAtTemplate }: FavoriteCardProps) {
  const { owner, repo } = skill;
  const detailUrl = `/${locale}/skills/${owner}/${repo}`;
  const addedDate = new Date(skill.addedAt).toLocaleDateString();

  return (
    <a href={detailUrl} className="block group">
      <div className="relative h-full p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300 ease-out hover:border-cyan-400/50 hover:-translate-y-1">
        {/* Remove button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove(skill.id);
          }}
          className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 text-slate-400"
          title={removeFavoriteLabel}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0 pr-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors line-clamp-1">
                {skill.name}
              </h3>
              <div className="flex items-center gap-2 mt-2 px-2.5 py-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200/50 dark:border-slate-700/50 w-fit transition-colors group-hover:bg-slate-100 dark:group-hover:bg-slate-800 group-hover:border-cyan-200/30 dark:group-hover:border-cyan-800/30">
                <img
                  src={`https://github.com/${owner}.png`}
                  alt={owner}
                  className="w-4 h-4 rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${owner}&background=random`;
                  }}
                />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {owner}
                </span>
              </div>
            </div>
            <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-cyan-500 transition-colors flex-shrink-0" />
          </div>

          {/* Description */}
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2 leading-relaxed">
            {skill.description || 'No description available'}
          </p>

          {/* Footer */}
          <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500">
            <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
            <span>{savedAtTemplate.replace('{date}', addedDate)}</span>
          </div>
        </div>
      </div>
    </a>
  );
}
