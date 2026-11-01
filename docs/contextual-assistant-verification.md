# Contextual floating assistant — 1 November 2026 (Australia/Sydney)

Base revision: `advance` at `dbdfc9b`. This change adds a persistent lower-right
launcher and a page-aware right-side conversation. It retains the full knowledge
workspace and existing approval-gated Agent.

## Automated checks

- Full backend suite plus H2 V1–V6 migration and real Redis runtime test:
  **185 tests passed**, no failures/errors/skips.
- After final input-validation/reference cases were added, all **9 contextual
  chat integration tests passed** again, including unknown `T` references,
  combined valid references and null/privileged conversation-history entries.
- Frontend: **94 tests passed across 16 files**; production build passed.
- Executable Spring Boot package passed; the preview runs from a copied immutable
  release outside the build directory, using the existing isolated MySQL data.

Backend checks include fresh dashboard/selected-alert evidence, mismatched record
rejection, role/CSRF boundaries, private runbook filtering, Management maintenance
restrictions, profile-data minimisation and routing to the existing Agent.
Frontend checks cover preset questions on all six pages, one-click sending,
presets remaining after an answer, history across minimise/reopen, context-change
cancellation, stale-response isolation, selected alert context, clearing selection,
proposal review/confirmation, Management read-only controls and mounting inside
system dialogs. The prior timeout tests remain in the full frontend suite.

## Live verification

The local application uses frontend `5176`, backend `8086`, MySQL `13316`, Redis
`6386` and Ollama `11436`, with the existing local Qwen chat/embedding models.
The actual browser was signed in and used to click the preset “What does
acknowledged mean?” in the Alert Center conversation. It returned a cited answer
that acknowledgment means ownership rather than recovery. The preset questions
remained above the input and were enabled again after completion. An alert-row
Ask AI button selected Legacy CRM / alert #3 and displayed record-specific
presets plus the investigation shortcut.

System-detail testing confirmed that the conversation mounts inside the native
dialog and stays within the 1280×900 viewport. Escape closed only the chat while
the system dialog remained open. At a 320×800 viewport, after correcting the
scrollbar-width interaction, the page's scroll width equalled its 305 px client
width, the chat began 12 px from the edge, and its composer remained visible.
The temporary viewport override is reset before delivery.

Live review also exposed a distinction the model needed to see explicitly:
stored alerts/health are historical evidence, while current availability can be
unknown when readings are stale. Context now supplies separate last-reported
health, measurement freshness, current availability and report timestamps, plus
the current observation clock. The UI displays the freshness notice before the
answer. All 20 affected backend tests and all 11 widget tests passed after this
follow-up; the frontend and executable backend builds passed again.
The final real-model selected-alert request returned `generated_with_sources`
in 3.41 seconds, explicitly stating that current availability was unknown due to
stale readings, alongside the visible freshness notice. This is one local
observation, not a latency guarantee.

This record covers local validation. Docker execution, remote CI outcome,
production deployment and a general retrieval-quality benchmark are separate
from these checks. Source-reference validation does not prove every model
statement is correct; operational suggestions still need review.
