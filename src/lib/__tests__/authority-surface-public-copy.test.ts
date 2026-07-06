import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { authoritySurfacePublicCopy } from '../authority-surface-public-copy';

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'data/authority-surfaces.json'), 'utf8')) as {
  surfaces: Array<{ id: string }>;
};

describe('authoritySurfacePublicCopy coverage', () => {
  for (const surface of manifest.surfaces) {
    it(`${surface.id} has user-facing copy`, () => {
      const copy = authoritySurfacePublicCopy[surface.id];
      expect(copy, `surface ${surface.id} missing from authoritySurfacePublicCopy`).toBeDefined();
      expect(copy.title?.en, `${surface.id} title.en`).toBeTruthy();
      expect(copy.title?.zh, `${surface.id} title.zh`).toBeTruthy();
      expect(copy.description?.en, `${surface.id} description.en`).toBeTruthy();
      expect(copy.description?.zh, `${surface.id} description.zh`).toBeTruthy();
    });
  }
});
