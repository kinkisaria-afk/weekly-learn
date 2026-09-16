/**
 * Generates the Chinese edition for repos that don't have one yet, without
 * re-running the English analysis. Useful after adding a locale, or to retry
 * editions that failed during a pipeline run.
 *
 *   npx tsx scripts/backfill-locale.ts            # all repos missing zh
 *   npx tsx scripts/backfill-locale.ts --week 2026-07-27
 *   npx tsx scripts/backfill-locale.ts --force    # rewrite existing editions
 */
import { analyzeRepoZh, assertCredentials, MissingCredentialsError } from '../lib/ai';
import { prisma } from '../lib/db';
import type { TrendingRepo } from '../lib/github';

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes('--force');
  const weekIndex = argv.indexOf('--week');
  const week = weekIndex >= 0 ? argv[weekIndex + 1] : undefined;

  await assertCredentials();

  const repos = await prisma.repo.findMany({
    where: week ? { weekOf: week } : {},
    orderBy: [{ weekOf: 'desc' }, { rank: 'asc' }],
    include: { locales: true },
  });

  const pending = repos.filter((r) => force || !r.locales.some((l) => l.locale === 'zh'));

  if (pending.length === 0) {
    console.log('Every repo already has a Chinese edition. Pass --force to rewrite.');
    return;
  }

  console.log(`Writing Chinese editions for ${pending.length} repo(s)...\n`);
  let ok = 0;

  for (const row of pending) {
    // The README is not stored, so the model works from the metadata and the
    // English analysis fields that came from it. Re-fetching the README would
    // be better but costs a GitHub round trip per repo.
    const repo: TrendingRepo = {
      fullName: row.fullName,
      owner: row.owner,
      name: row.name,
      url: row.url,
      description: row.description,
      language: row.language,
      stars: row.stars,
      starsGained: row.starsGained,
      forks: row.forks,
      readme: [
        `## What this project is`,
        row.summary,
        '',
        `## Why it matters`,
        row.whyItMatters,
        '',
        `## Key technologies`,
        (JSON.parse(row.technologies) as string[]).join(', '),
        '',
        `## Concepts involved`,
        (JSON.parse(row.learnTopics) as string[]).map((t) => `- ${t}`).join('\n'),
        '',
        `## Suggested learning path`,
        row.learningPath,
        '',
        `## A weekend-sized version`,
        `${row.cloneTitle}: ${row.cloneDescription}`,
        (JSON.parse(row.cloneFeatures) as string[]).map((f) => `- ${f}`).join('\n'),
        `Stack: ${(JSON.parse(row.cloneStack) as string[]).join(', ')}`,
        `Estimated time: ${row.cloneTimeEstimate}`,
      ].join('\n'),
    };

    try {
      const zh = await analyzeRepoZh(repo);
      const payload = {
        summary: zh.summary,
        whyItMatters: zh.whyItMatters,
        learnTopics: JSON.stringify(zh.learn.topics),
        learningPath: zh.learn.learningPath,
        cloneTitle: zh.clone.title,
        cloneDescription: zh.clone.description,
        cloneFeatures: JSON.stringify(zh.clone.features),
        cloneTimeEstimate: zh.clone.timeEstimate,
      };
      await prisma.repoLocale.upsert({
        where: { repoId_locale: { repoId: row.id, locale: 'zh' } },
        create: { repoId: row.id, locale: 'zh', ...payload },
        update: payload,
      });
      ok += 1;
      console.log(`  ${row.fullName} — ok`);
    } catch (error) {
      if (error instanceof MissingCredentialsError) throw error;
      console.error(`  ${row.fullName} — failed: ${(error as Error).message}`);
    }
  }

  console.log(`\nDone: ${ok}/${pending.length} written.\n`);
}

main()
  .catch((error) => {
    console.error(`\nBackfill failed: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
