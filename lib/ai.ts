import Anthropic from '@anthropic-ai/sdk';
import type { TrendingRepo } from './github';

// DeepSeek exposes an Anthropic-compatible endpoint (https://api.deepseek.com/anthropic),
// so we keep the Anthropic SDK and point it at DeepSeek via ANTHROPIC_BASE_URL and
// ANTHROPIC_API_KEY. claude-* names are auto-mapped by DeepSeek (claude-opus* ->
// deepseek-v4-pro; claude-sonnet*/haiku* -> deepseek-flash); we default to deepseek-flash.
const MODEL = process.env.ANTHROPIC_MODEL ?? 'deepseek-flash';
const EFFORT = (process.env.ANTHROPIC_EFFORT ?? 'high') as 'low' | 'medium' | 'high' | 'xhigh' | 'max';

let client: Anthropic | null = null;

/**
 * Thrown when Claude credentials are absent or rejected. Either way every
 * subsequent request fails the same way, so callers should stop rather than
 * retry per repository.
 */
export class MissingCredentialsError extends Error {
  constructor(rejected = false) {
    super(
      rejected
        ? 'DeepSeek rejected the credentials (401). Check ANTHROPIC_API_KEY in .env — ' +
            'it should hold your DeepSeek API key (https://platform.deepseek.com/api_keys).'
        : 'No API credentials found. Set ANTHROPIC_API_KEY in .env to your DeepSeek API key ' +
            '(https://platform.deepseek.com/api_keys).',
    );
    this.name = 'MissingCredentialsError';
  }
}

function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

/**
 * The SDK resolves credentials lazily, so a missing key surfaces as a generic
 * error on the first request rather than at construction. Recognize it and
 * re-throw something the caller can act on.
 */
function rethrowAuthErrors(error: unknown): never {
  const auth = classifyAuthError(error);
  if (auth) throw new MissingCredentialsError(auth.rejected);
  throw error;
}

/**
 * Confirms credentials resolve before the pipeline spends time on GitHub
 * requests, using the cheapest call available (a one-token completion).
 * DeepSeek's Anthropic-compatible endpoint does not expose count_tokens.
 */
export async function assertCredentials(): Promise<void> {
  try {
    await getClient().messages.create({
      model: MODEL,
      max_tokens: 1,
      // DeepSeek enables thinking mode by default, which is unnecessary for a
      // one-token credential ping and would eat the whole budget on reasoning.
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: 'ping' }],
    });
  } catch (error) {
    const auth = classifyAuthError(error);
    if (auth) throw new MissingCredentialsError(auth.rejected);
    // Anything else (network blip, rate limit, transient 5xx) is not a reason
    // to abandon the run — the real requests get their own error handling.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`     Could not verify credentials up front: ${message}`);
  }
}

/** `null` when the error is not credential-related. */
function classifyAuthError(error: unknown): { rejected: boolean } | null {
  const message = error instanceof Error ? error.message : String(error);
  // A 401 means the credential exists but the API refused it.
  if (error instanceof Anthropic.AuthenticationError || /authentication_error/i.test(message)) {
    return { rejected: true };
  }
  // The SDK raises this before sending when it finds no credential source.
  if (/could not resolve authentication/i.test(message)) return { rejected: false };
  return null;
}

export type Analysis = {
  summary: string;
  whyItMatters: string;
  technologies: string[];
  tags: string[];
  learn: {
    topics: string[];
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
    learningPath: string;
  };
  clone: {
    title: string;
    description: string;
    features: string[];
    stack: string[];
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
    timeEstimate: string;
  };
};

