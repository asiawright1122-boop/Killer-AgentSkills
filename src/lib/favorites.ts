/**
 * Favorites localStorage utility
 *
 * Shared logic for reading/writing the favorites list in localStorage.
 * Used by FavoritesManager (list page) and SkillActions (detail page toggle).
 *
 * Requirements: 6.3, 6.4
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FavoriteSkill {
  id: string;        // "owner/repo"
  name: string;
  owner: string;
  repo: string;
  description: string;
  addedAt: string;   // ISO date string
}

// ── Constants ──────────────────────────────────────────────────────────────────

export const STORAGE_KEY = 'agentskills_favorites';

// ── Read / Write ───────────────────────────────────────────────────────────────

/**
 * Load the favorites array from localStorage.
 * Returns [] on any error (missing, corrupted, non-array).
 */
export function loadFavorites(): FavoriteSkill[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Corrupted data – start fresh
  }
  return [];
}

/**
 * Persist the favorites array to localStorage.
 */
export function saveFavorites(favorites: FavoriteSkill[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch (err) {
    console.error('[favorites] Failed to save:', err);
  }
}

// ── Mutations ──────────────────────────────────────────────────────────────────

/**
 * Add a skill to the favorites list (if not already present).
 * Returns the updated list.
 */
export function addFavorite(
  current: FavoriteSkill[],
  skill: Omit<FavoriteSkill, 'addedAt'>,
): FavoriteSkill[] {
  if (current.some((f) => f.id === skill.id)) return current;
  const entry: FavoriteSkill = { ...skill, addedAt: new Date().toISOString() };
  const next = [...current, entry];
  saveFavorites(next);
  return next;
}

/**
 * Remove a skill from the favorites list by id.
 * Returns the updated list.
 */
export function removeFavorite(current: FavoriteSkill[], id: string): FavoriteSkill[] {
  const next = current.filter((f) => f.id !== id);
  saveFavorites(next);
  return next;
}

/**
 * Toggle a skill's favorite status.
 * Returns { favorites, isFavorite } with the updated list and new state.
 */
export function toggleFavorite(
  current: FavoriteSkill[],
  skill: Omit<FavoriteSkill, 'addedAt'>,
): { favorites: FavoriteSkill[]; isFavorite: boolean } {
  const exists = current.some((f) => f.id === skill.id);
  if (exists) {
    return { favorites: removeFavorite(current, skill.id), isFavorite: false };
  }
  return { favorites: addFavorite(current, skill), isFavorite: true };
}

/**
 * Check whether a skill id is in the favorites list.
 */
export function isFavorite(favorites: FavoriteSkill[], id: string): boolean {
  return favorites.some((f) => f.id === id);
}
