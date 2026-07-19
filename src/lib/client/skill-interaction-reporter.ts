export function reportSkillInteraction(
  payload: Record<string, string>,
  navigatorLike: Pick<Navigator, 'sendBeacon'> = navigator,
  fetchLike: typeof fetch = fetch,
): void {
  try {
    const body = JSON.stringify(payload);
    if (navigatorLike.sendBeacon) {
      const queued = navigatorLike.sendBeacon(
        '/api/analytics/skill-event',
        new Blob([body], { type: 'application/json' }),
      );
      if (queued) return;
    }

    void fetchLike('/api/analytics/skill-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics never changes clipboard behavior.
  }
}
