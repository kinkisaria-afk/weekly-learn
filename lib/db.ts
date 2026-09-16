import { PrismaClient } from '@prisma/client';
import type { Locale } from './locale';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/** Fields persisted as JSON strings for SQLite/Postgres portability. */
const JSON_FIELDS = ['technologies', 'tags', 'learnTopics', 'cloneFeatures', 'cloneStack'] as const;

export type RepoRecord = Awaited<ReturnType<typeof prisma.repo.findFirst>>;
type LocaleRecord = Awaited<ReturnType<typeof prisma.repoLocale.findFirst>>;

export type RepoView = Omit<NonNullable<RepoRecord>, (typeof JSON_FIELDS)[number]> & {
  technologies: string[];
  tags: string[];
  learnTopics: string[];
  cloneFeatures: string[];
  cloneStack: string[];
  /** True when the requested locale had no edition and English is shown instead. */
  fellBackToEnglish: boolean;
};

function parseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Merges a repo with its locale edition when one exists. English content lives
 * on Repo itself and is the fallback, so a missing edition degrades to English
 * rather than to empty fields.
 */
export function toRepoView(
  repo: NonNullable<RepoRecord> & { locales?: NonNullable<LocaleRecord>[] },
  locale: Locale = 'en',
): RepoView {
  const edition = locale === 'en' ? null : repo.locales?.find((l) => l.locale === locale);

  return {
    ...repo,
    summary: edition?.summary ?? repo.summary,
    whyItMatters: edition?.whyItMatters ?? repo.whyItMatters,
    learningPath: edition?.learningPath ?? repo.learningPath,
    cloneTitle: edition?.cloneTitle ?? repo.cloneTitle,
    cloneDescription: edition?.cloneDescription ?? repo.cloneDescription,
    cloneTimeEstimate: edition?.cloneTimeEstimate ?? repo.cloneTimeEstimate,
    learnTopics: parseList(edition?.learnTopics ?? repo.learnTopics),
    cloneFeatures: parseList(edition?.cloneFeatures ?? repo.cloneFeatures),
    // Untranslated by design: proper nouns and enum values.
    technologies: parseList(repo.technologies),
    tags: parseList(repo.tags),
    cloneStack: parseList(repo.cloneStack),
    fellBackToEnglish: locale !== 'en' && !edition,
  };
}
