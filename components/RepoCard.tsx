import type { RepoView } from '@/lib/db';
import type { UIStrings } from '@/lib/locale';

const DIFFICULTY_STYLES: Record<string, string> = {
  Beginner: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20',
  Intermediate: 'bg-amber-500/10 text-amber-300 ring-amber-500/20',
  Advanced: 'bg-rose-500/10 text-rose-300 ring-rose-500/20',
};

function Difficulty({ level, t }: { level: string; t: UIStrings }) {
  const style = DIFFICULTY_STYLES[level] ?? 'bg-ink-800 text-mist-300 ring-ink-600';
  const label = t.difficulty[level as keyof typeof t.difficulty] ?? level;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {label}
    </span>
  );
}

function formatStars(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(count);
}

export function RepoCard({ repo, t }: { repo: RepoView; t: UIStrings }) {
  return (
    <article className="rounded-xl border border-ink-800 bg-ink-900 transition-colors hover:border-ink-700">
      <div className="border-b border-ink-800 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <a
              href={repo.url}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-base text-mist-100 hover:text-accent"
            >
              <span className="text-mist-400">{repo.owner}/</span>
              <span className="font-semibold">{repo.name}</span>
            </a>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mist-400">
              {repo.language && <span>{repo.language}</span>}
              <span>★ {formatStars(repo.stars)}</span>
              {repo.starsGained > 0 && (
                <span className="text-emerald-400">
                  {t.thisWeekGained(formatStars(repo.starsGained))}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {repo.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {repo.fellBackToEnglish && t.zhUnavailable && (
          <p className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
            {t.zhUnavailable}
          </p>
        )}

        <p className="mt-4 text-[0.9375rem] leading-relaxed text-mist-200">{repo.summary}</p>

        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-mist-400">
            {t.whyItMatters}
          </h3>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-mist-200">{repo.whyItMatters}</p>
        </div>

        {repo.technologies.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-mist-400">
              {t.builtWith}
            </span>
            {repo.technologies.map((tech) => (
              <span
                key={tech}
                className="rounded border border-ink-700 px-2 py-0.5 font-mono text-xs text-mist-300"
              >
                {tech}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-px bg-ink-800 md:grid-cols-2">
        <section className="bg-ink-900 p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-mist-100">{t.learnFromIt}</h3>
            <Difficulty level={repo.difficulty} t={t} />
          </div>
          <ul className="mt-4 space-y-1.5">
            {repo.learnTopics.map((topic) => (
              <li key={topic} className="flex gap-2 text-sm text-mist-200">
                <span className="text-mist-400">·</span>
                {topic}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-mist-300">{repo.learningPath}</p>
        </section>

        <section className="bg-ink-900 p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-mist-100">{t.cloneThisIdea}</h3>
            <span className="text-xs text-mist-400">{repo.cloneTimeEstimate}</span>
          </div>
          <p className="mt-3 font-medium text-mist-100">{repo.cloneTitle}</p>
          <p className="mt-2 text-sm leading-relaxed text-mist-300">{repo.cloneDescription}</p>

          <ul className="mt-4 space-y-1.5">
            {repo.cloneFeatures.map((feature) => (
              <li key={feature} className="flex gap-2 text-sm text-mist-200">
                <span className="text-mist-400">·</span>
                {feature}
              </li>
            ))}
          </ul>

          {repo.cloneStack.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {repo.cloneStack.map((item) => (
                <span
                  key={item}
                  className="rounded border border-ink-700 px-2 py-0.5 font-mono text-xs text-mist-300"
                >
                  {item}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4">
            <Difficulty level={repo.cloneDifficulty} t={t} />
          </div>
        </section>
      </div>
    </article>
  );
}
