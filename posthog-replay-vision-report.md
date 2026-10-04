# Replay vision setup report

## Recording

Session replay was already enabled server-side for this project, and neither
of the app's two client-side PostHog initializations (`instrumentation-client.ts`
and `src/components/analytics/PostHogAnalytics.tsx`) disables it — so no code
changes were needed. New sessions are recording now, except on paths your
existing `route-guard.ts` privacy filter already excludes (left untouched, as
it predates this setup and is working as intended).

## Scanners

Three scanners now watch every new recording of the 3D box-design studio:

### 1. Broken studio editor (monitor)
- **Watches for:** a blank 3D canvas instead of a rendered box, artwork images
  that fail to load in the dieline panel, PNG/PDF exports that never finish,
  design saves failing with a size-limit or conflict error, and artwork
  uploads getting rejected.
- **Scope:** `/studio` and `/studio/editor` (the project library and the
  editor itself), sampled at 50%.
- **Estimated spend:** capped at **1,200 credits/month** (raw estimate was
  3,775 — capped to protect the shared budget; see note below).

### 2. Box studio frustration (monitor)
- **Watches for:** rageclicks during a save-conflict retry, clicking a
  "coming soon" template, hammering a stuck export button, unresponsive
  artwork resize/rotate handles, and repeated empty template searches.
- **Scope:** any session with a `$rageclick` event, no URL restriction,
  sampled at 100%.
- **Estimated spend:** **4,000 credits/month**.

### 3. Box design session summaries (summarizer)
- **Watches:** every session, generating a plain-language summary using the
  product's real vocabulary (templates, panels, artwork, dielines, materials,
  2D/3D preview, export).
- **Scope:** unscoped, sampled at 10%.
- **Estimated spend:** **~870 credits/month**.

## Budget flag — needs your attention

Your org's free monthly allotment is **2,500 credits/period**. These three
scanners together project to roughly **6,070 credits/month** — well over
budget even after capping the breakage monitor. No tool was available during
setup to pause and confirm trade-offs with you interactively, so decisions
defaulted to "create everything, cap where clearly necessary." You'll likely
want to do one of:
- Lower the sampling rate on "Box studio frustration" (currently the biggest
  spender at 100%), or
- Add/adjust `credit_limit` caps on the other two scanners, or
- Raise your PostHog plan's credit quota.

## Where to look

Results land on the **Replay vision** page in PostHog as new recordings
complete and get scanned:
https://us.posthog.com/project/639018/replay-vision

Direct links:
- [Broken studio editor](https://us.posthog.com/project/639018/replay-vision/01a104fd-80dd-7fb7-b284-fb3ab787a36b)
- [Box studio frustration](https://us.posthog.com/project/639018/replay-vision/01a104fb-c0b5-723a-a236-5d35ad0cdbc3)
- [Box design session summaries](https://us.posthog.com/project/639018/replay-vision/01a104fb-8fe2-7cd4-b160-69a479b96ba2)
