# SiteGrade

Free website grader for home service businesses. Scores sites on how well they convert ad traffic into leads. Built as a sales tool for Ark Local Services (SW Florida FB ad agency) to upsell website builds.

- **Frontend:** Static HTML/CSS/JS on Cloudflare Pages
- **Backend:** Cloudflare Worker (TypeScript) at `worker/`
- **Storage:** Cloudflare KV (reports with 30-day TTL)
- **APIs:** Google PageSpeed Insights v5, Resend (lead emails), OpenRouter (AI content review via MiniMax-M2.5), Google Places (New) API (competitor analysis)
- **Design:** Dark SaaS aesthetic (#0B0F1A bg, #3B82F6 blue primary, #F97316 orange accent), Outfit + Inter fonts, ambient glow orbs, glassmorphism cards

## How It Works

1. User enters URL + business type + optional ad spend
2. Worker fetches page HTML + calls PageSpeed API in parallel
3. Seven analyzers score the site (0-100 each, weighted):
   - Mobile Experience (20%) — load time, responsive, tap targets
   - Lead Capture (20%) — phone, click-to-call, forms, CTAs
   - Trust & Credibility (15%) — testimonials, reviews, license
   - Page Speed (15%) — Core Web Vitals, page weight
   - SEO Basics (10%) — title, meta, H1, SSL, schema
   - Ad Landing Readiness (10%) — service/location above fold, distraction score
   - Content Quality (10%) — AI-powered review of copy persuasiveness, messaging clarity, CTAs (via MiniMax-M2.5 on OpenRouter; gracefully skipped if unavailable)
   Competitor search also runs in parallel (Google Places Text Search) — returns top 5 nearby competitors with ratings/reviews. Not a scoring category, just market context.
4. Scoring engine computes overall grade (A+ through F) + wasted ad spend estimate
5. Report stored in KV, returned with shareable URL
6. Lead capture form sends email via Resend

## Common Commands

```bash
cd worker && npm run dev        # Start worker locally (port 8787)
cd worker && npx tsc --noEmit   # Type-check
cd worker && npm run deploy     # Deploy worker to Cloudflare

npx serve .                     # Serve frontend locally (from site-grader/)
npx wrangler pages deploy .     # Deploy frontend to Cloudflare Pages
```

## Architecture

```
site-grader/
├── index.html              # Landing page (scan form + loading animation)
├── report.html             # Report page (grades, findings, lead form)
├── _headers                # Cloudflare Pages security headers
├── worker/
│   ├── src/
│   │   ├── index.ts        # Worker entry (router + CORS)
│   │   ├── routes/
│   │   │   ├── scan.ts     # POST /api/scan — orchestrate analysis
│   │   │   ├── report.ts   # GET /api/report/:id — fetch stored report
│   │   │   ├── lead.ts     # POST /api/lead — capture + email via Resend
│   │   │   └── stats.ts    # GET /api/stats — analytics dashboard (auth required)
│   │   ├── analyzers/
│   │   │   ├── types.ts         # Finding + CategoryResult interfaces
│   │   │   ├── fetch-page.ts    # Fetch URL HTML, regex-parse for signals
│   │   │   ├── pagespeed.ts     # Google PageSpeed Insights API client
│   │   │   ├── mobile.ts        # Mobile experience scoring
│   │   │   ├── lead-capture.ts  # Lead capture scoring
│   │   │   ├── trust.ts         # Trust & credibility scoring
│   │   │   ├── speed.ts         # Page speed scoring
│   │   │   ├── seo.ts           # SEO basics scoring
│   │   │   ├── ad-readiness.ts  # Ad landing readiness scoring
│   │   │   ├── ai-review.ts    # AI content quality review (OpenRouter/MiniMax-M2.5)
│   │   │   └── competitors.ts  # Competitor analysis via Google Places API (not a scoring category)
│   │   ├── analytics.ts    # KV-based aggregate counters (scans, leads)
│   │   ├── scoring.ts      # Category weights, letter grades, wasted spend
│   │   └── verdicts.ts     # Plain English verdict templates
│   ├── wrangler.toml
│   ├── package.json
│   └── tsconfig.json
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/scan` | Run full site analysis. Body: `{ url, businessType, adSpend? }` |
| GET | `/api/report/:id` | Fetch stored report by ID |
| POST | `/api/lead` | Capture consultation request. Body: `{ name, email, phone?, reportId }` |
| GET | `/api/stats` | Analytics dashboard. Header: `Authorization: Bearer <STATS_TOKEN>` |

## Environment Variables (Worker)

| Variable | Purpose |
|----------|---------|
| `PAGESPEED_API_KEY` | Google PageSpeed API key (optional, raises quota) |
| `RESEND_API_KEY` | Resend API key for lead notification emails |
| `LEAD_EMAIL_TO` | Email address that receives lead notifications |
| `STATS_TOKEN` | Bearer token for `/api/stats` endpoint |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI content review (optional — AI category skipped if missing) |
| `GOOGLE_PLACES_API_KEY` | Google Places API key for competitor analysis (optional — competitor section hidden if missing) |

KV namespace `REPORTS` is bound in `wrangler.toml`.

## Scoring

- Each analyzer returns findings with `impact: 'high' | 'medium' | 'low'`
- Finding weights: high=30, medium=20, low=10. Category score = earned/total * 100
- Overall score = weighted sum of 7 categories (weights in `scoring.ts`); if AI review fails, its weight is redistributed
- Grade thresholds: A+ (97+) → F (below 60)
- Grade colors: A=green #22C55E, B=blue #3B82F6, C=yellow #EAB308, D=orange #F97316, F=red #EF4444
- Wasted spend: `(100 - score) / 100 * 0.7 * monthlyAdSpend`, shown as low-high range

## Tone

Professional with personality. Stats are precise, verdicts are conversational and direct. No SEO jargon — plain English a roofer would understand. Like a doctor with good bedside manner.

## Design System

Dark premium SaaS aesthetic (Vercel/Linear-inspired). Feels like a pro developer tool but approachable for blue-collar business owners.

- **Background:** #0B0F1A (deep navy-black)
- **Surface:** rgba(30, 41, 59, 0.4) (glass cards), solid #131B2E
- **Border:** rgba(148, 163, 184, 0.1), hover 0.2
- **Primary:** #3B82F6 (blue-500), hover #2563EB — used for CTAs and links
- **Accent:** #F97316 (orange-500) — used for brand gradient text, money callouts
- **Accent Purple:** #8B5CF6 (violet-500) — used in brand gradient and glow orbs
- **Text:** #F1F5F9 (headings), #CBD5E1 (body), #94A3B8 (muted), #64748B (dim)
- **Cards:** Glassmorphism — semi-transparent bg, backdrop-filter blur(16px), subtle border
- **Fonts:** Outfit (headings, 400-800), Inter (body, 400-700)
- **Buttons:** Blue `linear-gradient(135deg, #3B82F6, #2563EB)`, 12px radius
- **Hero:** 3 ambient glow orbs (blue #3B82F6, orange #F97316, purple #8B5CF6) with `glow-drift` keyframe animation, blur 120-160px, opacity 0.15-0.2
- **Brand text:** Gradient `linear-gradient(135deg, #F97316, #F59E0B, #8B5CF6)` with `background-clip: text`
- **Nav:** Fixed, glass blur (rgba(11,15,26,0.8) + blur 16px), 64px height
- **Inputs:** rgba(30,41,59,0.6) bg, rgba(148,163,184,0.15) border
- **Motion:** prefers-reduced-motion respected, glow animations pause

## v1 Scope — What's OUT

- PDF export
- Account/login system
- Historical tracking or re-scans
- Competitor side-by-side comparison
- Leaderboard
- ~~AI/LLM-powered recommendations~~ (added in v1.1 — Content Quality category via MiniMax-M2.5)
- Blog/content pages
- Multiple page crawling (v1 = homepage only)

## Deploy Checklist

1. Create KV namespace: `cd worker && npx wrangler kv:namespace create REPORTS`
2. Add KV IDs to `wrangler.toml`
3. Set secrets: `npx wrangler secret put PAGESPEED_API_KEY` (+ RESEND_API_KEY, LEAD_EMAIL_TO, STATS_TOKEN)
4. Add production domain to ALLOWED_ORIGINS in `worker/src/index.ts`
5. Deploy worker: `cd worker && npm run deploy`
6. Update `API_URL` in `index.html` and `report.html` to production worker URL
7. Deploy frontend: `npx wrangler pages deploy . --project-name=site-grader`
8. Configure custom domain in Cloudflare Pages dashboard
9. Verify Resend domain for email sending
