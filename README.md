# AI_agent_pishkhan

Persian RTL branch desk with the AI assistant flow implemented from the supplied Figma section:
https://www.figma.com/design/RTPnhLGTwQHdCoFCGjQA4j/window-of-branch?node-id=12202-281913

## Implemented
- Dig design system installed through its official registry. Sheet, Button, Input, TextField, Select, PromptInput, Card and ControlSizeProvider are reused.
- Product CSS overrides match the Figma dimensions, colors, composition and static assets.
- Left drawer with 320 ms entrance, 240 ms exit, 180 ms content transitions, reduced-motion support, focus trap, Escape, backdrop dismissal and scroll locking.
- Welcome suggestions → account/date selection → cancellable loading → statement and follow-up chart.
- Statements come from synthetic transactions persisted in Supabase, not from an invented client-side response.
- PDF and XLSX exports, local demo history, error/retry and request state retained while closing/reopening the drawer.
- Authenticated cloud-history code with per-user RLS and email sign-in. Email delivery and redirect configuration must be completed in Supabase before live account login is released.
- Server-side AI Gateway endpoint with authenticated access and an atomic 10/minute database quota. Free-form AI is OFF until a model and a usage budget are configured.

## Demo boundaries
The banking adapter is demonstration-only. Only customer 84839993 and account demo-4582 are available. No real bank API, employee SSO, customer authorization service or production data has been connected.
The visible previous-month preset intentionally reproduces the Figma example (1–30 Mehr 1405).
The other legal-case navigation/table surfaces are presentation context, not a full legal-case management implementation.
Attachment upload and bank-system navigation are not enabled.
Do not treat Supabase email authentication as authorization to access bank data.

## Run
Node.js 24 is recommended.
```sh
npm ci
cp .env.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
npm run dev
```
The deployed project is ai-agent-pishkhan in Vercel; environment variables are configured there. No service-role key is used or shipped to the browser.

## Validate
```sh
npm run typecheck
npm run build
npx playwright install chromium --with-deps
npm run start
npm test
```
The Playwright suite covers API validation, real demo-table queries, custom ranges, desktop/mobile flows, cancellation/retry, downloads, history persistence and keyboard focus restoration.

## Supabase
Migrations in supabase/migrations reproduce the schema and synthetic seed data. All public tables have RLS. Anonymous clients may only read the synthetic transactions. Conversation policies require row ownership. Quota state is in a private schema and is changed only by a guarded function; its public RPC wrapper is SECURITY INVOKER.
Before production sign-in: configure the canonical site URL and allowed redirects under Supabase Authentication URL Configuration, configure email delivery, and validate account login and history isolation with real test accounts.

## Enable free-form AI
Configure AI_GATEWAY_MODEL using an ID from the current AI Gateway model catalog, establish a usage budget, and then set AI_ENABLED=true. Vercel deployments use OIDC. Local development needs an AI Gateway credential stored only in .env.local. Never commit credentials.
No model call or AI charge was made during implementation.

## Design maintenance
Dig-owned theme and registry sources are separate from src/app/brand.css and product overrides in globals.css. The font files were sourced from the user's installed IRANSansX files; preserve the appropriate font license when distributing this repository.
