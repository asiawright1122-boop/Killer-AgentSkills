/**
 * SkillActions – React Island for the Skill detail page.
 *
 * Provides:
 *  1. A favorite/unfavorite toggle button (heart icon)
 *  2. A share button (copies URL to clipboard or uses Web Share API)
 *  3. Records the skill visit in browsing history on mount
 *
 * Loaded with `client:visible` so it hydrates only when scrolled into view.
 *
 * Requirements: 6.4, 9.3
 */

import { useState, useEffect, useCallback } from 'react';
import { Heart, Share2, Check } from 'lucide-react';
import {
  loadFavorites,
  toggleFavorite,
  isFavorite as checkIsFavorite,
  type FavoriteSkill,
} from '../lib/favorites';
import { loadHistory, addToHistory } from '../lib/history';

// ── Props ──────────────────────────────────────────────────────────────────────

export interface SkillActionsProps {
  skillId: string;       // "owner/repo"
  skillName: string;
  owner: string;
  repo: string;
  description: string;
  locale: string;
  labels?: {
    addToFavorites: string;
    removeFromFavorites: string;
    shareSkill: string;
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SkillActions({
  skillId,
  skillName,
  owner,
  repo,
  description,
  locale,
  labels,
}: SkillActionsProps) {
  const [favorites, setFavorites] = useState<FavoriteSkill[]>([]);
  const [isFav, setIsFav] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');

  // On mount: load favorites, check status, record history visit
  useEffect(() => {
    const favs = loadFavorites();
    setFavorites(favs);
    setIsFav(checkIsFavorite(favs, skillId));
    setIsLoaded(true);

    // Record this skill visit in browsing history
    const history = loadHistory();
    addToHistory(history, {
      id: skillId,
      name: skillName,
      owner,
      repo,
      description,
    });
  }, [skillId, skillName, owner, repo, description]);

  // Toggle favorite
  const handleToggleFavorite = useCallback(() => {
    setFavorites((prev) => {
      const result = toggleFavorite(prev, {
        id: skillId,
        name: skillName,
        owner,
        repo,
        description,
      });
      setIsFav(result.isFavorite);
      return result.favorites;
    });
  }, [skillId, skillName, owner, repo, description]);

  // Share / copy URL
  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const shareData = {
      title: skillName,
      text: description || skillName,
      url,
    };

    try {
      // Prefer Web Share API on supported devices (mobile)
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // User cancelled or share failed – fall through to clipboard
    }

    // Fallback: copy URL to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2000);
    } catch {
      // Last resort: prompt-based copy
      window.prompt('Copy this URL:', url);
    }
  }, [skillName, description]);

  // ── Render ─────────────────────────────────────────────────────────────────

  // Show a minimal placeholder while loading to avoid layout shift
  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Favorite toggle button */}
      <button
        onClick={handleToggleFavorite}
        className={`
          group flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
          transition-all duration-200 ease-out
          ${isFav
            ? 'bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 border border-pink-200 dark:border-pink-800 hover:bg-pink-100 dark:hover:bg-pink-950/50'
            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-pink-300 dark:hover:border-pink-700 hover:text-pink-500 dark:hover:text-pink-400'
          }
        `}
        aria-label={isFav ? (labels?.removeFromFavorites || 'Remove from favorites') : (labels?.addToFavorites || 'Add to favorites')}
        aria-pressed={isFav}
      >
        <Heart
          className={`w-4 h-4 transition-transform duration-200 ${isFav
            ? 'fill-pink-500 text-pink-500 scale-110'
            : 'group-hover:scale-110'
            }`}
        />

      </button>

      {/* Share button */}
      <button
        onClick={handleShare}
        className={`
          group flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
          transition-all duration-200 ease-out
          ${shareState === 'copied'
            ? 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'
            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-cyan-300 dark:hover:border-cyan-700 hover:text-cyan-500 dark:hover:text-cyan-400'
          }
        `}
        aria-label={labels?.shareSkill || "Share this skill"}
      >
        {shareState === 'copied' ? (
          <Check className="w-4 h-4" />
        ) : (
          <Share2 className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
        )}
      </button>
    </div>
  );
}
