# Mission Control v2

**Mission Control v2** is the high-density, centralized dashboard for the **Gravity Claw** autonomous AI ecosystem.

## 🌟 Gravity Claw System: 47-Feature Roadmap (100% Completed)

### 🎨 UX & Interaction (This Repository)
- **Mission Control UI 3.0**: A stunning, linear "Single-Sidebar" command center.
- **Situation Room**: Full-width data visualization of Shopify metrics and live agent briefings.
- **Real-time Streaming**: Instant feedback from the agent backend.
- **Unified Navigation**: Clean, anchor-based routing without nested sidebars.

### 🧠 Core Agent Capabilities (See `gravity-claw` repo)

**Messaging & Channels**
- Telegram, Discord, Gmail, Alexa

**Voice & Speech**
- Whisper transcription, ElevenLabs synthesis, Talk Mode

**Memory & Intelligence**
- Knowledge Graph (Tag-based entity tracking)
- Multimodal Memory (Visual storage via Supabase)
- Thinking Levels (`/think` progressive reasoning depth)
- Semantic Search (pgvector)

**Tools & Automation**
- Browser Automation (Puppeteer), Secure Shell, Web Search, MCP Bridge

**Proactive Engine**
- Morning Briefings, Evening Recaps, System Heartbeats, Smart Recommendations

**Security & Architecture**
- Agent Swarms (Sub-delegation), AES-256 Encrypted Secrets, Docker Deployment

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Authentication

Sign-in is **Discord OAuth**, and there are two separate questions with two different
answers:

| Question | Decided by |
|---|---|
| May you sign in at all? | **Discord** — membership of a configured guild |
| What can you open once in? | **The team directory** — `team_members.permission_tier` |

Three tiers, defined in `src/app/lib/access.ts`:

| Tier | Gets |
|---|---|
| `guest` | the lobby: Content, Research, Agents, Quick Run, Chats |
| `teammate` | adds the operational dashboard (Command Center, Orders, Support, SEO, …) |
| `admin` | everything, including Profit, Costs, Insights, Team |

**Everyone starts as a guest.** Teammate and admin are granted on the **Team page** —
open a member, set *Dashboard access*, save. That writes through
`PATCH /admin/team/:id/permission` on gravity-claw, which is the only route that may
touch the column: Postgres revokes it from the anon key, because that key is public.

> ⚠️ The **Role** dropdown on the same form is the person's *job function*
> (owner / marketing / ops / …). It has nothing to do with access. *Dashboard access*
> is the permission control.

Guild membership is still required and still read with the **signer's own** OAuth token
(`guilds.members.read`), never the gravity-claw bot token — this service holds no
credential that can act as the bot.

`DISCORD_ADMIN_USER_IDS` is the break-glass: those ids are admin without a directory
lookup, which is what keeps the owner in when Supabase is down or the table is empty.
A Discord guild owner holds no roles, so this is not a corner case.

The tier is resolved once at sign-in and baked into the signed session cookie; the
middleware never calls out, because it runs on every request. **A tier change therefore
takes effect at that person's next sign-in, not instantly** — promote-then-refresh will
not do it. To cut someone off immediately, rotate `SESSION_SECRET`, which invalidates
every session at once.

### The trade this makes

The tier used to be read live from Discord roles, so there was no second list. It moved
into Supabase on 2026-08-18 so that granting access did not mean opening Discord. There
are now two systems: a person removed from Discord keeps their directory row, so
`active: false` is honoured as a revocation and `POST /admin/team/sync` keeps the roster
current. The first sync after this shipped seeded existing `Admin`/`Teammate` role
holders into the column, which is why nobody was demoted by the change.

### Environment

| Variable | Purpose |
|---|---|
| `SESSION_SECRET` | HMAC key for the session cookie and the OAuth state. **Rotating it signs everyone out.** |
| `DISCORD_CLIENT_ID` | The gravity-claw Discord application's client id |
| `DISCORD_CLIENT_SECRET` | Developer Portal → OAuth2 |
| `DISCORD_GUILD_ID` | The server whose roles decide access |
| `DISCORD_ADMIN_ROLE_ID` | Legacy. No longer grants access — gravity-claw reads it to seed tiers on first sync |
| `DISCORD_VIEWER_ROLE_ID` | Legacy. Same — seeds `teammate` |
| `DISCORD_ADMIN_USER_IDS` | Comma-separated ids that are always admin. The break-glass |
| `BOT_API_KEY` | Sent as `x-admin-key` by `/api/bot`. Must equal `ADMIN_API_KEY` on gravity-claw |
| `DISCORD_REDIRECT_URI` | Optional. Otherwise derived from `x-forwarded-proto`/`host` |
| `ADMIN_PASSWORD` | Break-glass only — see below |
| `DASHBOARD_PASSWORD` | Break-glass only — see below |

The callback URL must be registered in the Developer Portal byte for byte:
`https://leapsandrebounds.ai/api/auth/discord/callback` (plus
`http://localhost:3000/api/auth/discord/callback` for local work).

If any `DISCORD_*` var is missing the login page degrades to the break-glass form rather
than erroring, so a half-configured deploy is still reachable.

### Break-glass

`/login?break-glass=1` is the password form that predates Discord. It is unadvertised and
exists so a broken client secret, an expired OAuth app, or a Discord outage cannot lock
everyone out of production. Sessions it issues carry no identity and show as "break-glass
session" in the sidebar. **Unset `ADMIN_PASSWORD` and `DASHBOARD_PASSWORD` to remove the
path entirely** — no code change needed.
