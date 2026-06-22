import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  STORAGE_KEY,
  loadFavorites,
  saveFavorites,
  addFavorite,
  removeFavorite,
  toggleFavorite,
  isFavorite,
  type FavoriteSkill,
} from './favorites';

// ── localStorage mock ──────────────────────────────────────────────────────────

const store = new Map<string, string>();

const localStorageMock: Storage = {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    store.delete(key);
  }),
  clear: vi.fn(() => {
    store.clear();
  }),
  get length() {
    return store.size;
  },
  key: vi.fn((i: number) => [...store.keys()][i] ?? null),
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeFavorite(overrides: Partial<FavoriteSkill> = {}): FavoriteSkill {
  return {
    id: 'owner/repo',
    name: 'Test Skill',
    owner: 'owner',
    repo: 'repo',
    description: 'A test skill',
    addedAt: '2024-01-15T10:00:00.000Z',
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe('STORAGE_KEY', () => {
  it('should match the key used by the Next.js app', () => {
    expect(STORAGE_KEY).toBe('agentskills_favorites');
  });
});

describe('loadFavorites', () => {
  it('returns empty array when localStorage is empty', () => {
    expect(loadFavorites()).toEqual([]);
  });

  it('returns stored favorites', () => {
    const favs = [makeFavorite()];
    store.set(STORAGE_KEY, JSON.stringify(favs));
    expect(loadFavorites()).toEqual(favs);
  });

  it('returns empty array for corrupted JSON', () => {
    store.set(STORAGE_KEY, '{not valid json');
    expect(loadFavorites()).toEqual([]);
  });

  it('returns empty array when stored value is not an array', () => {
    store.set(STORAGE_KEY, JSON.stringify({ not: 'an array' }));
    expect(loadFavorites()).toEqual([]);
  });

  it('returns empty array when localStorage.getItem throws', () => {
    (localStorageMock.getItem as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });
    expect(loadFavorites()).toEqual([]);
  });
});

describe('saveFavorites', () => {
  it('persists favorites to localStorage', () => {
    const favs = [makeFavorite()];
    saveFavorites(favs);
    expect(store.get(STORAGE_KEY)).toBe(JSON.stringify(favs));
  });

  it('does not throw when localStorage.setItem fails', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    (localStorageMock.setItem as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });
    expect(() => saveFavorites([makeFavorite()])).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith('[favorites] Failed to save:', expect.any(Error));
    consoleError.mockRestore();
  });
});

describe('addFavorite', () => {
  it('adds a new skill to the list', () => {
    const skill = { id: 'a/b', name: 'B', owner: 'a', repo: 'b', description: 'desc' };
    const result = addFavorite([], skill);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a/b');
    expect(result[0].addedAt).toBeTruthy();
  });

  it('does not duplicate an existing skill', () => {
    const existing = [makeFavorite({ id: 'a/b' })];
    const skill = { id: 'a/b', name: 'B', owner: 'a', repo: 'b', description: 'desc' };
    const result = addFavorite(existing, skill);
    expect(result).toHaveLength(1);
    expect(result).toBe(existing); // same reference – no mutation
  });

  it('persists the updated list to localStorage', () => {
    const skill = { id: 'x/y/z', name: 'Y', owner: 'x', repo: 'y', routePath: 'y/z', description: '' };
    addFavorite([], skill);
    const stored = JSON.parse(store.get(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('x/y/z');
    expect(stored[0].routePath).toBe('y/z');
  });

  it('keeps sibling subskills in the same repo as distinct favorites', () => {
    const first = addFavorite([], { id: 'a/repo/skill-a', name: 'A', owner: 'a', repo: 'repo', description: '' });
    const second = addFavorite(first, { id: 'a/repo/skill-b', name: 'B', owner: 'a', repo: 'repo', description: '' });

    expect(second).toHaveLength(2);
    expect(second.map((item) => item.id)).toEqual(['a/repo/skill-a', 'a/repo/skill-b']);
  });
});

describe('removeFavorite', () => {
  it('removes a skill by id', () => {
    const favs = [makeFavorite({ id: 'a/b' }), makeFavorite({ id: 'c/d' })];
    const result = removeFavorite(favs, 'a/b');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c/d');
  });

  it('returns the same list when id is not found', () => {
    const favs = [makeFavorite({ id: 'a/b' })];
    const result = removeFavorite(favs, 'nonexistent');
    expect(result).toHaveLength(1);
  });

  it('persists the updated list to localStorage', () => {
    const favs = [makeFavorite({ id: 'a/b' }), makeFavorite({ id: 'c/d' })];
    removeFavorite(favs, 'a/b');
    const stored = JSON.parse(store.get(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('c/d');
  });

  it('removes only the targeted subskill when sibling subskills share the same repo', () => {
    const favs = [
      makeFavorite({ id: 'owner/repo/skill-a', repo: 'repo', routePath: 'repo/skill-a' }),
      makeFavorite({ id: 'owner/repo/skill-b', repo: 'repo', routePath: 'repo/skill-b' }),
    ];

    const result = removeFavorite(favs, 'owner/repo/skill-a');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('owner/repo/skill-b');
  });
});

describe('toggleFavorite', () => {
  it('adds a skill when not present', () => {
    const skill = { id: 'a/b', name: 'B', owner: 'a', repo: 'b', description: '' };
    const { favorites, isFavorite: fav } = toggleFavorite([], skill);
    expect(fav).toBe(true);
    expect(favorites).toHaveLength(1);
  });

  it('removes a skill when already present', () => {
    const existing = [makeFavorite({ id: 'a/b' })];
    const skill = { id: 'a/b', name: 'B', owner: 'a', repo: 'b', description: '' };
    const { favorites, isFavorite: fav } = toggleFavorite(existing, skill);
    expect(fav).toBe(false);
    expect(favorites).toHaveLength(0);
  });
});

describe('isFavorite', () => {
  it('returns true when skill is in the list', () => {
    expect(isFavorite([makeFavorite({ id: 'a/b' })], 'a/b')).toBe(true);
  });

  it('returns false when skill is not in the list', () => {
    expect(isFavorite([makeFavorite({ id: 'a/b' })], 'x/y')).toBe(false);
  });

  it('returns false for empty list', () => {
    expect(isFavorite([], 'a/b')).toBe(false);
  });
});
