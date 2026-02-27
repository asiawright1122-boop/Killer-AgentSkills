/**
 * SubmitEngine — 提交引擎核心
 *
 * 负责：载入物料、创建适配器、队列执行提交、汇总结果报告
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ProductMeta, SpintaxProductMeta, SubmitResult, SiteConfig, AdapterContext } from './types.js';
import { SITES } from './sites.js';
import { GenericFormAdapter } from './adapters/generic-form.js';
import { BaseAdapter } from './base-adapter.js';

interface EngineOptions {
    /** 只提交指定站点（ID 列表），为空则提交所有启用的 */
    only?: string[];
    /** 排除指定站点 */
    exclude?: string[];
    /** 只提交指定梯队 */
    tier?: number;
    /** 无头模式（默认 true） */
    headless?: boolean;
    /** 页面超时（ms）*/
    timeout?: number;
    /** Dry run：只截图不提交 */
    dryRun?: boolean;
    /** 两次提交之间的间隔（ms）*/
    delay?: number;
    /** 用户数据目录路径，用于半自动模式维持登录态 */
    userDataDir?: string;
}

export class SubmitEngine {
    private spintaxMeta!: SpintaxProductMeta;
    private options: Required<Omit<EngineOptions, 'userDataDir'>> & { userDataDir?: string };
    private results: SubmitResult[] = [];
    private baseDir: string;

    constructor(opts: EngineOptions = {}) {
        this.options = {
            only: opts.only ?? [],
            exclude: opts.exclude ?? [],
            tier: opts.tier ?? 0,
            headless: opts.headless ?? true,
            timeout: opts.timeout ?? 30000,
            dryRun: opts.dryRun ?? false,
            delay: opts.delay ?? 5000,
            userDataDir: opts.userDataDir,
        };

        this.baseDir = path.dirname(new URL(import.meta.url).pathname);
    }

    /** 执行提交 */
    async run(): Promise<SubmitResult[]> {
        // 1. 加载物料
        this.loadMeta();

        // 2. 筛选站点
        const sites = this.filterSites();
        if (sites.length === 0) {
            console.log('❌ 没有可提交的站点');
            return [];
        }

        console.log(`\n${'═'.repeat(60)}`);
        console.log(`  🚀 Auto-Submitter Engine`);
        console.log(`  📦 产品: ${this.spintaxMeta.name[0]}`);
        console.log(`  🎯 目标: ${sites.length} 个站点`);
        console.log(`  🔧 模式: ${this.options.dryRun ? 'DRY RUN（仅截图）' : '正式提交'}`);
        console.log(`  👁️  显示: ${this.options.headless ? '无头模式' : '有头模式'}`);
        console.log(`${'═'.repeat(60)}\n`);

        // 3. 逐站提交（串行队列，避免触发风控）
        for (let i = 0; i < sites.length; i++) {
            const site = sites[i];
            console.log(`\n[${i + 1}/${sites.length}] ─── ${site.name} ───`);

            const adapter = this.createAdapter(site);
            const result = await adapter.execute();
            this.results.push(result);

            // 站间延迟（最后一个不等待）
            if (i < sites.length - 1 && this.options.delay > 0) {
                console.log(`  ⏱️  等待 ${this.options.delay / 1000}s 后继续...`);
                await this.sleep(this.options.delay);
            }
        }

        // 4. 输出报告
        this.printReport();

        // 5. 保存结果到 JSON
        this.saveResults();

        return this.results;
    }

    // ─── 内部方法 ─────────────────────────────────

    private loadMeta() {
        const metaPath = path.resolve(this.baseDir, '..', 'product-meta.json');
        if (!fs.existsSync(metaPath)) {
            throw new Error(`找不到产品物料: ${metaPath}`);
        }
        this.spintaxMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        console.log(`✅ 已加载产品物料 (Spintax): ${this.spintaxMeta.name[0]}`);
    }

    private generateSpunMeta(): ProductMeta {
        const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
        return {
            ...this.spintaxMeta,
            name: pick(this.spintaxMeta.name),
            tagline: pick(this.spintaxMeta.tagline),
            descriptions: {
                micro: pick(this.spintaxMeta.descriptions.micro),
                short: pick(this.spintaxMeta.descriptions.short),
                long: pick(this.spintaxMeta.descriptions.long),
            }
        };
    }

    private filterSites(): SiteConfig[] {
        let sites = SITES.filter(s => s.enabled);

        if (this.options.tier > 0) {
            sites = sites.filter(s => s.tier === this.options.tier);
        }

        if (this.options.only.length > 0) {
            sites = SITES.filter(s => this.options.only.includes(s.id));
        }

        if (this.options.exclude.length > 0) {
            sites = sites.filter(s => !this.options.exclude.includes(s.id));
        }

        return sites;
    }

    private createAdapter(site: SiteConfig): BaseAdapter {
        const rootDir = path.resolve(this.baseDir, '..');
        const spunMeta = this.generateSpunMeta();
        const ctx: AdapterContext = {
            meta: spunMeta,
            assetsDir: path.join(rootDir, 'assets'),
            logsDir: path.join(rootDir, 'logs'),
            screenshotDir: path.join(rootDir, 'logs', 'screenshots'),
            headless: this.options.headless,
            timeout: this.options.timeout,
            dryRun: this.options.dryRun,
            userDataDir: this.options.userDataDir,
        };

        // 目前统一使用通用适配器，后续可根据 site.id 分配专用适配器
        return new GenericFormAdapter(site, ctx);
    }

    private printReport() {
        const success = this.results.filter(r => r.status === 'success' || r.status === 'pending_review');
        const failed = this.results.filter(r => r.status === 'failed');
        const skipped = this.results.filter(r => r.status === 'skipped');

        console.log(`\n${'═'.repeat(60)}`);
        console.log(`  📊 提交报告`);
        console.log(`${'═'.repeat(60)}`);
        console.log(`  ✅ 成功/待审: ${success.length}`);
        console.log(`  ❌ 失败:     ${failed.length}`);
        console.log(`  ⏭️  跳过:     ${skipped.length}`);
        console.log(`${'─'.repeat(60)}`);

        for (const r of this.results) {
            const icon = r.status === 'success' || r.status === 'pending_review' ? '✅'
                : r.status === 'skipped' ? '⏭️'
                    : '❌';
            const dur = (r.duration / 1000).toFixed(1);
            console.log(`  ${icon} ${r.site.padEnd(25)} ${r.status.padEnd(15)} ${dur}s`);
        }

        console.log(`${'═'.repeat(60)}\n`);
    }

    private saveResults() {
        const rootDir = path.resolve(this.baseDir, '..');
        const logsDir = path.join(rootDir, 'logs');
        if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

        const filename = `report_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const filepath = path.join(logsDir, filename);
        fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
        console.log(`💾 报告已保存: ${filepath}`);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
