export type SiteNavIcon = 'home' | 'sparkles' | 'grid' | 'users' | 'layers' | 'book';

export type SiteNavItem = {
  id: 'home' | 'skills' | 'rankings' | 'occupations' | 'collections' | 'install';
  href: string;
  label: string;
  icon: SiteNavIcon;
  description: string;
};

export const PRIMARY_MARKETPLACE_NAV_IDS = [
  'home',
  'skills',
  'rankings',
  'occupations',
  'collections',
  'install',
] as const satisfies readonly SiteNavItem['id'][];

export const PRIMARY_MARKETPLACE_NAV_HREFS = (locale: string): string[] =>
  PRIMARY_MARKETPLACE_NAV_IDS.map((id) => {
    if (id === 'home') return `/${locale}`;
    if (id === 'rankings') return `/${locale}/popular`;
    if (id === 'install') return `/${locale}/docs/installation`;
    return `/${locale}/${id}`;
  });

const PRIMARY_MARKETPLACE_NAV_COPY: Record<SiteNavItem['id'], Omit<SiteNavItem, 'id' | 'href'>> = {
  home: {
    label: 'Home',
    icon: 'home',
    description: 'Marketplace home, search, and ranking entry points.',
  },
  skills: {
    label: 'Skills',
    icon: 'sparkles',
    description: 'Complete skill directory and filters.',
  },
  rankings: {
    label: 'Rankings',
    icon: 'grid',
    description: 'Popular and latest skills.',
  },
  occupations: {
    label: 'Occupations',
    icon: 'users',
    description: 'Browse skills by occupation and task.',
  },
  collections: {
    label: 'Collections',
    icon: 'layers',
    description: 'Curated collections for trusted paths and workflow decisions.',
  },
  install: {
    label: 'Install',
    icon: 'book',
    description: 'Installation guide and CLI setup path.',
  },
};

export function getPrimaryNavItems(locale: string): SiteNavItem[] {
  const isZh = locale.startsWith('zh');
  const hrefs = PRIMARY_MARKETPLACE_NAV_HREFS(locale);

  return PRIMARY_MARKETPLACE_NAV_IDS.map((id, index) => {
    const copy = PRIMARY_MARKETPLACE_NAV_COPY[id];
    const href = hrefs[index];
    const zhCopy: Record<SiteNavItem['id'], Pick<SiteNavItem, 'label' | 'description'>> = {
      home: {
        label: '首页',
        description: '市场首页、搜索和榜单入口。',
      },
      skills: {
        label: 'Skills',
        description: '完整技能目录与筛选。',
      },
      rankings: {
        label: '榜单',
        description: '热门与最新 Skills。',
      },
      occupations: {
        label: '职业',
        description: '按职业和任务浏览 Skills。',
      },
      collections: {
        label: '合集',
        description: '按可信路径和工作流决策浏览精选 Skills。',
      },
      install: {
        label: '安装',
        description: '安装指南与 CLI 配置路径。',
      },
    };

    return {
      id,
      href,
      label: isZh ? zhCopy[id].label : copy.label,
      icon: copy.icon,
      description: isZh ? zhCopy[id].description : copy.description,
    };
  });
}

export function getPrimaryNavItem(locale: string, id: SiteNavItem['id']) {
  return getPrimaryNavItems(locale).find((item) => item.id === id);
}
