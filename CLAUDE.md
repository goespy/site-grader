# SiteGrade

Free website grader for home service businesses. Scores sites on how well they convert ad traffic into leads. Built as a sales tool for Ark Local Services (SW Florida FB ad agency) to upsell website builds.

- **Frontend:** Static HTML/CSS/JS on Cloudflare Pages
- **Backend:** Cloudflare Worker (TypeScript) at `worker/`
- **Storage:** Cloudflare KV (reports with 30-day TTL)
- **APIs:** Google PageSpeed Insights v5, Resend (lead emails)
- **Design:** Light SaaS aesthetic (#F8FAFC bg, #0369A1 primary blue, #0F172A text), Poppins + Open Sans fonts, glassmorphism cards

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
- Grade colors: A=green #16A34A, B=blue #0369A1, C=yellow #CA8A04, D=orange #EA580C, F=red #DC2626
- Wasted spend: `(100 - score) / 100 * 0.7 * monthlyAdSpend`, shown as low-high range

## Tone

Professional with personality. Stats are precise, verdicts are conversational and direct. No SEO jargon — plain English a roofer would understand. Like a doctor with good bedside manner.

## Design System

Light mode SaaS aesthetic. Premium but approachable for blue-collar business owners.

- **Background:** #F8FAFC (slate-50)
- **Primary:** #0369A1 (sky-700), hover #0284C7
- **Text:** #0F172A (slate-900), secondary #475569, muted #94A3B8
- **Cards:** rgba(255,255,255,0.8) with backdrop-blur(12px), border #E2E8F0
- **Fonts:** Poppins (headings, 500-900), Open Sans (body, 400-700)
- **Shadows:** sm/md/lg scale using rgba(15,23,42,0.06-0.10)
- **Transitions:** 200ms ease for interactions, cubic-bezier(0.16,1,0.3,1) for smooth animations
- **Nav:** Fixed, glass blur, 72px height

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
