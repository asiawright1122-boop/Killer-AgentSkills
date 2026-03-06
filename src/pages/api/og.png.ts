import type { APIRoute } from 'astro';
import satori from 'satori';
import { html } from 'satori-html';
import { Resvg, initWasm } from '@resvg/resvg-wasm';

// WebAssembly Initialization State
let wasmInitialized = false;

// Global Font Cache to avoid fetching multiple times per isolate
const fontCache = {
    regular: null as ArrayBuffer | null,
    bold: null as ArrayBuffer | null
};

export const GET: APIRoute = async ({ request, url }) => {
    try {
        const searchParams = url.searchParams;
        const title = searchParams.get('title') || searchParams.get('name') || 'Killer Agent Skills';
        const description = searchParams.get('description') || 'Discover leading AI Agent Skills & MCP Servers.';
        const stars = searchParams.get('stars') || '0';
        const owner = searchParams.get('owner') || 'AI Agent Directory';
        const topicsStr = searchParams.get('topics') || '';
        const topics = topicsStr ? topicsStr.split(',') : [];

        // We can't bundle fonts directly or use the origin reliably in Pages without exceeding the 3MB or 1MB limits.
        // Instead, we fetch them from a fast public CDN (jsDelivr) and cache them in the isolate's memory.
        if (!fontCache.regular) {
            const fontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/Inter-Regular.ttf';
            const req = await fetch(fontUrl);
            fontCache.regular = await req.arrayBuffer();
        }
        if (!fontCache.bold) {
            const fontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/Inter-Bold.ttf';
            const req = await fetch(fontUrl);
            fontCache.bold = await req.arrayBuffer();
        }

        // ─── 2. INIT RESVG WASM ───
        if (!wasmInitialized) {
            // Need to fetch WASM binary from unpkg/jsDelivr as CF Workers don't allow easy local WASM bundler injection sometimes via Vite
            const wasmRes = await fetch('https://unpkg.com/@resvg/resvg-wasm@3.1.2/index_bg.wasm');
            const wasmBuffer = await wasmRes.arrayBuffer();
            await initWasm(wasmBuffer);
            wasmInitialized = true;
        }

        const mode = searchParams.get('mode') || 'skill';

        // ─── 3. HTML/JSX TEMPLATE ─── //
        let markup;

        if (mode === 'collection' || mode === 'blog') {
            const author = searchParams.get('author') || 'Killer-Skills';
            const date = searchParams.get('date') || '';
            const readTime = searchParams.get('readingTime') || '';

            markup = html`
                <div style="display: flex; flex-direction: column; width: 100%; height: 100%; background-color: #0f172a; padding: 60px; font-family: 'Inter'; border: 8px solid ${mode === 'collection' ? '#a855f7' : '#10b981'};">
                    <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                        <div style="display: flex; align-items: center;">
                            <span style="color: ${mode === 'collection' ? '#d8b4fe' : '#6ee7b7'}; font-size: 28px; font-weight: bold; border: 2px solid ${mode === 'collection' ? '#d8b4fe' : '#6ee7b7'}; padding: 4px 12px; border-radius: 9999px;">
                                ${mode === 'collection' ? 'Curated Collection' : 'Developer Blog'}
                            </span>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; margin-top: auto; margin-bottom: auto;">
                        <h1 style="font-size: 80px; font-weight: bold; color: white; line-height: 1.1; margin: 0; padding: 0;">
                            ${title.length > 50 ? title.substring(0, 50) + '...' : title}
                        </h1>
                        <p style="font-size: 36px; color: #cbd5e1; margin-top: 32px; line-height: 1.4; max-width: 90%;">
                            ${description.length > 120 ? description.substring(0, 120) + '...' : description}
                        </p>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                        <span style="font-size: 28px; color: #94a3b8; font-weight: bold;">@${author}</span>
                        <div style="display: flex; gap: 24px; color: #94a3b8; font-size: 24px;">
                            ${date ? `<span>📅 ${date}</span>` : ''}
                            ${readTime ? `<span>⏱ ${readTime} min read</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Default: Skill mode
            markup = html`
                <div style="display: flex; flex-direction: column; width: 100%; height: 100%; background-color: #0f172a; padding: 60px; font-family: 'Inter'; border: 8px solid #06b6d4;">
                    <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                        <div style="display: flex; align-items: center;">
                            <span style="color: #67e8f9; font-size: 28px; font-weight: bold; border: 2px solid #67e8f9; padding: 4px 12px; border-radius: 9999px;">AI Agent Directory</span>
                        </div>
                        <div style="display: flex; align-items: center; color: #cbd5e1; font-size: 28px;">
                            <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                            <span>${stars} Stars</span>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; margin-top: auto; margin-bottom: auto;">
                        <div style="display: flex; align-items: center; margin-bottom: 24px;">
                            <span style="font-size: 32px; color: #94a3b8; font-weight: bold;">@${owner}</span>
                        </div>
                        <h1 style="font-size: 80px; font-weight: bold; color: white; line-height: 1.1; margin: 0; padding: 0;">
                            ${title.length > 40 ? title.substring(0, 40) + '...' : title}
                        </h1>
                        <p style="font-size: 36px; color: #cbd5e1; margin-top: 32px; line-height: 1.4; max-width: 90%;">
                            ${description.length > 120 ? description.substring(0, 120) + '...' : description}
                        </p>
                    </div>

                    <div style="display: flex; align-items: center; gap: 16px;">
                        ${topics.slice(0, 4).map(topic => `
                            <span style="font-size: 24px; color: #38bdf8; background-color: #0c4a6e; padding: 8px 20px; border-radius: 8px; border: 1px solid #0284c7;">
                                #${topic}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // ─── 4. RENDER TO SVG ─── //
        const svg = await satori(markup as any, {
            width: 1200,
            height: 630,
            fonts: [
                {
                    name: 'Inter',
                    data: fontCache.regular!,
                    weight: 400,
                    style: 'normal',
                },
                {
                    name: 'Inter',
                    data: fontCache.bold!,
                    weight: 700,
                    style: 'normal',
                },
            ],
        });

        // ─── 5. SVG TO PNG (Resvg) ─── //
        const resvg = new Resvg(svg, {
            fitTo: { mode: 'width', value: 1200 },
        });
        const pngData = resvg.render();
        const pngBuffer = pngData.asPng();

        // ─── 6. RETURN CACHED RESPONSE ─── //
        return new Response(pngBuffer as any, {
            status: 200,
            headers: {
                'Content-Type': 'image/png',
                // Cache indefinitely on CDN since URL params define the image uniquely
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });

    } catch (error: any) {
        console.error("OG Generation Error:", error);
        return new Response('Failed to generate image: ' + error.message, { status: 500 });
    }
};
