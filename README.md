# BusinessOS &mdash; Modern SME Financial Operating System & Double-Entry Ledger

![BusinessOS Banner](./public/banner.png)

[![Next.js 16](https://img.shields.io/badge/Next.js-16.2.6-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.2.4-blue?style=flat-square&logo=react)](https://react.dev/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-7.9.1-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Better Auth](https://img.shields.io/badge/Better_Auth-1.6.27-purple?style=flat-square)](https://www.better-auth.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

**BusinessOS** is a multi-tenant financial operating system for Small and Medium Enterprises. It replaces spreadsheets with an auditable ledger: money is stored as 64-bit integer minor units so no arithmetic ever passes through a float, balances are maintained atomically alongside the entries that produce them, and financial history is corrected by reversal rather than edited.

---

## 📑 Table of Contents

- [Core Value Proposition](#core-value-proposition)
- [Key Features](#key-features)
  - [1. Financial Ledger](#1-financial-ledger)
  - [2. Counterparty (Party) Management & Statements](#2-counterparty-party-management--statements)
  - [3. Multi-Tenant Workspaces & Permissions](#3-multi-tenant-workspaces--permissions)
  - [4. Team Invitations & Onboarding](#4-team-invitations--onboarding)
  - [5. Transactional Email](#5-transactional-email)
  - [6. Security & Audit Logging](#6-security--audit-logging)
  - [7. Complete Mobile & Screen Responsiveness](#7-complete-mobile--screen-responsiveness)
- [Tech Stack](#tech-stack)
- [Project Architecture & Directory Structure](#project-architecture--directory-structure)
- [Database Schema & Data Model](#database-schema--data-model)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Engineering Standards & Conventions](#engineering-standards--conventions)
- [Known Limitations](#known-limitations)
- [License](#license)

---

## Core Value Proposition

1. **Precision first.** All monetary amounts are `BigInt` minor units (`amountMinor`, `receivableMinor`, `payableMinor`). Parsing rejects anything that is not a positive decimal with at most two places, and formatting renders the integer directly through `Intl.NumberFormat` rather than dividing into a `number` — so no value is rounded on its way to the screen.
2. **Balances that cannot silently drift.** Every entry moves exactly one balance column by a signed delta, applied as an atomic database increment inside the same transaction that writes the entry. Concurrent writers serialise on the row instead of overwriting each other.
3. **Gross receivable and payable.** The two sides are tracked independently and never netted, so a counterparty that is both a customer and a supplier carries a real figure on each side.
4. **Multi-tenant isolation.** Every query is scoped to the active workspace, resolved server-side from membership — never from a client-supplied identifier.
5. **Audit-ready history.** Entries are never edited or deleted; corrections are posted as linked `REVERSAL` entries, and privileged actions are recorded against a user, IP and user-agent.

---

## Key Features

### 1. Financial Ledger

- **Integer minor-unit arithmetic.** ₹1,250.50 is stored as `125050n`. `toMinorUnits()` raises a 400 on non-numeric input, negatives, exponent notation, or more than two decimal places rather than coercing them.
- **Gross balance tracking.** `receivableMinor` and `payableMinor` accumulate separately; the net is derived for display only. A balance may legitimately go negative — an overpayment leaves a negative receivable, which is a customer advance.
- **Atomic, concurrency-safe updates.** Entry creation and the balance change commit together, using `increment`/`decrement` so Postgres applies them in place under a row lock.
- **Back-datable entries.** `transactionDate` is the business date and may be set in the past; `createdAt` records when the row was written and never moves. Filtering and sorting use `transactionDate`.
- **Transaction types:**
  - `SALE` — increases the customer receivable
  - `PURCHASE` — increases the supplier payable
  - `PAYMENT_RECEIVED` — decreases the receivable
  - `PAYMENT_MADE` — decreases the payable
  - `OPENING_BALANCE` — seeds either side, via `direction`
  - `ADJUSTMENT` — corrects either side, via `direction`
  - `REVERSAL` — the inverse of a specific entry; **never postable directly**, only through the reversal endpoint
- **Single reversal, enforced by the database.** `reversedTransactionId` is a unique self-relation, so two concurrent reversal requests cannot both succeed.
- **Balance repair path.** `recomputeBalance()` replays a party's ledger; the snapshot is a cache of it, and an integration test asserts the two agree.
- **Server-side pagination and filtering** by counterparty, type, date range and keyword.
- **CSV export** that pages until complete (rather than silently truncating), escapes values that spreadsheets would otherwise evaluate as formulas, and carries a UTF-8 byte order mark for Excel.

### 2. Counterparty (Party) Management & Statements

- Centralised directory of customers, vendors and other counterparties, with GSTIN, PAN, address and contact details.
- Real-time standing per party: amount to collect, amount to pay, or settled.
- **Paged statements** showing each entry with its business date, author and reversal status, exportable to CSV.
- Server-side search and filtering with pagination; workspace-wide totals are computed by aggregate, so they remain correct while paging.

### 3. Multi-Tenant Workspaces & Permissions

Users can own or join multiple independent workspaces and switch between them from the top bar.

Authorization is a **named permission matrix** (`src/modules/auth/permissions.ts`) rather than role-string comparisons, enforced in the service layer so no caller — route, server component or otherwise — can bypass it.

| Permission | OWNER | ADMIN | ACCOUNTANT |
|---|:--:|:--:|:--:|
| Parties: view / create / update | ✓ | ✓ | ✓ |
| Transactions: view / create | ✓ | ✓ | ✓ |
| Members: view | ✓ | ✓ | ✓ |
| Business settings: view | ✓ | ✓ | ✓ |
| Party archive | ✓ | ✓ | — |
| Transaction reverse | ✓ | ✓ | — |
| Members: invite / remove / change role | ✓ | ✓ | — |
| Invitations: view | ✓ | ✓ | — |
| Email templates: manage | ✓ | ✓ | — |
| Audit trail: view | ✓ | ✓ | — |
| Business settings: update | ✓ | — | — |
| Grant or revoke OWNER | ✓ | — | — |

Granting and revoking ownership is reserved to `OWNER`, and a workspace always retains at least one owner.

### 4. Team Invitations & Onboarding

- Invitations carry a 32-byte random token and expire after 7 days. The raw token is never returned by the API; callers permitted to invite receive a ready-built invite URL instead.
- **Existing users** join with one click, after the invited address is matched against their account.
- **New users** set a password, and their address is marked verified in the same transaction that creates the membership — following a link sent to that address is what proves ownership of it. If membership fails, the part-created account is rolled back.
- Pending invitations can be copied or revoked.

### 5. Transactional Email

Email content lives in `src/lib/email/templates`, not in a third-party dashboard, so a fresh deployment sends correct mail with no manual setup and the wording is reviewed alongside the code that triggers it.

- Verification, password reset and team invitation, sharing a table-based layout with inline styles for mail-client compatibility, each sent with a generated plain-text part.
- Variables are substituted into `{{NAME}}` placeholders and HTML-escaped; link placeholders are restricted to `http`/`https`.
- **Workspace owners and admins can customise the invitation wording** from Settings → Email Templates, with a sandboxed preview and one-click restore. Overrides render through the same escaping path as the built-ins.
- Verification and password reset are **platform-scoped and deliberately not tenant-editable**: they are sent with no workspace context and on behalf of every tenant.

### 6. Security & Audit Logging

- **Optimistic routing guard** (`src/proxy.ts`) reads the session cookie only; real authorization happens server-side in the app layout and in every route and service.
- **Audit log** of privileged actions (`AuditAction` enum) with user, workspace, IP, user-agent and JSON metadata. Entries written inside a transaction commit or roll back with it.
- Session and membership are resolved once per request via React `cache()`.
- Validated environment (`src/lib/env.ts`), `trustedOrigins`, secure cookies in production, Better Auth rate limiting, and Google account linking.
- The public newsletter endpoint answers identically whether or not an address is known, so it cannot be used to test whether someone has an account.

### 7. Complete Mobile & Screen Responsiveness

- Dedicated layouts for mobile (`< 640px`), tablet (`640px–1024px`) and desktop (`> 1024px`).
- Mobile navigation drawer containing links, workspace switcher and profile actions.
- All tables wrapped in `overflow-x-auto`; forms and modals stack on narrow viewports.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | [Next.js 16.2.6](https://nextjs.org/) | App Router, React Server Components, Turbopack |
| **Language** | [TypeScript 5.x](https://www.typescriptlang.org/) | Strict mode, no `any` in application code |
| **Database** | PostgreSQL ([Neon](https://neon.tech/)) | Cloud-native serverless Postgres |
| **ORM** | [Prisma 7.9.1](https://www.prisma.io/) | Schema, migrations, type-safe queries |
| **Authentication** | [Better Auth 1.6.27](https://www.better-auth.com/) | Email/password, Google OAuth, database sessions |
| **Email** | [Resend](https://resend.com/) | Delivery; content lives in this repository |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Utility-first CSS |
| **Validation** | [Zod 4.x](https://zod.dev/) | Request bodies, query strings and environment |
| **Testing** | [Vitest 4](https://vitest.dev/) | Unit and database-backed integration tests |

---

## Project Architecture & Directory Structure

```
BusinessOS/
├── .github/workflows/ci.yml       # Typecheck, lint, tests, migrations, build
├── prisma/
│   ├── schema.prisma              # Database schema
│   └── migrations/                # Version-controlled SQL migration history
├── src/
│   ├── app/
│   │   ├── (app)/                 # Authenticated application shell
│   │   │   ├── components/        # AppTopBar, AppFooter
│   │   │   ├── dashboard/         # Receivable/payable overview & recent ledger
│   │   │   ├── parties/           # Party directory & per-party statements
│   │   │   ├── transactions/      # Ledger, filters & CSV export
│   │   │   └── settings/          # Profile, team, email templates, audit trail
│   │   ├── (auth)/                # Sign in, sign up, password reset
│   │   ├── (marketing)/           # Landing page and legal pages
│   │   ├── (onboarding)/          # Business creation
│   │   ├── api/                   # Route handlers
│   │   └── invite/[token]/        # Invitation acceptance
│   ├── db/                        # Prisma client singleton
│   ├── generated/prisma/          # Generated client (gitignored)
│   ├── lib/
│   │   ├── auth.ts                # Better Auth server configuration
│   │   ├── auth-client.ts         # Better Auth React client
│   │   ├── env.ts                 # Zod-validated server environment
│   │   └── email/                 # Sender, renderer and template catalogue
│   ├── modules/                   # Domain modules (schemas / services / repositories)
│   │   ├── audit/                 # Audit logging
│   │   ├── auth/                  # Permission matrix & request context
│   │   ├── businesses/            # Workspaces, members, invitations, email templates
│   │   ├── emailList/             # Newsletter subscribers
│   │   ├── parties/               # Counterparties & balances
│   │   └── transactions/          # Ledger engine, entries & reversals
│   ├── proxy.ts                   # Next.js 16 optimistic routing guard
│   └── shared/
│       ├── api/                   # Error boundary, cookies, request metadata
│       ├── components/            # Logo and brand marks
│       ├── errors/                # AppError
│       └── utils/                 # Currency, CSV, serialization, rate limiting
├── AGENTS.md                      # Mandatory AI agent rules
└── README.md
```

A feature flows `Route handler → Zod schema → Service (authorization, business rules) → Repository → Prisma`. Authorization and audit logging live in the service layer, so they apply regardless of caller.

---

## Database Schema & Data Model

```mermaid
erDiagram
    User ||--o{ BusinessUser : "belongs to"
    User ||--o{ Transaction : "creates"
    User ||--o{ AuditLog : "triggers"
    User ||--o{ Invitation : "invites"
    User ||--o{ Session : "authenticates"
    User ||--o{ Account : "links"

    Business ||--o{ BusinessUser : "members"
    Business ||--o{ Party : "manages"
    Business ||--o{ Transaction : "records"
    Business ||--o{ AuditLog : "tracks"
    Business ||--o{ Invitation : "issues"
    Business ||--o{ EmailTemplateOverride : "customises"

    Party ||--o{ Transaction : "incurs"
    Party ||--|| PartyBalance : "has"
    Transaction |o--o| Transaction : "reverses"

    Business {
        string id PK
        string name
        string gstin
        string pan
        string currency
        string timezone
    }

    BusinessUser {
        string id PK
        string businessId FK
        string userId FK
        BusinessRole role
    }

    Party {
        string id PK
        string businessId FK
        string name
        string gstin
        string pan
        boolean isArchived
    }

    PartyBalance {
        string id PK
        string partyId FK
        BigInt receivableMinor
        BigInt payableMinor
    }

    Transaction {
        string id PK
        string businessId FK
        string partyId FK
        TransactionType transactionType
        BigInt amountMinor
        BalanceDirection direction
        datetime transactionDate
        string referenceNumber
        string reversedTransactionId FK
        datetime createdAt
    }

    AuditLog {
        string id PK
        string businessId FK
        string userId FK
        AuditAction actionType
        json metadata
        string ipAddress
    }

    Invitation {
        string id PK
        string businessId FK
        string email
        string token UK
        BusinessRole role
        InvitationStatus status
        datetime expiresAt
    }

    EmailTemplateOverride {
        string id PK
        string businessId FK
        string templateKey
        string subject
        string html
    }
```

**Invariants worth knowing:**

- `Transaction.amountMinor > 0` is a database `CHECK`; sign is carried by `transactionType` and `direction`.
- `Transaction.reversedTransactionId` is `UNIQUE`, so an entry can be reversed at most once.
- Financial foreign keys are `RESTRICT`, so a business, party or author with ledger history cannot be deleted.
- `PartyBalance` is a cache of the ledger, not an independent source of truth.

---

## Getting Started

### Prerequisites

- **Node.js** 22.x (the version CI runs; 20.x should also work)
- **npm** 10.x
- **PostgreSQL** 15+, or a [Neon](https://neon.tech/) instance

### 1. Clone & install

```bash
git clone https://github.com/rauhan-sheikh/BusinessOS.git
cd BusinessOS
npm install
```

> `.npmrc` sets `legacy-peer-deps`. npm 10.9.2's strict resolver crashes while walking Vitest's optional-peer graph; the reasoning is recorded in the file and should be revisited once npm ships a fix.

### 2. Environment variables

Copy `.env.example` to `.env` and fill it in. The schema in `src/lib/env.ts` validates these at startup, so a missing or malformed value fails immediately and names itself.

```env
DATABASE_URL="postgresql://user:password@localhost:5432/businessos?schema=public"

# At least 32 characters. BETTER_AUTH_SECRET is accepted as an alias.
AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000

RESEND_API_KEY=
EMAIL_FROM="BusinessOS <noreply@mail.example.com>"

# Optional: Google sign-in is unavailable when unset.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

No email template configuration is required — content ships with the application.

### 3. Database

```bash
npx prisma migrate deploy   # apply migrations
npx prisma generate         # generate the client
```

> When changing the schema locally, create a named migration with `npx prisma migrate dev --name <change_name>`. Never use `prisma db push` on a branch that will be deployed. Renames of enum values or columns must be hand-edited into `ALTER ... RENAME` — Prisma proposes a destructive drop-and-recreate, which would discard ledger data.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Development server with Turbopack |
| `npm run build` | Generates the Prisma client and builds for production |
| `npm start` | Production server |
| `npm run lint` | ESLint, failing on any warning |
| `npm test` | Full test suite |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Tests with a V8 coverage report |
| `npm run db:deploy` | Applies pending migrations (deliberately **not** part of `build`) |
| `npx tsc --noEmit` | Type check |
| `npx prisma studio` | Browse the database |

---

## Testing

[Vitest](https://vitest.dev/) covers the parts of the system where being wrong is expensive:

- **Unit** — minor-unit parsing and formatting, the ledger effect table, balance replay (including a randomised property test against incremental application), the permission matrix, and CSV escaping.
- **Integration** — real database behaviour that cannot be mocked: that concurrent balance updates are not lost, that the unique constraint blocks a double reversal, that the `CHECK` constraint rejects a non-positive amount, that privilege escalation paths are closed, and that snapshots still agree with the ledger.

Integration tests skip themselves when `DATABASE_URL` is unset, so `npm test` runs without a local database. CI provides a Postgres service container so they actually execute.

```bash
npm test
```

---

## Deployment

Production deploys run **in order, each gated on the last**:

```
push to main
  └─ verify   typecheck, lint, 117 tests, migrate-from-empty, drift check, build
      └─ migrate   apply pending migrations to Neon
          └─ deploy   build and ship to Vercel
```

A failed migration stops the deploy, so code is never live against a schema that has not been migrated.

**Two things had to change to get that ordering.**

`prisma migrate deploy` came out of `npm run build`. Inside the build it ran in every build container — previews included — before any deploy gate, and with no way back, since Vercel's instant rollback reverts code only and leaves the new schema in place.

Vercel's git auto-deploy is disabled for `main` in `vercel.json`, because it does not wait for anything: it would otherwise ship on the same push the migration was still running on. Pull requests still get preview deployments as normal.

### One-time setup

Four repository secrets (GitHub → Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `PRODUCTION_DATABASE_URL` | Neon's **direct, non-pooled** connection string. Migrations need a real session, which a pooled connection cannot guarantee — pooled hostnames contain `-pooler`, the direct one does not. |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | Run `npx vercel link`, then read `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Same file |

No GitHub environment is used, deliberately: Vercel's integration manages one named `Production`, and sharing the name would entangle deployment state with migration state.

### Running migrations by hand

```bash
MIGRATION_DATABASE_URL="<neon direct url>" npm run db:deploy
```

`prisma.config.ts` prefers `MIGRATION_DATABASE_URL` over `DATABASE_URL`, so this works without touching the application's own connection string.

### Migration safety

Ordering is guaranteed, but a deploy is not instantaneous, so prefer **expand-then-contract**: add before you remove, and let a deploy pass between the two, so old and new code can both run against the intermediate schema.

Renames are the exception — `ALTER ... RENAME` preserves data but is not backward-compatible in either direction, so the previous code breaks the moment it lands. The gating means it lands *before* the new code rather than after, which is the safer half of a short window, but plan those for a quiet moment regardless.

---

## Engineering Standards & Conventions

1. **Money.** Store minor units as `BigInt`. Convert with `toMinorUnits()`; display with `formatCurrency()` or `toDecimalString()`. `toMajorUnits()` is lossy above `Number.MAX_SAFE_INTEGER` and is for interop only.
2. **Ledger immutability.** Never mutate or delete a posted entry. Correct with a `REVERSAL`, which links to the original.
3. **Authorization.** Ask for a named permission from `src/modules/auth/permissions.ts`; never compare role strings. Enforce in the service layer, not in route bodies.
4. **Errors.** Throw `AppError(message, status)`; `withApiHandler` maps it, along with Zod and Prisma errors, to a consistent response. Never return an internal message to a caller.
5. **Tenancy.** Every query is scoped by `businessId` resolved from membership. Never trust a client-supplied workspace identifier.
6. **Responsiveness.** Every page, table, form and modal must work at mobile, tablet and desktop widths. Tables are wrapped in `overflow-x-auto`.
7. **Documentation.** Update this README whenever schema, API routes or architecture change.

---

## Known Limitations

Honest about what is not built yet:

- **Minor-unit exponent is fixed at 2.** Currencies with a different exponent (JPY, KWD) are not supported. Currency also cannot be changed once the ledger has entries, since stored amounts are denominated in it.
- **Subsidiary ledger, not a general ledger.** There is no chart of accounts and no debit/credit pairing, so a trial balance, P&L or balance sheet cannot be produced from this data. Invoices, payments with allocation, and reporting are the next major module.
- **Rate limiting is in-process**, so on serverless it is per-instance rather than global. Adequate against a naive script; not a defence against a distributed attacker.
- **Party search uses `ILIKE`**, which cannot use an index. A trigram index is needed before the directory grows large.
- **No shared UI component library yet.** Feedback still uses `alert()`/`confirm()` in places, and there are no `error.tsx` / `loading.tsx` boundaries.
- **Users with ledger history cannot be deleted** (foreign keys are `RESTRICT`), so there is no data-erasure path yet.

---

## License

Licensed under the [MIT License](LICENSE).
