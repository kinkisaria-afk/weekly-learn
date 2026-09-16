import Link from 'next/link';
import { RepoCard } from '@/components/RepoCard';
import { SubscribeForm } from '@/components/SubscribeForm';
import { prisma, toRepoView } from '@/lib/db';
import { getLocaleAndStrings } from '@/lib/server-locale';
import { formatWeek } from '@/lib/week';

export const dynamic = 'force-dynamic';

async function getLatestWeek(): Promise<string | null> {
  const latest = await prisma.repo.findFirst({
    orderBy: { weekOf: 'desc' },
    select: { weekOf: true },
  });
  return latest?.weekOf ?? null;
}

export default async function DashboardPage() {
  const { locale, t } = await getLocaleAndStrings();
  const week = await getLatestWeek();

  const repos = week
    ? (
        await prisma.repo.findMany({
          where: { weekOf: week },
          orderBy: { rank: 'asc' },
          include: { locales: true },
        })
      ).map((repo) => toRepoView(repo, locale))
    : [];

  const issue = week ? await prisma.issue.findUnique({ where: { weekOf: week } }) : null;

  return (
    <div className="mx-auto max-w-content px-6">
      <section className="border-b border-ink-800 py-16">
        <h1 className="max-w-prose text-4xl font-semibold leading-tight tracking-tight text-mist-100 sm:text-5xl">
          {t.heroTitle}
        </h1>
        <p className="mt-5 max-w-prose text-lg leading-relaxed text-mist-300">{t.heroBody}</p>
        <div className="mt-8">
          <SubscribeForm
            labels={{
              placeholder: t.subscribePlaceholder,
              button: t.subscribeButton,
              busy: t.subscribeBusy,
            }}
          />
        </div>
      </section>

      {week ? (
        <>
          <section className="flex flex-wrap items-end justify-between gap-4 py-10">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-mist-100">{t.thisWeek}</h2>
              <p className="mt-1.5 text-sm text-mist-400">
                {formatWeek(week)} · {t.projects(repos.length)}
              </p>
            </div>
            {issue && (
              <Link
                href={`/newsletter/${issue.slug}`}
                className="text-sm text-accent hover:underline"
              >
                {t.readIssue}
              </Link>
            )}
          </section>

          <div className="space-y-6 pb-8">
            {repos.map((repo) => (
              <RepoCard key={repo.id} repo={repo} t={t} />
            ))}
          </div>
        </>
      ) : (
        <section className="py-20">
          <div className="max-w-prose rounded-xl border border-ink-800 bg-ink-900 p-8">
            <h2 className="text-xl font-semibold text-mist-100">{t.emptyTitle}</h2>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-mist-300">
              The dashboard fills in once the weekly pipeline has run. Set{' '}
              <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-sm">
                ANTHROPIC_API_KEY
              </code>{' '}
              in <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-sm">.env</code>,
              then run:
            </p>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-ink-700 bg-ink-950 p-4 font-mono text-sm text-mist-200">
              npm run pipeline
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}
