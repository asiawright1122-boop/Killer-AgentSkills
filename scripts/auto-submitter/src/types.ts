/**
 * Auto-Submitter 类型定义
 */

export interface ProductMeta {
    name: string;
    url: string;
    tagline: string;
    descriptions: {
        micro: string;   // < 60 chars
        short: string;   // < 160 chars
        long: string;    // < 1000 chars
    };
    categories: string[];
    tags: string[];
    pricing: string;
    pricing_detail: string;
    founder: {
        name: string;
        email: string;
        twitter: string;
    };
    assets: {
        logo: string;
        cover: string;
        screenshots: string[];
    };
    links: {
        website: string;
        github: string;
        docs: string;
    };
    year_founded: string;
}

export interface SpintaxProductMeta {
    name: string[];
    url: string;
    tagline: string[];
    descriptions: {
        micro: string[];
        short: string[];
        long: string[];
    };
    categories: string[];
    tags: string[];
    pricing: string;
    pricing_detail: string;
    founder: {
        name: string;
        email: string;
        twitter: string;
    };
    assets: {
        logo: string;
        cover: string;
        screenshots: string[];
    };
    links: {
        website: string;
        github: string;
        docs: string;
    };
    year_founded: string;
}

export type SubmitStatus = 'success' | 'failed' | 'skipped' | 'pending_review';

export interface SubmitResult {
    site: string;
    url: string;
    status: SubmitStatus;
    message: string;
    screenshot?: string;
    duration: number;  // ms
    timestamp: string;
}

export interface SiteConfig {
    /** 站点唯一标识 */
    id: string;
    /** 站点显示名 */
    name: string;
    /** 提交页 URL */
    submitUrl: string;
    /** 站点主页 */
    homepage: string;
    /** 预估 DR（Domain Rating）*/
    estimatedDR: number;
    /** 梯队 */
    tier: 1 | 2 | 3;
    /** 是否需要登录 */
    requiresLogin: boolean;
    /** 是否有验证码 */
    hasCaptcha: boolean;
    /** 是否已启用 */
    enabled: boolean;
}

export interface AdapterContext {
    meta: ProductMeta;
    assetsDir: string;
    logsDir: string;
    screenshotDir: string;
    headless: boolean;
    timeout: number;
    dryRun: boolean;
}
