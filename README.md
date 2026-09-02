# BusinessOS &mdash; Modern SME Financial Operating System & Double-Entry Ledger

![BusinessOS Banner](./public/banner.png)

[![Next.js 16](https://img.shields.io/badge/Next.js-16.2.6-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0.0-blue?style=flat-square&logo=react)](https://react.dev/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-7.9.1-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Better Auth](https://img.shields.io/badge/Better_Auth-1.6.27-purple?style=flat-square)](https://www.better-auth.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

**BusinessOS** is an all-in-one financial operating system and double-entry accounting ledger crafted specifically for Small and Medium Enterprises (SMEs). Built with modern cloud-native standards, it replaces chaotic spreadsheets with high-precision accounting, eliminates IEEE-754 floating-point inaccuracies through 64-bit integer minor unit arithmetic, maintains immutable audit trails, and provides real-time visibility into counterparty balances, cash flow, and team operations.

---

## 📑 Table of Contents

- [Core Value Proposition](#core-value-proposition)
- [Key Features](#key-features)
  - [1. Financial Ledger & Zero Floating-Point Drift](#1-financial-ledger--zero-floating-point-drift)
  - [2. Counterparty (Party) Management & Statements](#2-counterparty-party-management--statements)
  - [3. Multi-Tenant Workspaces & RBAC](#3-multi-tenant-workspaces--rbac)
  - [4. Cryptographic Team Invitations & Onboarding](#4-cryptographic-team-invitations--onboarding)
  - [5. Automated Email List Sync](#5-automated-email-list-sync)
  - [6. Immutable Security & Audit Logging](#6-immutable-security--audit-logging)
  - [7. Complete Mobile & Screen Responsiveness](#7-complete-mobile--screen-responsiveness)
- [Tech Stack](#tech-stack)
- [Project Architecture & Directory Structure](#project-architecture--directory-structure)
- [Database Schema & Data Model](#database-schema--data-model)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Clone & Install Dependencies](#1-clone--install-dependencies)
  - [2. Environment Variables](#2-environment-variables)
  - [3. Database Migrations & Client Generation](#3-database-migrations--client-generation)
  - [4. Run Local Development Server](#4-run-local-development-server)
- [Available Scripts](#available-scripts)
- [Engineering Standards & Conventions](#engineering-standards--conventions)
- [License](#license)

---

## Core Value Proposition

Managing finances across fragmented spreadsheets, disconnected billing software, and manual ledgers creates costly reconciliation errors and floating-point rounding drift. **BusinessOS** solves this by providing:

1. **Precision First**: Integer-based minor unit accounting (`amountMinor`, `receivableMinor`, `payableMinor`) guaranteeing exact balance integrity down to the smallest currency unit (paise/cents).
2. **Double-Entry Balance Snapshots**: Every transaction atomically updates snapshot party balances in strict database transactions.
3. **Multi-Tenant Isolation**: Complete organizational separation per business entity, allowing users to own, switch between, and collaborate across multiple businesses seamlessly.
4. **Audit-Ready History**: Reversible entries, immutable logging, user attribution, and zero data loss.

---

## Key Features

### 1. Financial Ledger & Zero Floating-Point Drift
- **Integer Minor Unit Math**: All monetary amounts are processed and stored as 64-bit BigInt minor units (e.g., ₹100.50 is stored as `10050n`), preventing IEEE-754 floating-point inaccuracies.
- **Atomic Balance Updates**: Balance computations happen inside Prisma interactive transactions (`$transaction`), updating cached `PartyBalance` records atomically.
- **Audit-Compliant Reversals**: Transactions cannot be arbitrarily deleted. Instead, an audit-compliant `REVERSAL` transaction is created with reverse-delta accounting.
- **Multi-Type Financial Ledger**: Supports standard double-entry transaction types:
  - `SALE`: Increases customer receivable balance.
  - `PURCHASE`: Increases supplier payable balance.
  - `PAYMENT_RECEIVED`: Decreases receivable balance / records cash inflow.
  - `PAYMENT_MADE`: Decreases payable balance / records cash outflow.
  - `OPENING_BALANCE`: Sets initial balances (`RECEIVABLE` or `PAYABLE`).
  - `ADJUSTMENT`: Reconciles discrepancies with recorded notes.
  - `REVERSAL`: Reverses previously executed transactions with referenced links.
- **Server-Side Pagination & Filtering**: Real-time filtering by counterparty, transaction type, date range (`from` / `to`), and keyword search with customizable page sizes.
- **Enterprise CSV Export**: One-click transaction export incorporating UTF-8 Byte Order Marks (`\uFEFF`) to prevent character distortion across Microsoft Excel, Apple Numbers, Google Sheets, and ERP tools.

### 2. Counterparty (Party) Management & Statements
- **Centralized Directory**: Manage customers, vendors, suppliers, and partners in a single unified interface.
- **Statutory Details**: Capture tax identifiers (GSTIN, PAN), billing addresses, phone numbers, and email contacts.
- **Real-Time Balance Standings**: Instant calculation of net balances:
  - `+₹... To Collect` (Receivable)
  - `-₹... To Pay` (Payable)
  - `Settled (₹0.00)`
- **Dynamic Statement Ledgers**: Per-party transaction statement view showing historical debit/credit entries, running balance calculations, and print-ready statements.

### 3. Multi-Tenant Workspaces & RBAC
- **Workspace Hierarchy**: Users can create, own, or join multiple independent business workspaces.
- **Granular Roles**:
  - `OWNER`: Full administrative, financial, billing, and workspace management privileges.
  - `ADMIN`: Team management, counterparty control, and ledger operations.
  - `ACCOUNTANT`: Read/write access to transactions, parties, and statements without workspace destruction permissions.
- **Fast Workspace Switching**: Instant cookie-backed active workspace selection directly from the top navigation bar without session teardown.

### 4. Cryptographic Team Invitations & Onboarding
- **Cryptographic Token Invites**: Workspace owners and admins can invite team members with assigned roles using secure 7-day tokens.
- **Frictionless Onboarding (`/invite/[token]`)**:
  - **Existing Users**: Join workspace instantly with a single click.
  - **New Users**: Set account password, automatically verify their email address, and immediately enter the workspace dashboard.
- **Invitation Lifecycle Management**: Monitor pending invitations, copy direct shareable invite URLs, or revoke pending invitations in real time.

### 5. Automated Email List Sync
- **Marketing & Outreach Capture**: Automatically registers emails into `EmailList` across:
  - Direct user sign-ups (Email & Password)
  - Social OAuth sign-ups (Google)
  - Team member invitations
  - Marketing landing page newsletter subscriptions

### 6. Immutable Security & Audit Logging
- **Proxy Route Protection (`src/proxy.ts`)**: Session-authenticated proxy layer enforcing workspace context and route authorization.
- **Audit Logs**: Comprehensive event capture logging user ID, business ID, action type, IP address, user-agent, and JSON metadata payloads for compliance and forensic analysis.

### 7. Complete Mobile & Screen Responsiveness
- **Strict Breakpoints**: Dedicated styling and layouts for mobile (`< 640px`), tablet (`640px - 1024px`), and desktop (`> 1024px`).
- **Mobile Navigation Drawer**: Accessible slide-out hamburger navigation containing workspace switchers, navigation links, and profile actions.
- **Horizontal Ledger Wrappers**: All tables and balance ledgers are wrapped in `overflow-x-auto` to preserve layout integrity on small screens.
- **Responsive Form Grids**: Forms and modal dialogs dynamically adapt with stacked mobile controls and multi-column desktop arrangements.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | [Next.js 16.2.6](https://nextjs.org/) | App Router, React Server Components, Turbopack, React 19 |
| **Language** | [TypeScript 5.x](https://www.typescriptlang.org/) | Strict static typing, custom domain models |
| **Database** | PostgreSQL ([Neon](https://neon.tech/)) | Cloud-native serverless relational database |
| **ORM** | [Prisma 7.9.1](https://www.prisma.io/) | Schema management, type-safe queries, migration engine |
| **Authentication** | [Better Auth 1.6.27](https://www.better-auth.com/) | Email/password, OAuth, session cookies, email verification |
| **Email Service** | [Resend](https://resend.com/) | Transactional emails (verification, team invites) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Modern utility-first CSS framework |
| **Validation** | [Zod 4.x](https://zod.dev/) | Runtime request validation & data parsing |

---

## Project Architecture & Directory Structure

```
BusinessOS/
├── prisma/
│   ├── schema.prisma              # Database schema & entity definitions
│   └── migrations/                # Version-controlled SQL migration history
├── src/
│   ├── app/
│   │   ├── (app)/                 # Authenticated workspace application shell
│   │   │   ├── components/        # AppTopBar, AppFooter, navigation drawers
│   │   │   ├── dashboard/         # Financial KPI metrics, cashflow & overview
│   │   │   ├── parties/           # Party directory, balance ledger & statements
│   │   │   ├── transactions/      # Enterprise financial ledger, filters & CSV export
│   │   │   └── settings/          # Workspace settings, team invitations & audit log
│   │   ├── (auth)/                # Sign in, Sign up, Forgot/Reset password flows
│   │   ├── (marketing)/           # Landing page, Terms, Privacy, Cookie policies
│   │   ├── (onboarding)/          # Business creation wizard
│   │   ├── api/                   # REST API routes (auth, businesses, parties, transactions)
│   │   ├── invite/[token]/        # Team member invite acceptance portal
│   │   ├── icon.tsx               # Dynamic favicon & brand icons
│   │   └── layout.tsx             # Root layout & font configurations
│   ├── db/                        # Prisma client instance & connection pool
│   ├── generated/                 # Generated Prisma types & client
│   ├── lib/
│   │   ├── auth.ts                # Better Auth server configuration
│   │   ├── auth-client.ts         # Better Auth client React hooks
│   │   └── email.ts               # Resend transactional email client
│   ├── middleware/                # Route security & middleware layers
│   ├── modules/                   # Domain-Driven Architecture (Services & Repositories)
│   │   ├── audit/                 # Audit logging domain service
│   │   ├── auth/                  # Session verification & workspace resolution
│   │   ├── businesses/            # Business management, members & invitations
│   │   ├── emailList/             # Marketing subscriber list & sync hooks
│   │   ├── parties/               # Party directory & balance snapshot calculations
│   │   └── transactions/          # Ledger engine, minor unit math & reversals
│   ├── proxy.ts                   # Next.js 16 route proxy & authentication guard
│   └── shared/                    # Shared reusable components & utilities
│       ├── components/            # UI components (Logo, Icons, Modal, Buttons)
│       ├── errors/                # Standardized AppError hierarchy
│       └── utils/                 # Currency formatters & UTF-8 BOM CSV exporter
├── AGENTS.md                      # Mandatory AI agent rules & maintenance directives
├── package.json                   # Dependencies & npm scripts
├── tsconfig.json                  # Strict TypeScript configuration
└── README.md                      # Project documentation
```

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
    
    Party ||--o{ Transaction : "incurs"
    Party ||--|| PartyBalance : "has"

    User {
        string id PK
        string name
        string email UK
        boolean emailVerified
        string phone
        boolean isActive
    }

    Business {
        string id PK
        string name
        string legalName
        string gstin
        string pan
        string currency
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
        string phone
        string email
        string gstin
        string pan
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
        string referenceNumber
        string reversedTransactionId
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
```

---

## Getting Started

### Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **PostgreSQL**: PostgreSQL 15+ or a serverless instance from [Neon](https://neon.tech/)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/rauhan-sheikh/BusinessOS.git
cd BusinessOS
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
# Database Connection (PostgreSQL / Neon)
DATABASE_URL="postgresql://user:password@ep-sample-123456.us-east-2.aws.neon.tech/businessos?sslmode=require"

# Better Auth Configuration
BETTER_AUTH_SECRET="your-super-secret-random-32-byte-string"
BETTER_AUTH_URL="http://localhost:3000"

# Resend Email Integration
RESEND_API_KEY="re_your_resend_api_key"
EMAIL_FROM="BusinessOS <no-reply@yourdomain.com>"
RESEND_VERIFICATION_TEMPLATE_ALIAS="email-verification"

# Social Authentication (Optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

### 3. Database Migrations & Client Generation

Execute migrations and generate the Prisma Client:

```bash
# Run pending migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

> **Development Note**: When introducing schema changes locally, always generate named migrations with `npx prisma migrate dev --name <change_name>`. Never use `prisma db push` in production branches.

### 4. Run Local Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Starts the Next.js development server with Turbopack |
| `npm run build` | Generates Prisma client, runs migrations, and builds production bundles |
| `npm run start` | Runs the production-optimized Next.js server |
| `npm run lint` | Executes ESLint analysis |
| `npx tsc --noEmit` | Runs full static TypeScript type checks |
| `npx prisma studio` | Launches Prisma Studio GUI for exploring database records |
| `npx prisma migrate dev` | Creates and applies a new migration in development |

---

## Engineering Standards & Conventions

1. **Currency & Minor Units**:
   - Always store currency amounts in minor units (`BigInt` / `amountMinor`).
   - Use `toMinorUnits()` and `toMajorUnits()` from `@/shared/utils/currency` for transformations.
   - Format for display using `formatCurrency(minorAmount, "INR")`.
2. **Double-Entry & Immutability**:
   - Financial ledger entries must never be mutated or hard-deleted.
   - Use reversal transactions (`REVERSAL`) to nullify prior entries with full audit trail links.
3. **Mobile & Viewport Responsiveness**:
   - Every page, component, table, and modal must function seamlessly across mobile (< 640px), tablet (640px - 1024px), and desktop (> 1024px).
   - Tables must be wrapped with `overflow-x-auto`.
   - Modals and toolbars must stack cleanly on smaller viewports.
4. **Documentation Maintenance**:
   - Whenever any worthwhile architectural, schema, or functional changes are made to the codebase, **always update `README.md`** to keep documentation synchronized.

---

## License

This project is licensed under the [MIT License](LICENSE).
