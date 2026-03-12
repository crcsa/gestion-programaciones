# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sistema de Gestión de Programaciones** for Cruz Roja Colombiana (Colombian Red Cross). A web platform to manage personnel scheduling for both headquarters shifts and extramural blood donation campaigns. First implementation targets the Blood Bank (Servicios Transfusionales) area, with the architecture designed to scale to other organizational areas.

**Status:** Pre-development / documentation phase. No source code yet — only requirements docs and diagrams.

## Commands

### LaTeX Document
```bash
cd docs/necesidades && pdflatex documento-necesidades.tex
```

### Planned Dev Commands (once scaffolded)
```bash
pnpm dev              # Next.js dev server
pnpm build            # Production build
pnpm lint             # ESLint
pnpm db:push          # Drizzle push schema
pnpm db:migrate       # Drizzle migrations
pnpm db:studio        # Drizzle Studio
pnpm test             # Vitest unit/integration
pnpm test:e2e         # Playwright E2E
pnpm test -- path     # Run single test file
docker compose up -d  # Start PostgreSQL + app
```

## Repository Structure

- `docs/necesidades/documento-necesidades.tex` — **Primary reference**: full requirements & architecture document (LaTeX, Spanish). Contains all business rules, data model, roles, workflows, tech stack decisions, and phased implementation plan.
- `docs/necesidades/documento-necesidades.pdf` — Compiled PDF of the above.
- `docs/necesidades/diagramas-excalidraw/` — 7 Excalidraw diagram JSON files (architecture, data flow, campaign lifecycle, smart assignment, data model, roles, hour computation). See the `README.md` there for index.
- `docs/CAPACIDAD ROTACIÓN PERSONAL BS.xlsx` — Reference spreadsheet with current personnel rotation data from Blood Bank.
- `logos/` — SVG logos (full, full-dark, icon variants).

## Tech Stack (Specified in Requirements)

- **Framework:** Next.js 15 (App Router) with TypeScript
- **ORM:** Drizzle ORM with PostgreSQL 16
- **Auth:** Better Auth (credentials + RBAC)
- **UI:** shadcn/ui + Tailwind CSS 4
- **Forms:** React Hook Form + Zod (shared client/server validation)
- **State:** TanStack Query v5
- **Calendar:** FullCalendar v6
- **Tables:** TanStack Table v8
- **Excel I/O:** SheetJS (xlsx)
- **Dates:** date-fns v3
- **Deployment:** Docker + Docker Compose

## Key Architecture Decisions

- **Server Actions** as the primary data layer (no separate REST API). API routes only for Excel import/export.
- **Business rule parameters** stored in the database (`system_config` table), not hardcoded — allows adjusting labor rules without redeployment.
- **Authorization in 3 layers:** middleware (routes), component (`<RoleGate>`), server action (data).
- **Conflict detector** with 2 severities: BLOCK (hard stops: schedule overlap, >12h shift, untrained area) vs WARN (soft: overtime proximity, Sunday/overnight limits, rest gap, municipality restriction).
- **Coordinator per campaign** is a dynamic designation (not a system role) — grants temporary permissions to record actual hours for that specific campaign only.

## Domain Concepts

- **4 system roles:** Admin, Banco de Sangre, Comercial, Operativo
- **4 staff profiles:** Bacteriólogo, Médico, Técnico Operativo, Técnico Administrativo
- **Campaign sizes:** S (2+2), M (2+4), L (3+6) — bacteriologists + technicians
- **Campaign states:** Tentativa → Confirmada / Cancelada
- **Campaign modalities:** Corporativa, Carpa, Unidad Móvil, Municipal, Combinada
- **Weekly hour computation:** sede hours + campaign hours = total → extras = total − 44h. Balance carries over to next week.
- **9 assignment validations:** 3 BLOCK + 6 WARN (see section 10 of the requirements doc)
- **Monthly limits:** max 2 Sundays worked, max 1 overnight per person per month

## Language Convention

All documentation, UI labels, and domain terminology are in **Spanish**. Code identifiers (variables, functions, database columns) should be in **English** following the data model in the requirements doc (e.g., `staff_members`, `campaign_assignments`, `weekly_balance`).

## Working with Excalidraw Diagrams

Diagram JSON files are arrays of Excalidraw elements. To render them, use the `mcp__excalidraw__create_view` tool or paste contents into excalidraw.com.
