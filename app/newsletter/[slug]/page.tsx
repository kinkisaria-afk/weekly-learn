import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { renderMarkdown } from '@/lib/markdown';
import { formatWeek } from '@/lib/week';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const issue = await prisma.issue.findUnique({ where: { slug } });
  if (!issue) return { title: 'Issue not found — Weekly Learn' };
  return { title: `${issue.title} — Weekly Learn`, description: issue.subtitle };
}

export default async function IssuePage({ params }: Props) {
  const { slug } = await params;
  const issue = await prisma.issue.findUnique({
    where: { slug },
    include: { featuredRepo: true },
  });

  if (!issue) notFound();

  return (
    <article className="mx-auto max-w-prose px-6 py-16">
      <Link href="/newsletter" className="text-sm text-mist-400 hover:text-mist-200">
        &larr; All issues
      </Link>

      <p className="mt-8 text-xs uppercase tracking-wider text-mist-400">
        {formatWeek(issue.weekOf)}
      </p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-mist-100">
        {issue.title}
      </h1>
      <p className="mt-3 text-lg text-mist-300">{issue.subtitle}</p>

      <div
        className="prose-issue mt-10"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(issue.markdown) }}
      />

      {issue.featuredRepo && (
        <aside className="mt-12 rounded-xl border border-accent/20 bg-accent-soft/30 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            This week&apos;s Weekend Build
          </p>
          <h2 className="mt-2 text-lg font-medium text-mist-100">{issue.featuredRepo.cloneTitle}</h2>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-mist-200">
            {issue.featuredRepo.cloneDescription}
          </p>
          <p className="mt-4 text-sm text-mist-400">
            Inspired by{' '}
            <a
              href={issue.featuredRepo.url}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-accent hover:underline"
            >
              {issue.featuredRepo.fullName}
            </a>{' '}
            · {issue.featuredRepo.cloneTimeEstimate}
          </p>
        </aside>
      )}

      <div className="mt-12 border-t border-ink-800 pt-8">
        <Link href="/" className="text-sm text-accent hover:underline">
          Explore every project on the dashboard &rarr;
        </Link>
      </div>
    </article>
  );
}
