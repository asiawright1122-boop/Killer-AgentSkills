import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStore } from '@nanostores/react';
import { currentFile, fileContents, setFileContent } from '../stores/skill-files';
import { Copy, Check, FileText, Globe, Eye, Code } from 'lucide-react';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import vscDarkPlus from '../styles/highlight-theme';
import vs from '../styles/highlight-theme-light';

interface SkillReadmeProps {
    initialContent: string;
    initialFiles?: Record<string, string>;
    name?: string;
}

// Hook to detect theme changes
function useTheme() {
    const [isDark, setIsDark] = useState(true); // Default to dark to match SSR likely or avoid flash

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const checkTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
        checkTheme();

        const observer = new MutationObserver(checkTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        return () => observer.disconnect();
    }, []);

    return isDark;
}

export default function SkillReadme({ initialContent, initialFiles = {}, name = 'SKILL.md' }: SkillReadmeProps) {
    const [copied, setCopied] = useState(false);
    const selected = useStore(currentFile);
    const contents = useStore(fileContents);
    const isDark = useTheme();

    // Initialize store with server-side data
    useEffect(() => {
        setFileContent('SKILL.md', initialContent);
        Object.entries(initialFiles).forEach(([filename, content]) => {
            setFileContent(filename, content);
        });
    }, [initialContent, initialFiles]);

    const content = contents[selected] || initialContent;
    const isMarkdown = selected.endsWith('.md');
    const isJson = selected.endsWith('.json');

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-white dark:bg-[#151515]/80 backdrop-blur-md rounded-2xl overflow-hidden border border-gray-200 dark:border-white/5 shadow-xl transition-colors duration-300">
            {/* Header */}
            <div className="h-12 bg-gray-50/80 dark:bg-white/5 border-b border-gray-200 dark:border-white/5 flex items-center justify-between px-4 transition-colors duration-300">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5 group">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-[inset_0_0_2px_rgba(0,0,0,0.2)] border border-[#e0443e] group-hover:brightness-90 transition-all"></div>
                        <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-[inset_0_0_2px_rgba(0,0,0,0.2)] border border-[#dea123] group-hover:brightness-90 transition-all"></div>
                        <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-[inset_0_0_2px_rgba(0,0,0,0.2)] border border-[#1aab29] group-hover:brightness-90 transition-all"></div>
                    </div>
                    <div className="h-4 w-px bg-gray-300 dark:bg-white/10 mx-1"></div>
                    <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm font-mono">
                        <FileText size={14} />
                        <span className="text-gray-600 dark:text-gray-300 font-medium">{selected}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-white/5 uppercase tracking-wider">
                        Readonly
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-all text-xs font-medium border border-gray-200 dark:border-white/5">
                        <Eye size={14} />
                        <span>Preview</span>
                    </button>
                    <button
                        onClick={handleCopy}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-black dark:hover:text-white transition-colors relative"
                        title="Copy content"
                    >
                        {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                    </button>
                </div>
            </div>

            {/* Content with Background Grid */}
            <div className="relative h-[800px] group/scroll">
                {/* Tech Grid Background - Dark Mode Only or Subtle in Light */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

                <div className="p-0 relative z-10 h-full overflow-y-auto custom-scrollbar">
                    {isMarkdown ? (
                        <div className="p-8">
                            <article className="prose prose-zinc dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-4xl prose-h1:tracking-tight prose-a:text-cyan-600 dark:prose-a:text-cyan-400 prose-img:rounded-xl prose-pre:bg-gray-100 dark:prose-pre:bg-[#0e0e0e] prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-white/10 prose-pre:text-gray-900 dark:prose-pre:text-gray-50">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        code(props) {
                                            const { children, className, node, ref, ...rest } = props
                                            const match = /language-(\w+)/.exec(className || '')
                                            return match ? (
                                                <div className="rounded-lg overflow-hidden bg-white border border-gray-200 dark:bg-[#1e1e1e] dark:border-gray-700 my-4 shadow-sm relative group/code transition-colors duration-300">
                                                    <div className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 transition-opacity z-10 px-2 py-1 bg-gray-100 dark:bg-white/10 rounded text-xs text-gray-500 dark:text-white/70">
                                                        {match[1]}
                                                    </div>
                                                    <SyntaxHighlighter
                                                        {...rest}
                                                        PreTag="div"
                                                        children={String(children).replace(/\n$/, '')}
                                                        language={match[1]}
                                                        style={(isDark ? vscDarkPlus : vs) as any}
                                                        customStyle={{
                                                            margin: 0,
                                                            padding: '1.5rem',
                                                            background: isDark ? '#1e1e1e' : '#ffffff',
                                                            fontSize: '14px',
                                                            lineHeight: '1.6',
                                                            transition: 'background-color 0.3s ease'
                                                        }}
                                                        showLineNumbers={true}
                                                        wrapLongLines={true}
                                                    />
                                                </div>
                                            ) : (
                                                <code {...rest} className={className} ref={ref as any}>
                                                    {children}
                                                </code>
                                            )
                                        }
                                    }}
                                >
                                    {content}
                                </ReactMarkdown>
                            </article>
                        </div>
                    ) : (
                        <div className="rounded-lg overflow-hidden bg-white border border-gray-200 dark:bg-[#1e1e1e] dark:border-gray-700 transition-colors duration-300">
                            <SyntaxHighlighter
                                language={isJson ? 'json' : 'text'}
                                style={(isDark ? vscDarkPlus : vs) as any}
                                customStyle={{
                                    margin: 0,
                                    padding: '1.5rem',
                                    background: isDark ? '#1e1e1e' : '#ffffff',
                                    minHeight: '500px',
                                    fontSize: '14px',
                                    lineHeight: '1.6',
                                    transition: 'background-color 0.3s ease'
                                }}
                                showLineNumbers={true}
                                wrapLongLines={true}
                            >
                                {content}
                            </SyntaxHighlighter>
                        </div>
                    )}
                </div>

                {/* Gradient Fade at Bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white dark:from-[#050505] to-transparent pointer-events-none opacity-50"></div>
            </div>
        </div>
    );
}
