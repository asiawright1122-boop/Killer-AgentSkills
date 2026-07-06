export type SiteNavIcon = 'home' | 'sparkles' | 'grid' | 'users' | 'layers';

export type SiteNavItem = {
  id: 'home' | 'skills' | 'rankings' | 'occupations' | 'categories';
  href: string;
  label: string;
  icon: SiteNavIcon;
  description: string;
};

export function getPrimaryNavItems(locale: string): SiteNavItem[] {
  const isZh = locale.startsWith('zh');

  return [
    {
      id: 'home',
      href: `/${locale}`,
      label: isZh ? '首页' : 'Home',
      icon: 'home',
      description: isZh ? '市场首页、搜索和榜单入口。' : 'Marketplace home, search, and ranking entry points.',
    },
    {
      id: 'skills',
      href: `/${locale}/skills`,
      label: 'Skills',
      icon: 'sparkles',
      description: isZh ? '完整技能目录与筛选。' : 'Complete skill directory and filters.',
    },
    {
      id: 'rankings',
      href: `/${locale}/popular`,
      label: isZh ? '榜单' : 'Rankings',
      icon: 'grid',
      description: isZh ? '热门与最新 Skills。' : 'Popular and latest skills.',
    },
    {
      id: 'occupations',
      href: `/${locale}/occupations`,
      label: isZh ? '职业' : 'Occupations',
      icon: 'users',
      description: isZh ? '按职业和任务浏览 Skills。' : 'Browse skills by occupation and task.',
    },
    {
      id: 'categories',
      href: `/${locale}/categories`,
      label: isZh ? '分类' : 'Categories',
      icon: 'layers',
      description: isZh ? '按能力类型浏览 Skills。' : 'Browse skills by capability type.',
    },
  ];
}

export function getPrimaryNavItem(locale: string, id: SiteNavItem['id']) {
  return getPrimaryNavItems(locale).find((item) => item.id === id);
}
