import type { APIRoute } from 'astro';
import { type Env } from '../../lib/kv';
import { getAllSkills } from '../../lib/skills';
import { getRuntimeEnv } from '../../lib/runtime-env';

export const prerender = false;

function simpleBadge(label: string, value: string, color: string): string {
  const labelWidth = label.length * 7 + 10;
  const valueWidth = value.length * 7 + 10;
  const totalWidth = labelWidth + valueWidth;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
  <clipPath id="r"><rect width="${totalWidth}" height="20" rx="3"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
  </g>
  <g fill="#fff" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">
    <text x="${labelWidth / 2}" y="14.5">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14.5">${value}</text>
  </g>
</svg>`;
}

/**
 * GET /api/badge
 *
 * Returns a shields.io-style SVG badge for embedding in GitHub READMEs.
 * Query params:
 *   type: "skills" | "installs" (default: "skills")
 *
 * Example usage in README:
 *   [![Killer-Skills](https://killer-skills.com/api/badge?type=skills)](https://killer-skills.com)
 */
export const GET: APIRoute = async ({ locals, url }) => {
  const type = url.searchParams.get('type') || 'skills';

  try {
    const env = await getRuntimeEnv<Env>(locals);
    const skills = env ? await getAllSkills(env) : [];
    const totalSkills = skills.length;

    let label: string;
    let value: string;
    let color: string;

    if (type === 'installs') {
      label = 'install via';
      value = 'killer-skills';
      color = '#0ea5e9';
    } else {
      label = 'skills on';
      value = `${totalSkills.toLocaleString()}+`;
      color = '#06b6d4';
    }

    const svg = simpleBadge(label, value, color);

    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    // Fallback badge without dynamic count
    const svg = simpleBadge('skills on', '3,400+', '#06b6d4');
    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};
