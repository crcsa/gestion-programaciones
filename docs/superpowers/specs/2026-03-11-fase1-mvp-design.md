# Fase 1 MVP — Design Spec

## Sistema de Gestión de Programaciones — Cruz Roja Colombiana

**Date:** 2026-03-11
**Status:** Approved
**Scope:** Phase 1 MVP (4 weeks)

---

## 1. Problem Statement

Cruz Roja Colombiana Seccional Antioquia manages Blood Bank personnel scheduling via Excel/Google Sheets. This causes: no real-time overtime visibility, no automatic conflict detection, no traceability, and disconnected workflows between Commercial and Blood Bank teams. The system serves 30-100 users handling 50+ campaigns/month plus weekly HQ shifts.

## 2. Solution

A Next.js 15 web platform with:
- Role-based access (4 roles: Admin, Banco de Sangre, Comercial, Operativo)
- Personnel directory with training area management
- Campaign lifecycle management (Tentativa → Confirmada / Cancelada)
- HQ shift scheduling
- Basic staff-to-campaign assignment with coordinator designation
- CRM Excel import for campaign creation
- Role-adapted dashboards

## 3. Architecture

**Pattern:** Feature-Based Hybrid — co-located feature modules with shared `lib/domain/` for cross-cutting business logic.

### 3.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + TypeScript |
| Database | PostgreSQL 16 (Supabase cloud) |
| ORM | Drizzle ORM (direct connection, not Supabase SDK) |
| Auth | Better Auth (credentials + RBAC) |
| UI | shadcn/ui + Tailwind CSS 4 |
| Forms | React Hook Form + Zod |
| State | TanStack Query v5 |
| Calendar | FullCalendar v6 |
| Tables | TanStack Table v8 |
| Excel | SheetJS (xlsx) |
| Dates | date-fns v3 |
| Testing | Vitest + Playwright |

### 3.2 Folder Structure

```
src/
├── app/                         # Next.js routes
│   ├── (auth)/login/
│   ├── (dashboard)/             # Authenticated pages
│   │   ├── personal/
│   │   ├── campanas/
│   │   ├── sede/
│   │   ├── programacion/
│   │   ├── reportes/
│   │   ├── directorio/
│   │   └── configuracion/
│   └── api/
│       ├── auth/[...all]/
│       └── excel/
├── features/                    # 8 feature modules
│   └── [feature]/
│       ├── components/
│       ├── actions/
│       ├── hooks/
│       └── schemas/
├── lib/
│   ├── db/schema/               # 16 Drizzle tables
│   ├── auth/                    # Better Auth + permissions
│   ├── domain/                  # Business logic core
│   └── excel/
├── components/                  # Shared UI
└── middleware.ts
```

### 3.3 Data Layer

- **Server Actions** as primary data layer (no REST API)
- API routes only for `/api/auth/` (Better Auth) and `/api/excel/` (file upload/download)
- Every server action: validate with Zod → check auth → execute → audit log → revalidatePath

### 3.4 Authorization (3 Layers)

1. **Middleware:** Route-level protection via role → route permission map
2. **Component:** `<RoleGate allowedRoles={[...]}>` for UI section visibility
3. **Server Action:** `assertRole(session, [...])` before any mutation

## 4. Database Schema

### 4.1 Enums

```
user_role: admin | banco_sangre | comercial | operativo
profile_type: bacteriologo | medico | tecnico_operativo | tecnico_administrativo
campaign_size: S | S_PLUS | M | L
campaign_modality: corporativa | carpa | unidad_movil | municipal | combinada
campaign_status: tentativa | confirmada | cancelada
shift_type: completo | noche | posturno
assignment_status: asignado | confirmado | completado | no_asistio
hours_entry_type: jornada_regular | campana | capacitacion | turno_noche | otro
availability_type: disponible | no_disponible | vacaciones | incapacidad | permiso | jornada_regular
```

### 4.2 Tables (16)

**Identity Domain:** users, staff_members, training_areas, staff_training_areas
**Operations Domain:** campaigns, campaign_assignments, campaign_timeline, companies, contacts, locations, sede_shifts
**Hours Control:** hours_log, weekly_balance, monthly_counters, staff_availability
**Config/Audit:** system_config, colombian_holidays, audit_log

### 4.3 Key Relationships

- users 1→1 staff_members (optional — not all users are staff)
- staff_members M→M training_areas (via staff_training_areas)
- campaigns M→1 companies, locations
- campaigns 1→M campaign_assignments
- campaigns 1→1 campaign_timeline
- campaigns M→1 staff_members (coordinator_id — dynamic designation)
- sede_shifts M→1 staff_members
- weekly_balance, monthly_counters, staff_availability M→1 staff_members

### 4.4 Campaign Size Composition

| Size | Bacteriologists | Technicians | Total |
|------|----------------|-------------|-------|
| S | 1 | 2 | 3 |
| S+ | 1 | 3 | 4 |
| M | 2 | 4 | 6 |
| L | 3 | 6 | 9 |

Doctors assigned per-need, not in fixed mix.

## 5. Supabase Connection Strategy

- **App connection:** Transaction pooler (port 6543), `prepare: false` for Supavisor compatibility
- **Migrations:** Direct connection (port 5432) via drizzle-kit
- **No Supabase SDK:** Using Drizzle ORM with `postgres` driver directly
- **Auth:** Better Auth (not Supabase Auth) per requirements

## 6. Key Business Rules (Configurable via system_config)

| Rule | Default Value |
|------|--------------|
| Weekly contract hours | 44h |
| Max overtime/week | 12h |
| Max shift duration | 12h |
| Min rest between shifts | 8h |
| Max Sundays/month | 2 |
| Max overnights/month | 1 |
| Municipality restriction | No campaigns day before; max 5pm if regular shift |

## 7. Phase 1 Scope

### Included
- Auth with 4 roles + middleware route protection
- Personnel CRUD with training area management
- Campaign CRUD with 3 states, 4 sizes, 5 modalities
- HQ shift scheduling (completo/noche/posturno)
- Basic staff assignment (filtered by profile + training area)
- Coordinator designation per campaign
- Excel import (CRM → tentativa campaigns)
- Company/contact directory
- Role-adapted dashboards
- Audit logging on all mutations

### Excluded (Phases 2-4)
- Conflict detector (9 validations) — Phase 2
- Hour registration + weekly balance computation — Phase 2
- Monthly counters (Sundays, overnights) — Phase 2
- Availability matrix — Phase 2
- Reports + Excel export — Phase 3
- Notifications — Phase 3
- Auto-assignment suggestions — Phase 4
- Hexabank API integration — Phase 4

## 8. Language Convention

- **UI text, labels, navigation:** Spanish
- **Code identifiers (variables, functions, DB columns):** English
- **Commit messages:** English with conventional commits (feat/fix/refactor/...)

## 9. Testing Strategy

- **Unit tests (Vitest):** Domain logic, Zod schemas, utility functions
- **Integration tests (Vitest):** Server actions with test DB
- **E2E tests (Playwright):** Auth flow, role-based navigation, CRUD operations
- **Target:** 80%+ coverage
