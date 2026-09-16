export const LOCALES = ['en', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = 'lfg-locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * UI chrome strings. Generated content (summaries, learning paths, clone
 * ideas) is written per-locale by the pipeline and stored in RepoLocale —
 * only interface text lives here.
 */
export const UI = {
  en: {
    tagline: 'trends → skills → projects',
    navDashboard: 'Dashboard',
    navNewsletter: 'Newsletter',
    heroTitle: 'Turn open-source trends into learning opportunities.',
    heroBody:
      'GitHub already tells you what is trending. This tells you why it matters, what concepts sit underneath it, and what you could build this weekend instead of just starring it.',
    thisWeek: 'This week',
    projects: (n: number) => `${n} project${n === 1 ? '' : 's'}`,
    readIssue: "Read this week's issue →",
    whyItMatters: 'Why it matters',
    builtWith: 'Built with',
    learnFromIt: 'Learn from it',
    cloneThisIdea: 'Clone this idea',
    thisWeekGained: (stars: string) => `+${stars} this week`,
    difficulty: { Beginner: 'Beginner', Intermediate: 'Intermediate', Advanced: 'Advanced' },
    emptyTitle: 'No projects analyzed yet',
    footerDisclaimer:
      'Repository data from GitHub Trending. Summaries, learning paths, and project ideas are AI-generated — verify before relying on them.',
    subscribePlaceholder: 'you@example.com',
    subscribeButton: 'Get the weekly issue',
    subscribeBusy: 'Joining…',
    zhUnavailable: null as string | null,
  },
  zh: {
    tagline: '趋势 → 技能 → 项目',
    navDashboard: '本周项目',
    navNewsletter: '周刊',
    heroTitle: '把开源趋势变成你的学习机会。',
    heroBody:
      'GitHub 只告诉你什么在火。这里告诉你它为什么重要、背后有哪些值得掌握的概念，以及这个周末你可以动手做点什么——而不是点个 star 就划走。',
    thisWeek: '本周',
    projects: (n: number) => `${n} 个项目`,
    readIssue: '阅读本周周刊 →',
    whyItMatters: '为什么值得关注',
    builtWith: '技术栈',
    learnFromIt: '能学到什么',
    cloneThisIdea: '周末复刻',
    thisWeekGained: (stars: string) => `本周 +${stars}`,
    difficulty: { Beginner: '入门', Intermediate: '进阶', Advanced: '高级' },
    emptyTitle: '还没有分析过的项目',
    footerDisclaimer:
      '仓库数据来自 GitHub Trending。摘要、学习路径和项目点子由 AI 生成，请自行判断后再采用。',
    subscribePlaceholder: 'you@example.com',
    subscribeButton: '订阅每周一期',
    subscribeBusy: '订阅中…',
    zhUnavailable: '该项目的中文内容尚未生成，以下为英文原文。',
  },
} as const;

export type UIStrings = (typeof UI)[Locale];
