export interface SeoData {
    title: Record<string, string>;
    definition: Record<string, string>;
    features: Record<string, string[]>;
    keywords: Record<string, string[]>;
}

export interface AgentAnalysis {
    suitability: string;
    recommendation: string;
    useCases: string[];
    limitations: string[];
}

export interface TranslateContext {
    name?: string;
    topics?: string[];
    bodyPreview?: string;
}

export interface SkillCache {
    id: string;
    name: string;
    description: string | Record<string, string>;
    owner: string;
    repo: string;
    repoPath: string;
    stars: number;
    forks: number;
    updatedAt: string;
    topics: string[];
    skillMd?: {
        name: string;
        description: string;
        version?: string;
        tags?: string[];
        bodyPreview: string;
        body?: string;
    };
    qualityScore?: number;
    category?: string;
    lastSynced: string;
    seo?: SeoData;
    agentAnalysis?: AgentAnalysis;
}

export interface CacheData {
    version: number;
    lastUpdated: string;
    totalCount: number;
    skills: SkillCache[];
}
