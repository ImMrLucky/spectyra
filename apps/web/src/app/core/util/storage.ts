const STORAGE_KEY_PREFIX = 'spectyra_';

export function getStoredOptimizationLevel(path: 'talk' | 'code'): number {
  const key = `${STORAGE_KEY_PREFIX}opt_level_${path}`;
  const stored = localStorage.getItem(key);
  if (stored !== null) {
    const level = parseInt(stored, 10);
    if (level >= 0 && level <= 4) {
      return level;
    }
  }
  return 2; // default
}

export function setStoredOptimizationLevel(path: 'talk' | 'code', level: number): void {
  const key = `${STORAGE_KEY_PREFIX}opt_level_${path}`;
  localStorage.setItem(key, level.toString());
}

export function getStoredSavingsFilters(): any | null {
  const key = `${STORAGE_KEY_PREFIX}savings_filters`;
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

export function setStoredSavingsFilters(filters: any): void {
  const key = `${STORAGE_KEY_PREFIX}savings_filters`;
  localStorage.setItem(key, JSON.stringify(filters));
}
