import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ADSENSE_CLIENT_ID, ADSENSE_PUBLISHER_ID, ADSENSE_SCRIPT_SRC } from './site-config';

describe('site advertising configuration', () => {
  it('keeps the AdSense script client and ads.txt publisher id in sync', () => {
    expect(ADSENSE_CLIENT_ID).toBe('ca-pub-4296643508645584');
    expect(ADSENSE_PUBLISHER_ID).toBe('pub-4296643508645584');
    expect(ADSENSE_SCRIPT_SRC).toContain(`client=${ADSENSE_CLIENT_ID}`);

    const adsTxt = readFileSync('public/ads.txt', 'utf8').trim();
    expect(adsTxt).toBe(`google.com, ${ADSENSE_PUBLISHER_ID}, DIRECT, f08c47fec0942fa0`);
  });
});