const DIFFICULTY = ['Beginner', 'Intermediate', 'Advanced'];

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'Two sentences on what this project is, in plain language a student would follow.',
    },
    whyItMatters: {
      type: 'string',
      description:
        'One short paragraph on why this project is significant right now — the problem it solves or the shift it signals. Not a feature list.',
    },
    technologies: {
      type: 'array',
      items: { type: 'string' },
      description: 'Main languages, frameworks, and notable libraries. 3-6 entries.',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Category tags such as AI Agent, Browser Automation, RAG, MCP, DevTools, Infrastructure. 2-4 entries.',
    },
    learn: {
      type: 'object',
      properties: {
        topics: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Concepts and skills a developer needs in order to understand or rebuild this. Concepts, not features. 3-6 entries.',
        },
        difficulty: { type: 'string', enum: DIFFICULTY },
        learningPath: {
          type: 'string',
          description:
            'One short paragraph describing an effective order to learn these topics, and what to build along the way.',
        },
      },
      required: ['topics', 'difficulty', 'learningPath'],
      additionalProperties: false,
    },
    clone: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Name for the simplified weekend version.' },
        description: {
          type: 'string',
          description: 'Two sentences describing a scoped-down MVP that is genuinely achievable in a weekend.',
        },
        features: {
          type: 'array',
          items: { type: 'string' },
          description: 'Core features only — the minimum that still demonstrates the idea. 3-5 entries.',
        },
        stack: {
          type: 'array',
          items: { type: 'string' },
          description: 'Suggested tech stack for the weekend build. 3-6 entries.',
        },
        difficulty: { type: 'string', enum: DIFFICULTY },
        timeEstimate: {
          type: 'string',
          description: 'Realistic build time, e.g. "4-6 hours" or "1 weekend".',
        },
      },
      required: ['title', 'description', 'features', 'stack', 'difficulty', 'timeEstimate'],
      additionalProperties: false,
    },
  },
  required: ['summary', 'whyItMatters', 'technologies', 'tags', 'learn', 'clone'],
  additionalProperties: false,
} as const;

const SYSTEM = `You write for LearnFromGithub, which turns trending open-source projects into learning material and side-project ideas.

Your readers are CS students, engineers preparing for interviews, and developers hunting for something to build. They can already read a README. What they cannot easily do is judge why a project matters, work out which concepts underpin it, or scope a version they could actually finish.

So: explain significance, not features. Name the concepts a developer would have to learn, not the repo's own module names. Make every "clone this idea" genuinely buildable in a weekend by one person — if the real project needs a cluster, the weekend version runs on a laptop.

Be concrete and specific. Skip marketing language, and never claim a capability the README does not support.`;

function repoBrief(repo: TrendingRepo): string {
  return [
    `Repository: ${repo.fullName}`,
    `URL: ${repo.url}`,
    `Description: ${repo.description ?? '(none)'}`,
    `Primary language: ${repo.language ?? 'unknown'}`,
    `Stars: ${repo.stars} (${repo.starsGained} gained this week)`,
    '',
    'README (may be truncated):',
    repo.readme ?? '(README unavailable)',
  ].join('\n');
}

const ANALYSIS_TOOL = {
  name: 'submit_analysis',
  description: 'Submit the structured analysis of a trending repository.',
  input_schema: ANALYSIS_SCHEMA as unknown as Anthropic.Tool.InputSchema,
};

export async function analyzeRepo(repo: TrendingRepo): Promise<Analysis> {
  return callForcedTool<Analysis>({
    tool: ANALYSIS_TOOL,
    label: repo.fullName,
    requiredPaths: ANALYSIS_REQUIRED,
    system: SYSTEM,
    userContent: repoBrief(repo),
    maxTokens: 8000,
  });
}

/** The locale-specific subset of an analysis. Tags, technologies, difficulty,
 * and stack are deliberately excluded — they are proper nouns and enum values
 * that read better untranslated. */
export type LocalizedAnalysis = {
  summary: string;
  whyItMatters: string;
  learn: { topics: string[]; learningPath: string };
  clone: { title: string; description: string; features: string[]; timeEstimate: string };
};

const LOCALIZED_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '两句话说明这个项目是什么。' },
    whyItMatters: { type: 'string', description: '一小段说明它为什么现在值得关注。不要罗列功能。' },
    learn: {
      type: 'object',
      properties: {
        topics: {
          type: 'array',
          items: { type: 'string' },
          description: '想读懂或重写这个项目需要掌握的概念与技能，3-6 条。',
        },
        learningPath: { type: 'string', description: '一小段说明按什么顺序学、边学边做什么。' },
      },
      required: ['topics', 'learningPath'],
      additionalProperties: false,
    },
    clone: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '周末简化版的名字。' },
        description: { type: 'string', description: '两句话描述一个周末真能做完的最小版本。' },
        features: {
          type: 'array',
          items: { type: 'string' },
          description: '只保留核心功能，3-5 条。',
        },
        timeEstimate: { type: 'string', description: '实际耗时，例如「4-6 小时」或「一个周末」。' },
      },
      required: ['title', 'description', 'features', 'timeEstimate'],
      additionalProperties: false,
    },
  },
  required: ['summary', 'whyItMatters', 'learn', 'clone'],
  additionalProperties: false,
} as const;

