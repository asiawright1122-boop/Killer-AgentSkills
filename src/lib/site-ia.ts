export type SiteNavIcon = 'home' | 'sparkles' | 'grid' | 'users' | 'layers';

export type SiteNavItem = {
  id: 'home' | 'skills' | 'rankings' | 'occupations' | 'categories';
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
  'categories',
] as const satisfies readonly SiteNavItem['id'][];

export const PRIMARY_MARKETPLACE_NAV_HREFS = (locale: string): string[] =>
  PRIMARY_MARKETPLACE_NAV_IDS.map((id) => {
    if (id === 'home') return `/${locale}`;
    if (id === 'rankings') return `/${locale}/popular`;
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
  categories: {
    label: 'Categories',
    icon: 'layers',
    description: 'Browse skills by capability type.',
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
      categories: {
        label: '分类',
        description: '按能力类型浏览 Skills。',
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
