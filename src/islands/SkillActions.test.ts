/**
 * SkillActions integration tests
 *
 * Tests the core logic used by the SkillActions island component:
 * - Favorite toggle integration (loadFavorites + toggleFavorite + isFavorite)
 * - History recording on visit (loadHistory + addToHistory)
 * - Correct prop-to-data mapping
 *
 * The underlying favorites and history utilities have their own unit tests.
 * These tests verify the integration flow that SkillActions performs on mount
 * and on user interaction.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadFavorites,
  toggleFavorite,
  isFavorite,
  saveFavorites,
  STORAGE_KEY as FAV_STORAGE_KEY,
  type FavoriteSkill,
} from '../lib/favorites';
import {
  loadHistory,
  addToHistory,
  STORAGE_KEY as HIST_STORAGE_KEY,
  type HistoryItem,
} from '../lib/history';

// ── localStorage mock ──────────────────────────────────────────────────────────

const store = new Map<string, string>();

const localStorageMock: Storage = {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
  removeItem: vi.fn((key: string) => { store.delete(key); }),
  clear: vi.fn(() => { store.clear(); }),
  get length() { return store.size; },
  key: vi.fn((i: number) => [...store.keys()][i] ?? null),
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ── Test data (simulates SkillActions props) ───────────────────────────────────

const skillProps = {
  skillId: 'testowner/testrepo',
  skillName: 'Test Skill',
  owner: 'testowner',
  repo: 'testrepo',
  description: 'A great test skill',
  locale: 'en',
};

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe('SkillActions – mount flow (favorites check + history recording)', () => {
  it('detects skill is not favorited when favorites list is empty', () => {
    const favs = loadFavorites();
    const result = isFavorite(favs, skillProps.skillId);
    expect(result).toBe(false);
  });

  it('detects skill is favorited when it exists in favorites', () => {
    const existing: FavoriteSkill[] = [{
      id: skillProps.skillId,
      name: skillProps.skillName,
      owner: skillProps.owner,
      repo: skillProps.repo,
      description: skillProps.description,
      addedAt: '2024-01-15T10:00:00.000Z',
    }];
    saveFavorites(existing);

    const favs = loadFavorites();
    const result = isFavorite(favs, skillProps.skillId);
    expect(result).toBe(true);
  });

  it('records skill visit in browsing history on mount', () => {
    const history = loadHistory();
    const updated = addToHistory(history, {
      id: skillProps.skillId,
      name: skillProps.skillName,
      owner: skillProps.owner,
      repo: skillProps.repo,
      description: skillProps.description,
    });

    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe(skillProps.skillId);
    expect(updated[0].name).toBe(skillProps.skillName);
    expect(updated[0].owner).toBe(skillProps.owner);
    expect(updated[0].repo).toBe(skillProps.repo);
    expect(updated[0].visitedAt).toBeTruthy();

    // Verify it was persisted
    const stored = JSON.parse(store.get(HIST_STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(skillProps.skillId);
  });

  it('moves existing history entry to front when revisiting', () => {
    // Pre-populate history with another skill first, then our skill
    const initial = addToHistory([], {
      id: 'other/skill',
      name: 'Other',
      owner: 'other',
      repo: 'skill',
      description: 'Other skill',
    });
    const withOur = addToHistory(initial, {
      id: skillProps.skillId,
      name: skillProps.skillName,
      owner: skillProps.owner,
      repo: skillProps.repo,
      description: skillProps.description,
    });

    // Now add another skill so our skill is not at front
    const withThird = addToHistory(withOur, {
      id: 'third/skill',
      name: 'Third',
      owner: 'third',
      repo: 'skill',
      description: 'Third skill',
    });

    expect(withThird[0].id).toBe('third/skill');

    // Simulate revisit (what SkillActions does on mount)
    const history = loadHistory();
    const updated = addToHistory(history, {
      id: skillProps.skillId,
      name: skillProps.skillName,
      owner: skillProps.owner,
      repo: skillProps.repo,
      description: skillProps.description,
    });

    // Our skill should now be at the front
    expect(updated[0].id).toBe(skillProps.skillId);
  });
});

describe('SkillActions – favorite toggle flow', () => {
  it('adds skill to favorites when not already favorited', () => {
    const favs = loadFavorites();
    const result = toggleFavorite(favs, {
      id: skillProps.skillId,
      name: skillProps.skillName,
      owner: skillProps.owner,
      repo: skillProps.repo,
      description: skillProps.description,
    });

    expect(result.isFavorite).toBe(true);
    expect(result.favorites).toHaveLength(1);
    expect(result.favorites[0].id).toBe(skillProps.skillId);
    expect(result.favorites[0].addedAt).toBeTruthy();

    // Verify persisted
    const stored = JSON.parse(store.get(FAV_STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
  });

  it('removes skill from favorites when already favorited', () => {
    // First, add to favorites
    const added = toggleFavorite([], {
      id: skillProps.skillId,
      name: skillProps.skillName,
      owner: skillProps.owner,
      repo: skillProps.repo,
      description: skillProps.description,
    });
    expect(added.isFavorite).toBe(true);

    // Now toggle again to remove
    const removed = toggleFavorite(added.favorites, {
      id: skillProps.skillId,
      name: skillProps.skillName,
      owner: skillProps.owner,
      repo: skillProps.repo,
      description: skillProps.description,
    });

    expect(removed.isFavorite).toBe(false);
    expect(removed.favorites).toHaveLength(0);
  });

  it('preserves other favorites when toggling one skill', () => {
    // Add two skills
    const first = toggleFavorite([], {
      id: 'other/skill',
      name: 'Other',
      owner: 'other',
      repo: 'skill',
      description: 'Other skill',
    });
    const second = toggleFavorite(first.favorites, {
      id: skillProps.skillId,
      name: skillProps.skillName,
      owner: skillProps.owner,
      repo: skillProps.repo,
      description: skillProps.description,
    });

    expect(second.favorites).toHaveLength(2);

    // Remove only our skill
    const afterRemove = toggleFavorite(second.favorites, {
      id: skillProps.skillId,
      name: skillProps.skillName,
      owner: skillProps.owner,
      repo: skillProps.repo,
      description: skillProps.description,
    });

    expect(afterRemove.favorites).toHaveLength(1);
    expect(afterRemove.favorites[0].id).toBe('other/skill');
  });
});

describe('SkillActions – combined favorites and history', () => {
  it('can favorite a skill and record history independently', () => {
    // Simulate mount: load favorites, check status, record history
    const favs = loadFavorites();
    const isFav = isFavorite(favs, skillProps.skillId);
    expect(isFav).toBe(false);

    const history = loadHistory();
    addToHistory(history, {
      id: skillProps.skillId,
      name: skillProps.skillName,
      owner: skillProps.owner,
      repo: skillProps.repo,
      description: skillProps.description,
    });

    // Simulate user clicking favorite
    const toggleResult = toggleFavorite(favs, {
      id: skillProps.skillId,
      name: skillProps.skillName,
      owner: skillProps.owner,
      repo: skillProps.repo,
      description: skillProps.description,
    });

    expect(toggleResult.isFavorite).toBe(true);

    // Both stores should have data
    const storedFavs = JSON.parse(store.get(FAV_STORAGE_KEY)!);
    const storedHistory = JSON.parse(store.get(HIST_STORAGE_KEY)!);
    expect(storedFavs).toHaveLength(1);
    expect(storedHistory).toHaveLength(1);
    expect(storedFavs[0].id).toBe(skillProps.skillId);
    expect(storedHistory[0].id).toBe(skillProps.skillId);
  });
});
