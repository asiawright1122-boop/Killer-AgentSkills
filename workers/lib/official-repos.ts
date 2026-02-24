// Re-export from the shared frontend library so that TypeScript properly
// resolves the internal relative imports (e.g. `../../../data/official-repos.json`)
// without breaking the worker's isolated compiler `RootDir` context.
export * from '../../src/lib/shared/official-repos';