/**
 * Written in Chinese from the README directly — deliberately NOT given the
 * English analysis, because translating it produces translationese sentence
 * rhythm even when the vocabulary is correct.
 */
const SYSTEM_ZH = `你在为 LearnFromGithub 写中文内容。这个产品把 GitHub 上正在流行的开源项目变成学习材料和练手项目。

读者是中文开发者：计算机专业的学生、准备面试的工程师、想找点东西做的人。他们自己会读 README。他们难做到的是判断一个项目为什么重要、看出背后有哪些值得掌握的概念、以及把它裁剪成一个自己真能做完的版本。

所以：讲清楚意义，不要罗列功能。点出开发者需要学的概念，而不是仓库自己的模块名。每个「周末复刻」都要是一个人一个周末真能做完的——如果原项目需要一个集群，那周末版就得能跑在一台笔记本上。

写作风格要求（这部分很重要）：
- 你是在用中文写作，不是在翻译。直接从 README 里的信息组织中文句子，句式、节奏、连接词都按中文的习惯来。不要出现「这使得」「值得注意的是」「总的来说」这类翻译腔。
- 技术名词保留英文，这才是中文开发者真实的写法：写「用 tool calling 驱动 agent loop」，不要写「用工具调用驱动智能体循环」。框架名、协议名、API 名、库名一律保持英文原样。
- 语气参考掘金、少数派上写得好的技术文章：专业、直接、有判断，但不端着，也不用营销词。
- 该用「你」就用「你」，不要用「我们」假装集体。
- 具体、克隆。不要吹，README 里没有的能力不要写。`;

const LOCALIZED_TOOL = {
  name: 'submit_analysis_zh',
  description: 'Submit the structured Chinese edition of a repository analysis.',
  input_schema: LOCALIZED_SCHEMA as unknown as Anthropic.Tool.InputSchema,
};

export async function analyzeRepoZh(repo: TrendingRepo): Promise<LocalizedAnalysis> {
  return callForcedTool<LocalizedAnalysis>({
    tool: LOCALIZED_TOOL,
    label: `${repo.fullName} (zh)`,
    requiredPaths: LOCALIZED_REQUIRED,
    system: SYSTEM_ZH,
    userContent: repoBrief(repo),
    maxTokens: 8000,
  });
}

export type NewsletterDraft = {
  title: string;
  subtitle: string;
  markdown: string;
  featuredFullName: string;
};

const NEWSLETTER_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Issue title. Specific to this week, under 60 characters.' },
    subtitle: { type: 'string', description: 'One line setting up the issue.' },
    featuredFullName: {
      type: 'string',
      description: 'The owner/name of the repo chosen for the Weekend Build section. Must be one of the supplied repos.',
    },
    markdown: {
      type: 'string',
      description:
        'The newsletter body in Markdown. Around a five-minute read. Open with a short paragraph on the through-line of the week. Then cover the most interesting projects — for each, why it matters and what a reader can learn, in prose, not bullet dumps. End with a "Weekend Build" section pitching one project to clone, scoped to a weekend. Use ## for section headings. Do not include the title, the subtitle, or a sign-off link.',
    },
  },
  required: ['title', 'subtitle', 'featuredFullName', 'markdown'],
  additionalProperties: false,
} as const;

const NEWSLETTER_TOOL = {
  name: 'submit_newsletter',
  description: 'Submit the weekly newsletter draft.',
  input_schema: NEWSLETTER_SCHEMA as unknown as Anthropic.Tool.InputSchema,
};

