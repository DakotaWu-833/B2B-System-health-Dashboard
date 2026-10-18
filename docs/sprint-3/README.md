# Sprint 3 integration

The active team integration branch is **develop-3**; **main** is the stable delivery branch. The 19 October follow-up to [PR #19](https://github.sydney.edu.au/2026S2-Object-Oriented-App-Frameworks/ELEC5619-Lab02-Group-02/pull/19) integrates `develop-3` at `73331e3`, including merged PR #18, into the existing **database** delivery branch. Updating this branch does not merge PR #19 or release to main. Current results and the earlier source-manifest evidence are recorded separately.

- [Current integration verification](pr19-follow-up-verification.md)
- [Sprint 3 team retrospective](retrospective.md) and [standalone PDF](retrospective.pdf)
- [Historical 18 October acceptance evidence](verification.md)
- [Local Docker setup, migrations and recovery](local-verification.md)
- [Demonstration sequence](demo-script.md)
- [API contract](../api/api-contract.md)
- [System management contract](system-management-api.md)
- [Historical backend handoff](backend-handoff.md)
- [Repair checklist](../../数据库与接口问题修复清单.md)

## Task traceability

The user's assignment screenshot identifies Zeheng Li's tasks as **ELG2-46** (Dashboard KPIs), **ELG2-47** (multi-role accounts/database compatibility), and **ELG2-51** (email/verification persistence). Related integration tasks are ELG2-43/44/45 (system UI, thresholds and latest readings), ELG2-48/49 (profile API/UI), ELG2-50 (permissions), ELG2-52 (verification workflow), and ELG2-53 (final evidence). Earlier API notes use **ELG2-25 → ELG2-44** and **ELG2-26 → ELG2-46** for the same threshold/KPI capabilities.

System-management backend was already present in develop-3. The earlier database integration reused the team's frontend at `8e00ef7`. The 19 October follow-up now preserves the merged PR #18 implementation (`355f8bf`) while adding PR #19's pagination and profile capabilities. This document records integration and verification; it does not reassign team authorship or claim Jira completion. Historical Sprint 1/2 evidence and dated handoff results remain historical.
