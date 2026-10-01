# PostHog Self-driving setup report

## Summary

PostHog Self-driving is configured with Session Replay, Error Tracking, and Support enabled; health, error, and support responders are active. The scout troop is tuned to seven focused scouts, including two custom studio-flow scouts. Findings will begin appearing in the [Self-driving inbox](https://us.posthog.com/project/639018/inbox) within about 30 minutes of new eligible activity.

## AI data processing

Approved by the wizard's organization-level gate before this setup ran.

## GitHub

The PostHog GitHub App was already connected before this run. GitHub Issues was not selected as an inbox source, so its responder was not enabled.

## Products enabled

| Product | Result | Application check |
| --- | --- | --- |
| Session Replay | Already enabled | Existing web recordings confirm it is operating. The browser initialization does not disable recording. |
| Error Tracking | Enabled | The browser initialization has `capture_exceptions: true`; it does not override the server setting. |
| Support (Conversations) | Enabled | Support tickets require an inbound email, inbox, or Slack channel before they can arrive. |

## Signal sources

| Source product | Source type | Action |
| --- | --- | --- |
| `health_checks` | `health_issue` | Enabled. |
| `error_tracking` | `issue_created` | Enabled. |
| `error_tracking` | `issue_reopened` | Enabled. |
| `error_tracking` | `issue_spiking` | Enabled. |
| `conversations` | `ticket` | Enabled; dormant until a Support inbound channel is connected. |
| `signals_scout` | `cross_source_issue` | No row created; Self-driving scout findings are enabled by default. |
| `session_replay` | `session_analysis_cluster` | Deliberately skipped; this retired responder is replaced by Replay Vision scanners. |
| `replay_vision` | scanner configuration | No source row is needed; a scanner’s `emits_signals` setting is its authorization. The scanners were deferred for budget reasons. |

## Connected tools

No external connected tools were selected. No warehouse sources or external-tool responders were created.

## Scout troop

**Run budget:** 100 runs/day enforced; 0 used today and 100 remaining when configured. The current announcement says Scouts are in early access and additional run capacity can be requested from PostHog.

### Enabled (7)

| Scout | Coverage |
| --- | --- |
| General | Cross-product correlations and surfaces without a specialist. |
| Product analytics | Core behavioral-flow regressions. |
| Web analytics | Traffic, attribution, landing-page, and web health regressions. |
| Logs | Operational pattern shifts, spikes, and service silence. |
| Observability gaps | High-value activity that lacks durable coverage. |
| Studio creation flow (custom) | Artwork-upload to design-save conversion, normalized by upload volume. |
| Studio sharing flow (custom) | Saved-design to share conversion, normalized by save volume. |

### Disabled (22)

| Scout | Reason |
| --- | --- |
| AI observability | No AI/LLM telemetry was found. |
| Anomaly detection | No established dashboard or insight surface was found to watch. |
| APM | No tracing/APM usage was found. |
| Conversations | Support has no inbound channel configured yet. |
| CSP violations | No CSP-reporting integration was found. |
| Customer analytics | No account-level analytics evidence was found. |
| Data pipelines | No pipeline surface was identified. |
| Data warehouse | No external warehouse sources were selected. |
| Error tracking | Covered by the enabled native Error Tracking responders. |
| Experiments | No experiment usage evidence was found. |
| Feature flags | No feature-flag usage evidence was found. |
| Inbox validation | Deferred until the inbox has resolved reports to validate. |
| Insight alerts | No insight-alert surface was found. |
| MCP tool calls | Not a product surface for this application. |
| Replay Vision | Deferred because no Replay Vision monitors were created this run. |
| Revenue analytics | No payment or revenue integration was found. |
| Session replay | Kept off to avoid duplicate replay analysis; Replay Vision coverage is currently deferred pending budget approval. |
| Skills store | No ongoing skills-store hygiene need was identified. |
| Surveys | No surveys exist in the project. |
| Tasks | No PostHog Tasks usage evidence was found. |
| PR follow-up | No linked pull-request workflow was configured. |
| Web vitals | No web-vitals usage evidence was found. |

## Custom scouts

| Scout | Design |
| --- | --- |
| `signals-scout-studio-creation-flow` | Watches the creative completion path from artwork upload to saving a packaging design. It reports only sustained save-rate drops while upload activity remains healthy, which distinguishes a broken handoff from lower traffic. It adds domain-specific coverage beyond the broad product-analytics scout. |
| `signals-scout-studio-sharing-flow` | Watches the collaboration handoff from saving to sharing a design. It reports only sustained sharing-rate drops while saves remain steady, distinguishing sharing friction from lower overall activity. It adds domain-specific coverage beyond the general scout. |

Considered but not added: separate error, session-replay, revenue, surveys, AI, APM, CSP, experiment, and feature-flag coverage. Each was either already routed to a native responder, deferred to Replay Vision, or lacked supporting usage evidence.

If either custom scout proves noisy, set its configuration’s `emit` value to `false` in PostHog to convert it to dry-run mode.

## Replay Vision scanners

A Replay Vision scanner is an LLM that watches individual session recordings on a schedule and pushes high-confidence findings to the inbox. It is the only part of this setup that consumes Replay Vision quota. Findings enter at half weight and need independent corroboration before promotion into a report.

| Brief | Proposed name | Query scope | Sampling | Estimate | Result |
| --- | --- | --- | --- | --- | --- |
| Breakage monitor | Studio editor breakage | Recordings whose URL contains `/studio`, the primary editor/save completion flow | 50% | 570 observations/month; 2,850 credits/month | Skipped at your choice. |
| Frustration monitor | Studio editor frustration | Recordings containing `$rageclick` only; no URL filter, to preserve monitor independence | 100% | 210 observations/month; 1,050 credits/month | Skipped at your choice. |

Together, the monitors are estimated at **3,900 credits/month** (about $39), or roughly **3,848 credits** over the current period, versus **2,500 credits** remaining. No existing scanners were found. Session Replay itself is recording, so these monitors can be created later without application changes.

## Follow-ups

- [ ] Connect an inbound Support channel (email, inbox, or Slack) in PostHog so the enabled Conversations ticket responder receives tickets.
- [ ] If Replay Vision inbox coverage is desired, approve a credit budget or reduce scope, then create the two deferred monitors.
- [ ] Enable additional built-in scouts only when their corresponding product surface becomes active.

## Files modified or created

- Created `posthog-self-driving-report.md`.
- No application source files were modified.

## What happens next

The scout coordinator picks up fresh configs within about 30 minutes. Scout runs use the project’s daily run budget; their findings cluster into reports in the [Self-driving inbox](https://us.posthog.com/project/639018/inbox), where immediately actionable findings can begin coding tasks.
