# Smart Clinic Admin Panel — Documentation

## Contents

| File | Description |
|---|---|
| ARCHITECTURE.md | Overall system architecture, tech stack, design decisions |
| ROUTING.md | Route map, auth guards, layout hierarchy, sidebar navigation |
| MODULES.md | Detailed breakdown of every screen/page (Login, Register, Tenants, Doctors, Licenses, Settings, Updates) |
| DATA_FLOW.md | Firestore CRUD patterns, dual-write logic, API routes, sync queue |
| COMPONENT_TREE.md | Component hierarchy, shared components, MUI usage patterns |
| FIREBASE_SCHEMA.md | All 13 Firestore collections with field-level schemas |
| ENVIRONMENT.md | Environment variables, scripts, build/deploy config |

## Quick Links

- Source: src/App.jsx (routing + auth guard)
- Source: src/services/firestoreService.js (all Firestore operations)
- Source: src/pages/ (6 page modules)
- API: api/admin/ (3 serverless functions)

## Data Architecture Summary

saas_*  <--->  Admin Panel (CRUD via Client SDK)
   |
   |  (dual-write mirror via buildPublic*())
   v
comm_*  <--->  Community Booking Site (public read)

## Key Patterns

1. **Dual-Write** — Tenants and Doctors written to both saas_* and comm_*
2. **Client-Side CRUD** — Direct Firestore from browser (no backend for CRUD)
3. **Serverless APIs** — Only for Auth operations (OTP, create-doctor-auth)
4. **Bilingual Data** — All text stored as { en: string, ar: string }
5. **No Global State** — Local useState + SidebarCtx context only
