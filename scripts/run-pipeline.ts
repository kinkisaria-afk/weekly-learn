/**
 * Weekly content pipeline: fetch trending repos, analyze them, persist the
 * results, generate the newsletter, and optionally email subscribers.
 *
 * Usage:
 *   npm run pipeline               fetch + analyze + newsletter (email dry run)
 *   npm run pipeline:send          same, but actually send
 *   npm run pipeline -- --limit 5  analyze fewer repos
 */
import {
  analyzeRepo,
  analyzeRepoZh,
  assertCredentials,
  MissingCredentialsError,
  writeNewsletter,
  type Analysis,
} from '../lib/ai';
import { prisma } from '../lib/db';
import { buildEmailHtml, sendIssue } from '../lib/email';
import { enrich, fetchTrending, type TrendingRepo } from '../lib/github';
import { renderMarkdown } from '../lib/markdown';
import { weekOf } from '../lib/week';

type Options = { limit: number; send: boolean; force: boolean; zh: boolean };

function parseArgs(argv: string[]): Options {
  const opts: Options = { limit: 10, send: false, force: false, zh: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--send') opts.send = true;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--no-zh') opts.zh = false;
    else if (arg === '--limit') {
      const value = Number(argv[i + 1]);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error(`--limit needs a positive integer, got "${argv[i + 1]}"`);
      }
      opts.limit = value;
      i += 1;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const week = weekOf();

  console.log(`\nLearnFromGithub pipeline — week of ${week}\n`);

  // Fail before spending time on GitHub requests we could not act on.
  await assertCredentials();

  console.log('1/6  Fetching trending repositories...');
  const trending = await fetchTrending(opts.limit);
  console.log(`     Found ${trending.length} repos.`);

  console.log('\n2/6  Enriching with GitHub metadata and READMEs...');
  if (!process.env.GITHUB_TOKEN) {
    console.log('     No GITHUB_TOKEN — using unauthenticated API (60 req/hr limit).');
  }
  const enriched: TrendingRepo[] = [];
  for (const repo of trending) {
    try {
      enriched.push(await enrich(repo));
      console.log(`     ${repo.fullName}`);
    } catch (error) {
      console.error(`     Skipped ${repo.fullName}: ${(error as Error).message}`);
    }
  }

  console.log('\n3/6  Analyzing with Claude...');
  const analyzed: Array<{ repo: TrendingRepo; analysis: Analysis }> = [];
  for (const repo of enriched) {
    if (!opts.force) {
      const existing = await prisma.repo.findUnique({
        where: { fullName_weekOf: { fullName: repo.fullName, weekOf: week } },
      });
      if (existing) {
        console.log(`     ${repo.fullName} — already analyzed this week, skipping`);
        continue;
      }
    }
    try {
      const analysis = await analyzeRepo(repo);
      analyzed.push({ repo, analysis });
      console.log(`     ${repo.fullName} — ${analysis.learn.difficulty}, ${analysis.tags.join(', ')}`);
    } catch (error) {
      // A missing credential will fail identically for every remaining repo.
      if (error instanceof MissingCredentialsError) throw error;
      console.error(`     Failed ${repo.fullName}: ${(error as Error).message}`);
    }
  }

  console.log('\n4/6  Saving analyses...');
  const repoIds = new Map<string, string>();
  for (const [index, { repo, analysis }] of analyzed.entries()) {
    const data = {
      owner: repo.owner,
      name: repo.name,
      url: repo.url,
      description: repo.description,
      language: repo.language,
      stars: repo.stars,
      starsGained: repo.starsGained,
      forks: repo.forks,
      summary: analysis.summary,
      whyItMatters: analysis.whyItMatters,
      technologies: JSON.stringify(analysis.technologies),
      tags: JSON.stringify(analysis.tags),
      learnTopics: JSON.stringify(analysis.learn.topics),
      difficulty: analysis.learn.difficulty,
      learningPath: analysis.learn.learningPath,
      cloneTitle: analysis.clone.title,
      cloneDescription: analysis.clone.description,
      cloneFeatures: JSON.stringify(analysis.clone.features),
      cloneStack: JSON.stringify(analysis.clone.stack),
      cloneDifficulty: analysis.clone.difficulty,
      cloneTimeEstimate: analysis.clone.timeEstimate,
      rank: index,
    };

    const saved = await prisma.repo.upsert({
      where: { fullName_weekOf: { fullName: repo.fullName, weekOf: week } },
      create: { fullName: repo.fullName, weekOf: week, ...data },
      update: data,
    });
    repoIds.set(repo.fullName, saved.id);
  }
  console.log(`     Saved ${analyzed.length} repos.`);

  if (opts.zh && analyzed.length > 0) {
    console.log('\n     Writing Chinese editions...');
    for (const { repo } of analyzed) {
      const repoId = repoIds.get(repo.fullName);
      if (!repoId) continue;
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
          where: { repoId_locale: { repoId, locale: 'zh' } },
          create: { repoId, locale: 'zh', ...payload },
          update: payload,
        });
        console.log(`     ${repo.fullName} — zh ok`);
      } catch (error) {
        if (error instanceof MissingCredentialsError) throw error;
        // English is already saved and acts as the fallback, so a failed
        // edition degrades the page rather than breaking it.
        console.error(`     ${repo.fullName} — zh failed: ${(error as Error).message}`);
      }
    }
  }

  console.log('\n5/6  Generating the weekly newsletter...');
  const weekRepos = await prisma.repo.findMany({ where: { weekOf: week }, orderBy: { rank: 'asc' } });
  if (weekRepos.length === 0) {
    console.log('     No repos stored for this week — skipping newsletter.');
    return;
  }

  const existingIssue = await prisma.issue.findUnique({ where: { weekOf: week } });
  let issue = existingIssue;

  if (!issue || opts.force) {
    // Re-derive the analysis shape from stored rows so a --force newsletter run
    // does not require re-analyzing every repo.
    const source = weekRepos.map((row) => ({
      repo: {
        fullName: row.fullName,
        owner: row.owner,
        name: row.name,
        url: row.url,
        description: row.description,
        language: row.language,
        stars: row.stars,
        starsGained: row.starsGained,
        forks: row.forks,
        readme: null,
      } as TrendingRepo,
      analysis: {
        summary: row.summary,
        whyItMatters: row.whyItMatters,
        technologies: JSON.parse(row.technologies),
        tags: JSON.parse(row.tags),
        learn: {
          topics: JSON.parse(row.learnTopics),
          difficulty: row.difficulty as Analysis['learn']['difficulty'],
          learningPath: row.learningPath,
        },
        clone: {
          title: row.cloneTitle,
          description: row.cloneDescription,
          features: JSON.parse(row.cloneFeatures),
          stack: JSON.parse(row.cloneStack),
          difficulty: row.cloneDifficulty as Analysis['clone']['difficulty'],
          timeEstimate: row.cloneTimeEstimate,
        },
      } satisfies Analysis,
    }));

    const draft = await writeNewsletter(source, week);
    const featured = weekRepos.find((r) => r.fullName === draft.featuredFullName) ?? weekRepos[0];
    const html = buildEmailHtml({ ...draft, weekOf: week });

    const payload = {
      title: draft.title,
      subtitle: draft.subtitle,
      markdown: draft.markdown,
      html,
      featuredRepoId: featured.id,
    };

    issue = await prisma.issue.upsert({
      where: { weekOf: week },
      create: { slug: week, weekOf: week, ...payload },
      update: payload,
    });
    console.log(`     "${issue.title}"`);
    console.log(`     Weekend Build: ${featured.fullName}`);
  } else {
    console.log(`     Issue for this week already exists — reusing. Pass --force to regenerate.`);
  }

  console.log('\n6/6  Sending to subscribers...');
  if (!opts.send) {
    console.log('     Skipped (pass --send, or run `npm run pipeline:send`).');
  } else {
    const subscribers = await prisma.subscriber.findMany({
      where: { unsubscribedAt: null },
      select: { email: true },
    });
    const result = await sendIssue(issue, subscribers.map((s) => s.email));
    if (result.sent > 0) {
      await prisma.issue.update({
        where: { id: issue.id },
        data: { sentAt: new Date(), recipientCount: result.sent },
      });
      console.log(`     Sent to ${result.sent} subscriber(s).`);
    }
  }

  // Touch the renderer so a malformed newsletter surfaces here, not in the UI.
  renderMarkdown(issue.markdown);

  console.log('\nDone. Run `npm run dev` to view the dashboard.\n');
}

main()
  .catch((error) => {
    console.error(`\nPipeline failed: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
