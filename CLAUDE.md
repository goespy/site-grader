# SiteGrade

Free website grader for home service businesses. Scores sites on how well they convert ad traffic into leads. Built as a sales tool for Ark Local Services (SW Florida FB ad agency) to upsell website builds.

- **Frontend:** Static HTML/CSS/JS on Cloudflare Pages
- **Backend:** Cloudflare Worker (TypeScript) at `worker/`
- **Storage:** Cloudflare KV (reports with 30-day TTL)
- **APIs:** Google PageSpeed Insights v5, Resend (lead emails)
- **Design:** Warm light aesthetic (#FAFAF9 bg, #F97316 orange primary, #18181B text), Outfit + Inter fonts, animated liquid hero bg

## How It Works

1. User enters URL + business type + optional ad spend
2. Worker fetches page HTML + calls PageSpeed API in parallel
3. Six analyzers score the site (0-100 each, weighted):
   - Mobile Experience (25%) — load time, responsive, tap targets
   - Lead Capture (25%) — phone, click-to-call, forms, CTAs
   - Trust & Credibility (15%) — testimonials, reviews, license
   - Page Speed (15%) — Core Web Vitals, page weight
   - SEO Basics (10%) — title, meta, H1, SSL, schema
   - Ad Landing Readiness (10%) — service/location above fold, distraction score
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
│   │   │   └── lead.ts     # POST /api/lead — capture + email via Resend
│   │   ├── analyzers/
│   │   │   ├── types.ts         # Finding + CategoryResult interfaces
│   │   │   ├── fetch-page.ts    # Fetch URL HTML, regex-parse for signals
│   │   │   ├── pagespeed.ts     # Google PageSpeed Insights API client
│   │   │   ├── mobile.ts        # Mobile experience scoring
│   │   │   ├── lead-capture.ts  # Lead capture scoring
│   │   │   ├── trust.ts         # Trust & credibility scoring
│   │   │   ├── speed.ts         # Page speed scoring
│   │   │   ├── seo.ts           # SEO basics scoring
│   │   │   └── ad-readiness.ts  # Ad landing readiness scoring
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

## Environment Variables (Worker)

| Variable | Purpose |
|----------|---------|
| `PAGESPEED_API_KEY` | Google PageSpeed API key (optional, raises quota) |
| `RESEND_API_KEY` | Resend API key for lead notification emails |
| `LEAD_EMAIL_TO` | Email address that receives lead notifications |

KV namespace `REPORTS` is bound in `wrangler.toml`.

## Scoring

- Each analyzer returns findings with `impact: 'high' | 'medium' | 'low'`
- Finding weights: high=30, medium=20, low=10. Category score = earned/total * 100
- Overall score = weighted sum of 6 categories (weights in `scoring.ts`)
- Grade thresholds: A+ (97+) → F (below 60)
- Grade colors: A=green #16A34A, B=blue #2563EB, C=yellow #CA8A04, D=orange #EA580C, F=red #DC2626
- Wasted spend: `(100 - score) / 100 * 0.7 * monthlyAdSpend`, shown as low-high range

## Tone

Professional with personality. Stats are precise, verdicts are conversational and direct. No SEO jargon — plain English a roofer would understand. Like a doctor with good bedside manner.

## Design System

Warm, confident, modern. Premium tool feel but approachable for blue-collar business owners.

- **Background:** #FAFAF9 (stone-50, warm off-white)
- **Primary:** #F97316 (orange-500), hover #EA580C, light rgba(249,115,22,0.08)
- **Accent:** #6366F1 (indigo-500, secondary visual interest)
- **Text:** #18181B (zinc-900), secondary #52525B, muted #A1A1AA
- **Cards:** #FFFFFF solid white, border #E4E4E7
- **Fonts:** Outfit (headings, 400-800), Inter (body, 400-700)
- **Shadows:** warm zinc-based: sm/md/lg scale using rgba(24,24,27,0.04-0.12)
- **Buttons:** Gradient `linear-gradient(135deg, #F97316, #EA580C)`, 12px radius
- **Hero:** Animated liquid background with 4 floating gradient blobs (blur 80px, saturate 1.4)
- **Nav:** Fixed, warm glass blur, 72px height
- **Motion:** prefers-reduced-motion respected

## v1 Scope — What's OUT

- PDF export
- Account/login system
- Historical tracking or re-scans
- Competitor side-by-side comparison
- Leaderboard
- AI/LLM-powered recommendations
- Blog/content pages
- Multiple page crawling (v1 = homepage only)

## Deploy Checklist

1. Create KV namespace: `cd worker && npx wrangler kv:namespace create REPORTS`
2. Add KV IDs to `wrangler.toml`
3. Set secrets: `npx wrangler secret put PAGESPEED_API_KEY` (+ RESEND_API_KEY, LEAD_EMAIL_TO)
4. Add production domain to ALLOWED_ORIGINS in `worker/src/index.ts`
5. Deploy worker: `cd worker && npm run deploy`
6. Update `API_URL` in `index.html` and `report.html` to production worker URL
7. Deploy frontend: `npx wrangler pages deploy . --project-name=site-grader`
8. Configure custom domain in Cloudflare Pages dashboard
9. Verify Resend domain for email sending
