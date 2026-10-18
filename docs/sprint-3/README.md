# Sprint 3 integration

The active team integration branch is **develop-3**; **main** is the stable delivery branch. Current local implementation starts from `82c6aa5b51e0d115d19d5e0b70e9f69f9825591b`. The repair delivery branch is the user's **database** branch. Acceptance was performed before delivery and is bound to the source manifest; delivery does not merge into develop-3 or main, and no reviewed PR is claimed.

- [Current acceptance evidence](verification.md)
- [Local Docker setup, migrations and recovery](local-verification.md)
- [Demonstration sequence](demo-script.md)
- [API contract](../api/api-contract.md)
- [System management contract](system-management-api.md)
- [Historical backend handoff](backend-handoff.md)
- [Repair checklist](../../数据库与接口问题修复清单.md)

## Task traceability

The user's assignment screenshot identifies Zeheng Li's tasks as **ELG2-46** (Dashboard KPIs), **ELG2-47** (multi-role accounts/database compatibility), and **ELG2-51** (email/verification persistence). Related integration tasks are ELG2-43/44/45 (system UI, thresholds and latest readings), ELG2-48/49 (profile API/UI), ELG2-50 (permissions), ELG2-52 (verification workflow), and ELG2-53 (final evidence). Earlier API notes use **ELG2-25 → ELG2-44** and **ELG2-26 → ELG2-46** for the same threshold/KPI capabilities.

System-management backend was already present in develop-3. Charts, presentation styles and Alert Centre request handling reuse the team's remote `feature/ELG2-27-frontend-dashboard` implementation at `8e00ef7`, with integration changes for current APIs. This document records integration and verification; it does not reassign team authorship or claim that Jira issues/PRs were updated. Historical Sprint 1/2 evidence and dated handoff results remain historical.
