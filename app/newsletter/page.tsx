import Link from 'next/link';
import { SubscribeForm } from '@/components/SubscribeForm';
import { prisma } from '@/lib/db';
import { getLocaleAndStrings } from '@/lib/server-locale';
import { formatWeek } from '@/lib/week';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Newsletter — Weekly Learn',
  description: 'A weekly five-minute read on what shipped in open source and what to learn from it.',
};

export default async function NewsletterIndex() {
  const { t } = await getLocaleAndStrings();
  const issues = await prisma.issue.findMany({ orderBy: { weekOf: 'desc' } });

  return (
    <div className="mx-auto max-w-prose px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-mist-100">Weekly newsletter</h1>
      <p className="mt-4 text-[1.0625rem] leading-relaxed text-mist-300">
        One five-minute read every Monday: the projects worth knowing about, what you can learn from
        them, and one Weekend Build worth your Saturday.
      </p>

      <div className="mt-8">
        <SubscribeForm
          labels={{
            placeholder: t.subscribePlaceholder,
            button: t.subscribeButton,
            busy: t.subscribeBusy,
          }}
        />
      </div>

      <div className="mt-14">
        {issues.length === 0 ? (
          <p className="text-mist-400">
            No issues published yet — run{' '}
            <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-sm">
              npm run pipeline
            </code>{' '}
            to generate the first one.
          </p>
        ) : (
          <ul className="divide-y divide-ink-800">
            {issues.map((issue) => (
              <li key={issue.id} className="py-5">
                <Link href={`/newsletter/${issue.slug}`} className="group block">
                  <p className="text-xs uppercase tracking-wider text-mist-400">
                    {formatWeek(issue.weekOf)}
                  </p>
                  <h2 className="mt-1.5 text-lg font-medium text-mist-100 group-hover:text-accent">
                    {issue.title}
                  </h2>
                  <p className="mt-1 text-sm text-mist-300">{issue.subtitle}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
