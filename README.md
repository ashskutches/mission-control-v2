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

Sign-in is **Discord OAuth**. Access is decided by role in the Leaps & Rebounds guild, so
adding or removing a person is done in Discord and nowhere else — there is no user table
here to keep in sync.

| Discord role | Gets |
|---|---|
| `Admin` | everything, including `ADMIN_PATHS` (Profit, Costs, Quick Run, Agents) |
| `Teammate` | everything else |
| neither | denied at `/no-access`, even if they are in the server |

Roles are read with the **signer's own** OAuth token (`guilds.members.read`), not the
gravity-claw bot token — this service never holds a credential that can act as the bot.
The role is resolved once at sign-in and baked into the signed session cookie; the
middleware never calls Discord, because it runs on every request.

A role removed in Discord therefore takes effect at that person's next sign-in, not
instantly. To cut someone off immediately, rotate `SESSION_SECRET` — that invalidates
every session at once.

### Environment

| Variable | Purpose |
|---|---|
| `SESSION_SECRET` | HMAC key for the session cookie and the OAuth state. **Rotating it signs everyone out.** |
| `DISCORD_CLIENT_ID` | The gravity-claw Discord application's client id |
| `DISCORD_CLIENT_SECRET` | Developer Portal → OAuth2 |
| `DISCORD_GUILD_ID` | The server whose roles decide access |
| `DISCORD_ADMIN_ROLE_ID` | Role granting admin |
| `DISCORD_VIEWER_ROLE_ID` | Role granting viewer |
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
