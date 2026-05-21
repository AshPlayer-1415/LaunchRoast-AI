# LaunchRoast AI

LaunchRoast AI is a Next.js landing page audit app for startup and SaaS teams. Users can paste a landing page URL or draft copy, generate a structured roast, and export the result as a PDF using browser print.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Local audit limits with `localStorage`
- OpenRouter-ready API route with mock fallback

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create your local environment file:

```bash
cp .env.example .env.local
```

3. Add your optional OpenRouter key to `.env.local`:

```bash
OPENROUTER_API_KEY=your_key_here
```

If `OPENROUTER_API_KEY` is empty, the app will fall back to a local mock audit response.

4. Start the dev server:

```bash
npm run dev
```

5. Open your local app at `http://localhost:3000`.

## Scripts

- `npm run dev` starts the app locally
- `npm run lint` runs ESLint
- `npm run build` creates a production build
- `npm run check` runs lint and build together

## API route

The app exposes `POST /api/audit` with this request shape:

```json
{
  "inputType": "url",
  "content": "https://example.com"
}
```

Successful responses return:

```json
{
  "audit": {
    "clarityScore": 82,
    "mainProblem": "The hero is too vague.",
    "headlineRewrite": "Clearer headline here",
    "ctaRewrite": "Sharper CTA here",
    "pricingFeedback": "Pricing feedback here",
    "trustSuggestions": "Trust suggestion one\nTrust suggestion two",
    "finalLandingCopy": "Improved copy here",
    "trustSafetyReview": {
      "trustScore": 78,
      "httpsFeedback": "HTTPS trust signal feedback here",
      "privacyTermsFeedback": "Privacy and terms feedback here",
      "contactTransparencyFeedback": "Contact transparency feedback here",
      "dataHandlingFeedback": "Data handling feedback here",
      "securityClaimsFeedback": "Security claims feedback here",
      "recommendedFixes": ["Fix one", "Fix two"]
    }
  },
  "source": "openrouter"
}
```

The app also exposes:

- `GET /api/health` for a simple deployment health check
- `POST /api/audit` for landing page audits

## Environment variables

Documented variables:

- `OPENROUTER_API_KEY`
  Optional. If set, LaunchRoast AI will request live audit output from OpenRouter. If omitted, the app falls back to a local mock audit response.
- `NEXT_PUBLIC_STARTER_PAYMENT_URL`
  Optional. If set, Starter pricing buttons will open this payment link in a new tab.
- `NEXT_PUBLIC_PRO_PAYMENT_URL`
  Optional. If set, Pro pricing buttons will open this payment link in a new tab.

Recommended local file:

```bash
cp .env.example .env.local
```

Vercel environment:

- Add `OPENROUTER_API_KEY` in Project Settings → Environment Variables
- Add `NEXT_PUBLIC_STARTER_PAYMENT_URL` if you want the Starter plan to open a hosted payment link
- Add `NEXT_PUBLIC_PRO_PAYMENT_URL` if you want the Pro plan to open a hosted payment link
- Redeploy after changing environment variables

## Vercel deployment

1. Push the project to GitHub.
2. Import the repo into Vercel.
3. Add `OPENROUTER_API_KEY` in Vercel if you want live AI audits.
4. Add `NEXT_PUBLIC_STARTER_PAYMENT_URL` and `NEXT_PUBLIC_PRO_PAYMENT_URL` if you want pricing and paywall buttons to open hosted payment links.
5. Deploy with the default Next.js build settings.

This app is already structured for Vercel:

- App Router is used throughout
- no database setup is required
- no authentication setup is required
- no API keys are exposed client-side
- analytics placeholders stay silent in production
- `robots.txt`, `sitemap.xml`, and `/api/health` are included
- payment flows use simple hosted links only; no card data is collected in this app

## Deployment notes

- Set `OPENROUTER_API_KEY` in your deployment environment if you want live AI audits.
- Set `NEXT_PUBLIC_STARTER_PAYMENT_URL` and `NEXT_PUBLIC_PRO_PAYMENT_URL` if you want Starter and Pro buttons to open hosted payment pages.
- The route blocks localhost and private-network URL fetching for safer deployment defaults.
- Placeholder analytics are wired through a small local abstraction and do not connect to any paid service yet.
- Payment links open in a new tab. If a link is not configured, the UI falls back to a disabled "Payment link coming soon" state.
- Metadata is configured for a production deployment under `https://launchroast.ai`.
- If you deploy to a different domain, update `metadataBase`, sitemap, and robots host values.
- Placeholder contact email: `support@launchroast.ai`

## Production checklist

- Replace placeholder legal copy in `/privacy` and `/terms`
- Replace `support@launchroast.ai` with a real support email
- Swap the analytics placeholder in `lib/analytics.ts`
- Connect the upgrade modal to a live payment provider
- Set the production site URL if you deploy on a domain other than `launchroast.ai`
