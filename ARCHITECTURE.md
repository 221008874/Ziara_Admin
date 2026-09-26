# Architecture

**The canonical architecture document for every Zeyara app lives at
[`../ARCHITECTURE.md`](../ARCHITECTURE.md)** — one level up, outside this repository.

It covers all seven deployables (Community SPA, Admin panel, ERP, Clinic Server,
and the three desktop apps), both Firebase projects, the collection access matrix,
the real booking and sync flows, licensing, the update chain, and a
severity-ranked findings register.

Please do not add per-app architecture documents here. If the code changes,
update the canonical file — it records the commit SHA of every repo it was
verified against, so drift is detectable.

## Still relevant to this repo

`docs/ENVIRONMENT.md` covers the per-project Admin SDK credentials
(`COMMUNITY_*` / `ERP_*`) introduced in `d154be9`.
