import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import { currentFile, selectFile } from '../stores/skill-files';
import { FileText, Folder, ChevronRight, ChevronDown, MoreHorizontal, Search, LayoutGrid, List } from 'lucide-react';

interface File {
    name: string;
    size?: string;
    type: 'file' | 'folder';
}

interface SkillFileManagerProps {
    files: File[];
    selectedFile?: string; // Legacy prop, can be initial value
    labels?: {
        explorer: string;
        project: string;
    };
}

export default function SkillFileManager({
    files,
    selectedFile: initialFile = 'SKILL.md',
    labels = { explorer: 'Explorer', project: 'Project' }
}: SkillFileManagerProps) {
    const [isProjectOpen, setIsProjectOpen] = useState(true);
    const selected = useStore(currentFile);

    // Initialize if needed (though repo.astro should probably do this)
    // useEffect(() => { if (initialFile) selectFile(initialFile); }, []);

    return (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-xl overflow-hidden border border-gray-200 dark:border-white/5 shadow-lg dark:shadow-none flex flex-col min-h-[200px] h-auto transition-colors duration-300">
            {/* Window Header */}
            <div className="h-10 bg-gray-100 dark:bg-[#252526] flex items-center justify-between px-4 border-b border-gray-200 dark:border-black/20 shrink-0 transition-colors duration-300">
                <div className="flex items-center gap-4">
                    <div className="flex gap-1.5 group">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-[inset_0_0_2px_rgba(0,0,0,0.2)] border border-[#e0443e] group-hover:brightness-90 transition-all"></div>
                        <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-[inset_0_0_2px_rgba(0,0,0,0.2)] border border-[#dea123] group-hover:brightness-90 transition-all"></div>
                        <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-[inset_0_0_2px_rgba(0,0,0,0.2)] border border-[#1aab29] group-hover:brightness-90 transition-all"></div>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest hidden md:inline-block select-none">{labels.explorer}</span>
                </div>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 bg-white dark:bg-[#1e1e1e] p-3 font-mono text-sm transition-colors duration-300">
                <div className="mb-4">
                    <div
                        className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        onClick={() => setIsProjectOpen(!isProjectOpen)}
                    >
                        {isProjectOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span>{labels.project}</span>
                    </div>
                </div>

                {isProjectOpen && (
                    <div className="space-y-0.5">
                        {files.map((file) => (
                            <div
                                key={file.name}
                                onClick={() => selectFile(file.name)}
                                className={`
                                    group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all
                                    ${selected === file.name
                                        ? 'bg-cyan-50 dark:bg-[#37373d] text-cyan-600 dark:text-cyan-400 font-medium border border-cyan-100 dark:border-white/5'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2a2d2e] hover:text-black dark:hover:text-gray-200 border border-transparent'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                    {file.type === 'folder' ? (
                                        <Folder size={15} className={selected === file.name ? 'fill-cyan-500/20 text-cyan-500 dark:fill-cyan-400/20 dark:text-cyan-400' : 'fill-gray-400/20 text-gray-400 dark:fill-gray-500/20 dark:text-gray-500'} />
                                    ) : (
                                        <FileText size={15} className={selected === file.name ? 'text-cyan-500 dark:text-cyan-400' : 'text-gray-400 dark:text-gray-500'} />
                                    )}
                                    <span className="truncate">{file.name}</span>
                                </div>
                                {file.size && (
                                    <span className={`text-[10px] ${selected === file.name ? 'text-cyan-500/70 dark:text-cyan-400/70' : 'text-gray-400/50 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-500'} font-mono`}>
                                        {file.size}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Status Bar */}
            <div className="h-7 bg-cyan-50 dark:bg-[#007acc] border-t border-cyan-100 dark:border-none px-3 flex items-center justify-between text-[10px] text-cyan-600 dark:text-white font-mono shrink-0 transition-colors duration-300">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-white animate-pulse"></div>
                    <span>Ready</span>
                </div>
                <span>UTF-8</span>
            </div>
        </div>
    );
}
