# Weekly Learn

把 GitHub 上的热门开源项目，变成「为什么值得关注 + 能学到什么 + 周末能动手做什么」的学习材料，并每周生成一期邮件周报。

> 本项目是 [LearnFromGithub](https://github.com/viviannnl/learn-from-github)（作者 Vivian Li）的二次开发版本，针对国内使用场景做了适配。

## 为什么要做这个改动

原项目很好，但直接在国内用会遇到两个实际问题：

1. **AI 用的是 Claude（Anthropic）**：国内无法直接访问，也没有 Anthropic 的 key；
2. **数据靠抓取 `github.com/trending` 网页**：github.com 主站在国内经常不稳定、甚至无法访问。

于是我把这两处换成了国内可用的方案，让整条流程能在中国大陆的网络环境下稳定跑起来。

## 与原项目的主要区别

| 方面 | 原项目 | 本版本（我的改动） |
|---|---|---|
| AI 模型 | Claude（Anthropic SDK + Anthropic API） | **DeepSeek**（走其 Anthropic 兼容端点） |
| 数据来源 | 抓取 `github.com/trending` 网页 | **GitHub Search API**（`api.github.com`） |
| 结构化输出 | Anthropic 的 `json_schema` | 强制 tool call + `input_schema` 携带 schema |
| 思考模式 | 默认开启 | 关闭（DeepSeek 思考模式不允许强制 tool call） |
| 输出稳定性 | 无校验 | 校验必填字段，缺失时自动重试（最多 3 次尝试） |
| 邮件发送 | Resend（国外服务） | QQ 邮箱 SMTP（nodemailer），国内直连 |

## 它做什么

一条 6 步的数据管道 + 一个展示页面：

```
GitHub Search API → REST API 补全信息 → DeepSeek 分析 → SQLite 存储 → 生成周报 → 发送邮件
```

- **首页**：展示本周热门项目的卡片，每张卡片包含「为什么重要 / 能学到什么 / 周末复刻」三块内容，并配有中文版
- **周报**：把本周项目串成一篇可读的文章，点出一个「周末动手做」的项目
- **订阅**：访客可提交邮箱订阅，周报通过 QQ 邮箱真实发送

> 数据来源说明：GitHub 没有官方的 Trending API，本版本用 Search API 查询「过去 7 天新建、按 star 排序」的仓库，得到"本周爆火的新项目"。

## 技术栈

| 部分 | 选择 |
|---|---|
| 应用 | Next.js 15（App Router）、React 19、TypeScript、Tailwind CSS |
| AI | DeepSeek，通过 `@anthropic-ai/sdk`（Anthropic 兼容端点） |
| 存储 | SQLite + Prisma |
| 邮件 | QQ 邮箱 SMTP（nodemailer，未配置时 dry-run） |
| 自动化 | macOS launchd 本地定时任务（每周一发）+ 可手动运行的 CLI |

## 快速开始

要求 Node 20+。

```bash
npm install
cp .env.example .env    # 然后填入你的 DeepSeek API key
npm run db:push         # 创建 SQLite 数据库
npm run pipeline        # 拉取、分析、生成第一期周报
npm run dev             # 打开 http://localhost:3000
```

## 配置（.env）

| 变量 | 说明 |
|---|---|
| `ANTHROPIC_API_KEY` | **必填**。填你的 DeepSeek API key（在 <https://platform.deepseek.com/api_keys> 获取） |
| `ANTHROPIC_BASE_URL` | **必填**。`https://api.deepseek.com/anthropic`（DeepSeek 的 Anthropic 兼容端点） |
| `ANTHROPIC_MODEL` | 可选。`deepseek-flash`（默认，便宜）或 `deepseek-v4-pro`（质量更高） |
| `GITHUB_TOKEN` | 可选。填了可把 GitHub API 限额从 60 提到 5000 次/小时 |
| `SMTP_HOST` | QQ 邮箱 SMTP 服务器，默认 `smtp.qq.com` |
| `SMTP_PORT` | 端口，默认 `465`（SSL） |
| `SMTP_USER` | 你的 QQ 邮箱地址（发件账号） |
| `SMTP_PASS` | **QQ 邮箱授权码**（不是登录密码，见下文「发送邮件」） |
| `NEWSLETTER_FROM` | 可选。发件人，默认同 `SMTP_USER` |
| `DATABASE_URL` | SQLite 文件路径，默认即可 |

> 说明：变量名是 `ANTHROPIC_API_KEY`，因为代码保留了 Anthropic SDK、只把请求地址指向了 DeepSeek 的兼容端点；里面放的是你的 DeepSeek key。

## 发送邮件（QQ 邮箱）

1. 登录 [QQ 邮箱](https://mail.qq.com)，进入「设置 → 账户」；
2. 找到「POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV 服务」，开启 **SMTP 服务**（可能要求短信验证）；
3. 开启后会生成一个 **16 位授权码**，复制下来；
4. 在 `.env` 里填入：
   ```
   SMTP_USER=你的QQ邮箱@qq.com
   SMTP_PASS=刚才的16位授权码
   ```
5. 在首页订阅一个邮箱（例如你自己的 QQ 邮箱），然后运行 `npm run pipeline:send` 真实发送。

> 授权码不是 QQ 登录密码。它只在这一个用途里代替密码，泄露了也能单独作废、重新生成。

## 常用命令

```bash
npm run pipeline                 # 分析 10 个仓库，生成周报（邮件 dry-run）
npm run pipeline:send            # 同上，并真实发送邮件
npm run pipeline -- --limit 5    # 只分析 5 个仓库
npm run pipeline -- --force      # 即使本周已有缓存也重新分析
npm run backfill:zh              # 补齐缺失的中文版
npm run seed:demo                # 插入一批手写的演示数据
```

## 本地定时发送（macOS launchd）

只在自己电脑上每周自动收周报（不部署公网）的做法：用 macOS 自带的 launchd，每周一 08:00 自动跑一次 `npm run pipeline:send`。

- 触发配置：`~/Library/LaunchAgents/com.saria.weekly-learn.plist`
- 包装脚本：`~/.config/weekly-learn/run-weekly.sh`（先 `source .env` 加载密钥，再跑管道）
- 运行日志：`~/Library/Logs/weekly-learn.log`
- 立即手动触发一次：`launchctl kickstart gui/$(id -u)/com.saria.weekly-learn`

> 电脑当时在睡眠的话，唤醒后会自动补跑。

## 目录结构

```
app/                    首页、周报页、订阅接口
components/             仓库卡片、订阅表单
lib/
  ai.ts                 DeepSeek 分析 + 周报生成（含结构化输出适配）
  github.ts             趋势仓库抓取（Search API）+ 元信息补全
  markdown.ts           轻量 Markdown → HTML
  email.ts              QQ 邮箱 SMTP 发送（nodemailer）+ 邮件模板
  db.ts、week.ts        Prisma 客户端、周次工具
prisma/schema.prisma    Repo / Issue / Subscriber
scripts/run-pipeline.ts 周报编排脚本
```

## 当前状态与后续计划

已完成：数据管道全流程（抓取 → 分析 → 存储 → 周报）、中英文双版分析、订阅入库、QQ 邮箱 SMTP 发信。

待做：

- [ ] 补充单元测试
- [ ] （可选）部署到公网——若只作个人学习自用，本地运行已足够，无需部署

## 作者

Saria
