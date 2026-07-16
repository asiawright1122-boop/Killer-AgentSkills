const FALSE_VALUES = new Set(['0', 'false', 'off', 'no']);

export function isTelemetryDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
    if (env.KILLER_SKILLS_TEST) return true;
    if (env.DO_NOT_TRACK && !FALSE_VALUES.has(env.DO_NOT_TRACK.toLowerCase())) return true;
    return env.KILLER_SKILLS_TELEMETRY
        ? FALSE_VALUES.has(env.KILLER_SKILLS_TELEMETRY.toLowerCase())
        : false;
}

export async function reportSuccessfulInstall(
    event: {
        skillRef: string;
        platform: 'auto' | 'claude' | 'codex' | 'cursor' | 'multi';
        clientVersion: string;
    },
    options: { fetchImpl?: typeof fetch; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<void> {
    if (isTelemetryDisabled(options.env) || !event.skillRef.includes('/')) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 750);
    try {
        await (options.fetchImpl || fetch)('https://killer-skills.com/api/analytics/skill-event', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': `killer-skills/${event.clientVersion}`,
            },
            body: JSON.stringify({ ...event, eventType: 'cli_install', surface: 'cli' }),
            signal: controller.signal,
        });
    } catch {
        // Installation already succeeded; telemetry is best effort.
    } finally {
        clearTimeout(timer);
    }
}
