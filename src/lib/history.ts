/**
 * History localStorage utility
 *
 * Shared logic for reading/writing the browsing history list in localStorage.
 * Used by HistoryManager (list page) and SkillActions (detail page recording).
 *
 * Requirements: 6.2, 6.3
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HistoryItem {
  id: string;           // "owner/repo"
  name: string;
  owner: string;
  repo: string;
  description: string;
  visitedAt: string;    // ISO date string
}

// ── Constants ──────────────────────────────────────────────────────────────────

export const STORAGE_KEY = 'agentskills_history';
export const MAX_HISTORY_ITEMS = 50;

// ── Read / Write ───────────────────────────────────────────────────────────────

/**
 * Load the history array from localStorage.
 * Returns [] on any error (missing, corrupted, non-array).
 */
export function loadHistory(): HistoryItem[] {
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
 * Persist the history array to localStorage.
 * Trims to MAX_HISTORY_ITEMS before saving.
 */
export function saveHistory(history: HistoryItem[]): void {
  try {
    const trimmed = history.slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('[history] Failed to save:', err);
  }
}

// ── Mutations ──────────────────────────────────────────────────────────────────

/**
 * Add a skill to the history list.
 * If the skill already exists, it is moved to the front with an updated timestamp.
 * Returns the updated list (trimmed to MAX_HISTORY_ITEMS).
 */
export function addToHistory(
  current: HistoryItem[],
  skill: Omit<HistoryItem, 'visitedAt'>,
): HistoryItem[] {
  // Remove existing entry for the same skill
  const filtered = current.filter((h) => h.id !== skill.id);
  const entry: HistoryItem = { ...skill, visitedAt: new Date().toISOString() };
  // Prepend to front (most recent first)
  const next = [entry, ...filtered].slice(0, MAX_HISTORY_ITEMS);
  saveHistory(next);
  return next;
}

/**
 * Remove a single history entry by id.
 * Returns the updated list.
 */
export function removeFromHistory(current: HistoryItem[], id: string): HistoryItem[] {
  const next = current.filter((h) => h.id !== id);
  saveHistory(next);
  return next;
}

/**
 * Clear all history entries.
 * Removes the key from localStorage entirely.
 */
export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('[history] Failed to clear:', err);
  }
}

/**
 * Format a relative time string from an ISO date.
 * Returns a human-readable string like "Just now", "5m ago", "3h ago", "2d ago",
 * or falls back to a locale date string for older entries.
 */
export function formatRelativeTime(
  visitedAt: string,
  labels: { justNow: string; agoM: string; agoH: string; agoD: string },
  now: Date = new Date(),
): string {
  const visited = new Date(visitedAt);
  const diffMs = now.getTime() - visited.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return labels.justNow;
  if (diffMins < 60) return labels.agoM.replace('{count}', String(diffMins));
  if (diffHours < 24) return labels.agoH.replace('{count}', String(diffHours));
  if (diffDays < 7) return labels.agoD.replace('{count}', String(diffDays));
  return visited.toLocaleDateString();
}