export async function writeNewsletter(
  repos: Array<{ repo: TrendingRepo; analysis: Analysis }>,
  week: string,
): Promise<NewsletterDraft> {
  const digest = repos
    .map(({ repo, analysis }, i) =>
      [
        `${i + 1}. ${repo.fullName} — ${repo.url}`,
        `   Stars gained this week: ${repo.starsGained}. Language: ${repo.language ?? 'unknown'}.`,
        `   Summary: ${analysis.summary}`,
        `   Why it matters: ${analysis.whyItMatters}`,
        `   Learn: ${analysis.learn.topics.join(', ')} (${analysis.learn.difficulty})`,
        `   Weekend clone: ${analysis.clone.title} — ${analysis.clone.description} (${analysis.clone.timeEstimate})`,
      ].join('\n'),
    )
    .join('\n\n');

  return callForcedTool<NewsletterDraft>({
    tool: NEWSLETTER_TOOL,
    label: 'newsletter',
    requiredPaths: NEWSLETTER_REQUIRED,
    system: `${SYSTEM}

You are now writing the weekly newsletter. It should be a pleasure to read — a knowledgeable friend telling the reader what happened in open source this week and what to do about it. Around a five-minute read.

Pick the handful of projects that are genuinely interesting and connect them into a story about where the ecosystem is moving. Do not list every repo you were given; a ranked inventory is what the reader is already avoiding by reading you. Close by pitching exactly one project as this week's Weekend Build.`,
    userContent: `Week of ${week}. Analyzed trending repositories:\n\n${digest}`,
    maxTokens: 16000,
  });
}

function parseToolResponse<T>(message: Anthropic.Message, label: string): T {
  if (message.stop_reason === 'max_tokens') {
    throw new Error(`Response for ${label} hit max_tokens and is incomplete.`);
  }

  const toolUse = message.content.find((block) => block.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error(`No tool call in response for ${label}.`);
  }

  return toolUse.input as T;
}

/**
 * DeepSeek's forced tool calling does not strictly enforce a schema's
 * `required` fields — the model occasionally omits one (e.g. a nested
 * `learningPath`). Check the parsed tool input against the dotted paths we
 * actually depend on, and report which are absent rather than letting a
 * missing field crash the save with a cryptic Prisma error.
 */
function missingPaths(value: unknown, paths: string[]): string[] {
  const missing: string[] = [];
  for (const path of paths) {
    let node: unknown = value;
    let absent = false;
    for (const key of path.split('.')) {
      if (node === null || typeof node !== 'object' || !(key in node)) {
        absent = true;
        break;
      }
      node = (node as Record<string, unknown>)[key];
    }
    if (absent || node === undefined || node === null) missing.push(path);
  }
  return missing;
}

/**
 * Shared request path for the three AI steps. It centralizes the two things
 * that make DeepSeek's Anthropic-compatible endpoint behave:
 *   - `thinking: { type: 'disabled' }` (DeepSeek's default thinking mode
 *     rejects a forced `tool_choice`);
 *   - carrying the JSON schema on a forced tool call's `input_schema`, since
 *     DeepSeek ignores `output_config.format` (json_schema).
 * If the model returns a tool input that is missing a required field, retry
 * once with a corrective nudge before giving up.
 */
async function callForcedTool<T>(args: {
  tool: Anthropic.Tool;
  label: string;
  requiredPaths: string[];
  system: string;
  userContent: string;
  maxTokens: number;
}): Promise<T> {
  const { tool, label, requiredPaths, system, userContent, maxTokens } = args;
  let content = userContent;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const message = await getClient()
      .messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        output_config: { effort: EFFORT },
        thinking: { type: 'disabled' },
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
        messages: [{ role: 'user', content }],
      })
      .catch(rethrowAuthErrors);

    if (message.stop_reason === 'refusal') {
      throw new Error(`${label} refused: ${message.stop_details?.explanation ?? 'no detail'}`);
    }

    const result = parseToolResponse<T>(message, label);
    const missing = missingPaths(result, requiredPaths);
    if (missing.length === 0) return result;

    if (attempt === 2) {
      throw new Error(`${label} still incomplete after retry — missing: ${missing.join(', ')}`);
    }
    content = `${userContent}\n\nYour previous tool input was missing these required fields: ${missing.join(', ')}. Call ${tool.name} again and fill in every one of them.`;
  }

  throw new Error(`${label}: unreachable`);
}

const ANALYSIS_REQUIRED = [
  'summary',
  'whyItMatters',
  'technologies',
  'tags',
  'learn.topics',
  'learn.difficulty',
  'learn.learningPath',
  'clone.title',
  'clone.description',
  'clone.features',
  'clone.stack',
  'clone.difficulty',
  'clone.timeEstimate',
];

const LOCALIZED_REQUIRED = [
  'summary',
  'whyItMatters',
  'learn.topics',
  'learn.learningPath',
  'clone.title',
  'clone.description',
  'clone.features',
  'clone.timeEstimate',
];

const NEWSLETTER_REQUIRED = ['title', 'subtitle', 'featuredFullName', 'markdown'];
