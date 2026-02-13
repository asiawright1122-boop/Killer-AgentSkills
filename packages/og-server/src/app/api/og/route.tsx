import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

// We can run on default Node runtime or edge. 
// standard 'nodejs' is better for VPS to avoid edge-specific limitations if any.
// export const runtime = 'edge'; 

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        // Params
        const type = searchParams.get('type') || 'skill'; // 'skill' | 'blog'
        const title = searchParams.get('title') || 'Killer-Skills';
        const description = searchParams.get('description') || 'Discover the best AI Agent skills for Claude, Cursor, and more.';

        // Skill Params
        const owner = searchParams.get('owner') || '';
        const stars = searchParams.get('stars') || '0';

        // Blog Params
        const date = searchParams.get('date') || '';
        const author = searchParams.get('author') || 'Killer-Skills Team';
        const readingTime = searchParams.get('readingTime') || ''; // e.g. "5 min read"

        // Template Logic
        const isBlog = type === 'blog';

        // Background Gradient
        const gradient = isBlog
            ? 'linear-gradient(135deg, #EC4899, #8B5CF6)' // Pink to Purple for Blog
            : 'linear-gradient(135deg, #38BDF8, #818CF8)'; // Cyan to Blue for Skills

        const label = isBlog ? 'BLOG POST' : 'AI AGENT RESOURCE';
        const labelColor = isBlog ? '#ec4899' : '#22c55e'; // Pink vs Green

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#000000',
                        fontFamily: '"Inter", sans-serif',
                        position: 'relative',
                    }}
                >
                    {/* Glowing Orbs */}
                    <div style={{
                        position: 'absolute',
                        top: '-150px',
                        right: '-50px',
                        width: '600px',
                        height: '600px',
                        backgroundColor: isBlog ? '#EC4899' : '#38BDF8',
                        filter: 'blur(120px)',
                        opacity: 0.2,
                        zIndex: 1,
                    }} />
                    <div style={{
                        position: 'absolute',
                        bottom: '-150px',
                        left: '-150px',
                        width: '600px',
                        height: '600px',
                        backgroundColor: '#8B5CF6',
                        filter: 'blur(120px)',
                        opacity: 0.2,
                        zIndex: 1,
                    }} />

                    <div style={{
                        display: 'flex',
                        position: 'relative',
                        width: '1080px',
                        height: '510px',
                        borderRadius: '24px',
                        padding: '4px',
                        background: gradient,
                        zIndex: 10,
                    }}>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '100%',
                            height: '100%',
                            borderRadius: '21px',
                            backgroundColor: '#0f172a',
                            padding: '50px',
                            position: 'relative',
                            overflow: 'hidden',
                        }}>
                            {/* Top Bar */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    {/* Logo */}
                                    <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '16px' }}>
                                        <path d="M10 20L40 50L10 80L28 80L58 50L28 20H10Z" fill={isBlog ? "#EC4899" : "#38BDF8"} />
                                        <path d="M45 20L75 50L45 80L63 80L93 50L63 20H45Z" fill="#818CF8" />
                                    </svg>
                                    <span style={{ fontSize: '24px', fontWeight: 600, color: '#e2e8f0', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                        Killer-Skills / {isBlog ? 'Blog' : 'Index'}
                                    </span>
                                </div>
                                <div style={{
                                    padding: '6px 16px',
                                    border: '1px solid #334155',
                                    borderRadius: '100px',
                                    fontSize: '16px',
                                    color: '#94a3b8',
                                    fontFamily: 'monospace',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: labelColor }} />
                                    {label}
                                </div>
                            </div>

                            {/* Main Content */}
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
                                <h1 style={{
                                    fontSize: '72px',
                                    fontWeight: 800,
                                    lineHeight: 1.1,
                                    margin: '0 0 24px 0',
                                    letterSpacing: '-0.02em',
                                    color: '#ffffff',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                }}>
                                    {title}
                                </h1>
                                <p style={{
                                    fontSize: '32px',
                                    color: '#94a3b8',
                                    lineHeight: 1.5,
                                    maxWidth: '900px',
                                    margin: 0,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                }}>
                                    {description}
                                </p>
                            </div>

                            {/* Bottom Bar: Metadata */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                paddingTop: '30px',
                                borderTop: '1px solid #334155',
                            }}>
                                {isBlog ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '40px', color: '#94a3b8', fontSize: '20px', fontFamily: 'monospace' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span>{author}</span>
                                        </div>
                                        {date && <span>• {date}</span>}
                                        {readingTime && <span>• {readingTime}</span>}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                                        {owner && (
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>AUTHOR</span>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <img src={`https://github.com/${owner}.png`} width="28" height="28" style={{ borderRadius: '50%', marginRight: '8px' }} alt="" />
                                                    <span style={{ fontSize: '24px', color: '#f1f5f9', fontWeight: 500 }}>{owner}</span>
                                                </div>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>RATING</span>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span style={{ fontSize: '24px', color: '#fbbf24', marginRight: '6px' }}>★</span>
                                                <span style={{ fontSize: '24px', color: '#f1f5f9', fontWeight: 500 }}>{stars}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 630,
            }
        );
    } catch (e: any) {
        console.log(`${e.message}`);
        return new Response(`Failed to generate the image`, {
            status: 500,
        });
    }
}
