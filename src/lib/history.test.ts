import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  STORAGE_KEY,
  MAX_HISTORY_ITEMS,
  loadHistory,
  saveHistory,
  addToHistory,
  removeFromHistory,
  clearHistory,
  formatRelativeTime,
  type HistoryItem,
} from './history';

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeHistoryItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: 'owner/repo',
    name: 'Test Skill',
    owner: 'owner',
    repo: 'repo',
    description: 'A test skill',
    visitedAt: '2024-01-15T10:00:00.000Z',
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
    expect(STORAGE_KEY).toBe('agentskills_history');
  });
});

describe('MAX_HISTORY_ITEMS', () => {
  it('should be 50', () => {
    expect(MAX_HISTORY_ITEMS).toBe(50);
  });
});

describe('loadHistory', () => {
  it('returns empty array when localStorage is empty', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('returns stored history', () => {
    const items = [makeHistoryItem()];
    store.set(STORAGE_KEY, JSON.stringify(items));
    expect(loadHistory()).toEqual(items);
  });

  it('returns empty array for corrupted JSON', () => {
    store.set(STORAGE_KEY, '{not valid json');
    expect(loadHistory()).toEqual([]);
  });

  it('returns empty array when stored value is not an array', () => {
    store.set(STORAGE_KEY, JSON.stringify({ not: 'an array' }));
    expect(loadHistory()).toEqual([]);
  });

  it('returns empty array when localStorage.getItem throws', () => {
    (localStorageMock.getItem as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });
    expect(loadHistory()).toEqual([]);
  });
});

describe('saveHistory', () => {
  it('persists history to localStorage', () => {
    const items = [makeHistoryItem()];
    saveHistory(items);
    expect(store.get(STORAGE_KEY)).toBe(JSON.stringify(items));
  });

  it('trims to MAX_HISTORY_ITEMS before saving', () => {
    const items = Array.from({ length: 60 }, (_, i) =>
      makeHistoryItem({ id: `owner/repo-${i}` }),
    );
    saveHistory(items);
    const stored = JSON.parse(store.get(STORAGE_KEY)!);
    expect(stored).toHaveLength(MAX_HISTORY_ITEMS);
  });

  it('does not throw when localStorage.setItem fails', () => {
    (localStorageMock.setItem as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });
    expect(() => saveHistory([makeHistoryItem()])).not.toThrow();
  });
});

describe('addToHistory', () => {
  it('adds a new skill to the front of the list', () => {
    const existing = [makeHistoryItem({ id: 'a/b' })];
    const skill = { id: 'c/d', name: 'D', owner: 'c', repo: 'd', description: 'desc' };
    const result = addToHistory(existing, skill);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('c/d');
    expect(result[0].visitedAt).toBeTruthy();
    expect(result[1].id).toBe('a/b');
  });

  it('moves an existing skill to the front with updated timestamp', () => {
    const existing = [
      makeHistoryItem({ id: 'a/b', visitedAt: '2024-01-01T00:00:00.000Z' }),
      makeHistoryItem({ id: 'c/d', visitedAt: '2024-01-02T00:00:00.000Z' }),
    ];
    const skill = { id: 'a/b', name: 'B', owner: 'a', repo: 'b', description: 'desc' };
    const result = addToHistory(existing, skill);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('a/b');
    // Timestamp should be updated (newer than original)
    expect(new Date(result[0].visitedAt).getTime()).toBeGreaterThan(
      new Date('2024-01-01T00:00:00.000Z').getTime(),
    );
    expect(result[1].id).toBe('c/d');
  });

  it('trims to MAX_HISTORY_ITEMS', () => {
    const existing = Array.from({ length: MAX_HISTORY_ITEMS }, (_, i) =>
      makeHistoryItem({ id: `owner/repo-${i}` }),
    );
    const skill = { id: 'new/skill', name: 'New', owner: 'new', repo: 'skill', description: '' };
    const result = addToHistory(existing, skill);
    expect(result).toHaveLength(MAX_HISTORY_ITEMS);
    expect(result[0].id).toBe('new/skill');
  });

  it('persists the updated list to localStorage', () => {
    const skill = { id: 'x/y', name: 'Y', owner: 'x', repo: 'y', description: '' };
    addToHistory([], skill);
    const stored = JSON.parse(store.get(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('x/y');
  });
});

describe('removeFromHistory', () => {
  it('removes a history entry by id', () => {
    const items = [makeHistoryItem({ id: 'a/b' }), makeHistoryItem({ id: 'c/d' })];
    const result = removeFromHistory(items, 'a/b');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c/d');
  });

  it('returns the same-length list when id is not found', () => {
    const items = [makeHistoryItem({ id: 'a/b' })];
    const result = removeFromHistory(items, 'nonexistent');
    expect(result).toHaveLength(1);
  });

  it('persists the updated list to localStorage', () => {
    const items = [makeHistoryItem({ id: 'a/b' }), makeHistoryItem({ id: 'c/d' })];
    removeFromHistory(items, 'a/b');
    const stored = JSON.parse(store.get(STORAGE_KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('c/d');
  });
});

describe('clearHistory', () => {
  it('removes the storage key from localStorage', () => {
    store.set(STORAGE_KEY, JSON.stringify([makeHistoryItem()]));
    clearHistory();
    expect(store.has(STORAGE_KEY)).toBe(false);
  });

  it('does not throw when localStorage.removeItem fails', () => {
    (localStorageMock.removeItem as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });
    expect(() => clearHistory()).not.toThrow();
  });
});

describe('formatRelativeTime', () => {
  const labels = {
    justNow: 'Just now',
    agoM: '{count}m ago',
    agoH: '{count}h ago',
    agoD: '{count}d ago',
  };

  it('returns "Just now" for less than 1 minute ago', () => {
    const now = new Date('2024-01-15T10:00:30.000Z');
    expect(formatRelativeTime('2024-01-15T10:00:00.000Z', labels, now)).toBe('Just now');
  });

  it('returns minutes ago for less than 1 hour', () => {
    const now = new Date('2024-01-15T10:05:00.000Z');
    expect(formatRelativeTime('2024-01-15T10:00:00.000Z', labels, now)).toBe('5m ago');
  });

  it('returns hours ago for less than 24 hours', () => {
    const now = new Date('2024-01-15T13:00:00.000Z');
    expect(formatRelativeTime('2024-01-15T10:00:00.000Z', labels, now)).toBe('3h ago');
  });

  it('returns days ago for less than 7 days', () => {
    const now = new Date('2024-01-17T10:00:00.000Z');
    expect(formatRelativeTime('2024-01-15T10:00:00.000Z', labels, now)).toBe('2d ago');
  });

  it('returns locale date string for 7+ days ago', () => {
    const now = new Date('2024-01-25T10:00:00.000Z');
    const result = formatRelativeTime('2024-01-15T10:00:00.000Z', labels, now);
    // Should be a date string, not a relative time
    expect(result).not.toContain('ago');
    expect(result).not.toBe('Just now');
  });
});
