# BusinessOS — Project Architecture & Engineering Document

**Project:** BusinessOS  
**Repository:** `rauhan-sheikh/BusinessOS`  
**Domain:** `businessos.rauhansheikh.com`  
**Stack:** Next.js + TypeScript + Better Auth + Prisma + PostgreSQL  
**Deployment:** Vercel  
**Production Database:** Neon PostgreSQL  
**Local Database:** PostgreSQL  
**Current Stage:** Early development / foundation

---

# 1. Project Overview

BusinessOS is intended to become a **complete, multi-tenant business management platform for SMEs**.

The name is intentional: this should eventually be more than a simple accounting/ledger application. The long-term goal is a Business Operating System where a business can manage its core day-to-day operations from one platform.

The project is being built progressively rather than trying to implement the entire product at once.

The immediate goal is to establish a **production-quality technical foundation** and then build business functionality on top of it.

The project has two simultaneous purposes:

1. Build something that can eventually become a real product.
2. Use the project as serious proof of engineering ability and learn production software architecture by actually implementing it.

Therefore, decisions should favor **real-world engineering practices**, while avoiding unnecessary enterprise complexity that doesn't provide value at the current stage.

---

# 2. Product Vision

The eventual BusinessOS platform should provide businesses with a unified system for:

- Business/account management
- Users and team members
- Roles and permissions
- Customers
- Vendors
- Digital ledger
- Receivables
- Payables
- Transactions
- Invoices
- Payments
- Business reporting
- Audit history
- Potentially additional operational modules as the product evolves

The current focus is intentionally narrower.

We are establishing:

```text
Foundation
    ↓
Authentication
    ↓
Multi-tenancy
    ↓
Authorization
    ↓
Business
    ↓
Parties
    ↓
Ledger / Transactions
    ↓
Invoices / Payments
    ↓
Additional BusinessOS modules
```

The project should continue moving forward rather than becoming trapped in endless architecture planning.

Architecture decisions should therefore be made with the question:

> "Will this help us build the product correctly as it grows?"

rather than:

> "How can we make a three-person application look like a 500-person enterprise?"

---

# 3. Core Architectural Principles

## 3.1 Production-minded, not over-engineered

BusinessOS should be built using patterns that would remain reasonable in a real production SaaS product.

However, we should not introduce technologies simply because large companies use them.

For example:

- PostgreSQL: yes
- Prisma: yes
- Proper migrations: yes
- Server-side authentication: yes
- Audit logging: yes
- Multi-tenancy: yes
- Redis immediately for everything: no
- Microservices immediately: no
- Kubernetes merely for résumé value: no
- Redux merely because "enterprise apps use Redux": no

The architecture should evolve when the product actually requires it.

---

# 4. Technology Stack

## Frontend / Application

- Next.js 16
- React 19
- TypeScript
- Next.js App Router
- Tailwind CSS
- Next.js Turbopack during development

## Backend

The backend is implemented inside the Next.js application using:

- Route Handlers
- Service layer where business logic warrants it
- Repository layer for database access
- Zod for validation
- Better Auth for authentication

## Database

- PostgreSQL
- Prisma ORM
- Prisma PostgreSQL adapter
- Neon PostgreSQL for production
- Local PostgreSQL for development

## Authentication

- Better Auth

Better Auth was deliberately selected over NextAuth because it provides the authentication capabilities needed by BusinessOS while fitting the desired architecture well.

## Password hashing

Password hashing is handled by Better Auth.

The previous custom Argon2 registration implementation has been removed.

## Email

- Resend
- Resend Templates
- Verified sending domain under `mail.businessos.rauhansheikh.com`

## Deployment

- Vercel
- Neon PostgreSQL
- Prisma migrations deployed during Vercel build

---

# 5. Repository Structure

Current application structure:

```text
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...all]/
│   │   │       └── route.ts
│   │   └── emailList/
│   │       └── route.ts
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
│
├── audit/
│
├── db/
│   └── index.ts
│
├── generated/
│   └── prisma/
│
├── lib/
│   ├── auth.ts
│   └── email.ts
│
├── middleware/
│
├── modules/
│   ├── auth/
│   ├── businesses/
│   ├── emailList/
│   ├── parties/
│   └── transactions/
│
└── shared/
    └── errors/
        ├── app-error.ts
        └── conflict-error.ts
```

The domain modules follow a structure like:

```text
modules/
└── businesses/
    ├── repositories/
    ├── schemas/
    └── services/
```

The same pattern exists for:

- businesses
- parties
- transactions
- emailList

The old custom authentication service/repository/schema implementation has been removed because Better Auth now owns authentication.

---

# 6. Application Architecture

BusinessOS uses a modular layered architecture.

A typical business feature should conceptually flow as:

```text
HTTP Request
     ↓
Route Handler
     ↓
Validation
     ↓
Service
     ↓
Repository
     ↓
Prisma
     ↓
PostgreSQL
```

The layers have distinct responsibilities.

## Route Handler

Responsible for:

- HTTP concerns
- Reading request data
- Calling application logic
- Returning HTTP responses
- Translating known errors into appropriate HTTP responses

It should not contain substantial business logic.

## Schema

Responsible for:

- Input validation
- Type inference
- Input constraints

Zod is the validation mechanism.

## Service

Responsible for:

- Business rules
- Orchestration
- Transactions where appropriate
- Calling repositories

## Repository

Responsible for:

- Database operations
- Prisma queries
- Data persistence

This keeps database implementation details away from routes.

---

# 7. Database Architecture

The primary database is PostgreSQL.

Prisma is used as the ORM.

The Prisma schema is located at:

```text
prisma/schema.prisma
```

The Prisma client is generated into:

```text
src/generated/prisma/
```

The application database client is:

```text
src/db/index.ts
```

It uses:

```text
PrismaPg
    ↓
pg Pool
    ↓
PostgreSQL
```

The application uses a singleton Prisma client pattern during development to avoid creating excessive connections during Next.js hot reloads.

---

# 8. Current Database Model

The current domain consists of:

```text
User
Business
BusinessUser
Party
PartyBalance
Transaction
AuditLog
EmailList
```

Better Auth additionally introduced:

```text
Session
Account
Verification
```

---

# 9. User Model

The user represents an individual person using BusinessOS.

The current intended model contains:

```text
User
├── id
├── name
├── email
├── emailVerified
├── image
├── phone
├── isActive
├── lastLogin
├── createdAt
├── updatedAt
│
├── businesses
├── auditLogs
├── transactions
├── sessions
└── accounts
```

Authentication-specific credentials are managed through Better Auth's `Account` model rather than the old custom `passwordHash` approach.

The user is therefore separated conceptually from the authentication mechanism.

---

# 10. Multi-Tenancy

BusinessOS is designed as a **multi-tenant SaaS application**.

The tenant is represented by:

```text
Business
```

A user can belong to multiple businesses.

This relationship is represented by:

```text
User
  │
  │
BusinessUser
  │
  │
Business
```

`BusinessUser` is therefore a membership table.

It contains:

- business
- user
- role
- joined date

This allows one person to participate in multiple businesses.

Example:

```text
Rauhan
 ├── Business A → OWNER
 ├── Business B → ADMIN
 └── Business C → ACCOUNTANT
```

This is an important architectural decision because authorization belongs to the **user's membership within a business**, not simply to the global user.

---

# 11. Roles

Current basic roles:

```text
OWNER
ADMIN
ACCOUNTANT
```

These are represented by the `BusinessRole` enum.

The role system is deliberately simple at the beginning.

However, BusinessOS is expected to eventually support **custom permissions**.

---

# 12. Future Permission System

The intended future authorization system is more granular than simply:

```text
OWNER
ADMIN
ACCOUNTANT
```

The eventual system should allow a business owner/super-admin to configure permissions through a UI resembling a permission matrix.

Conceptually:

```text
                    Owner   Admin   Accountant
View Customers        ✓       ✓          ✓
Create Customer       ✓       ✓          ✓
Delete Customer       ✓       ✗          ✗
Create Invoice        ✓       ✓          ✓
Delete Invoice        ✓       ✗          ✗
Manage Users          ✓       ✓          ✗
Manage Settings       ✓       ✗          ✗
```

This should eventually become a proper permission model rather than hardcoding every authorization decision against role names.

The architecture must therefore avoid making today's three roles impossible to evolve later.

---

# 13. Business Model

`Business` represents a tenant/company.

It currently contains:

- name
- legal name
- GSTIN
- PAN
- phone
- email
- address
- currency
- timezone
- timestamps

The default currency is:

```text
INR
```

The default timezone is:

```text
Asia/Kolkata
```

This makes the current implementation suitable for the initial India-focused use case while retaining the ability to expand later.

---

# 14. Parties

A `Party` represents an entity the business transacts with.

This can cover:

- customers
- vendors
- other counterparties

Current fields include:

- name
- phone
- email
- address
- GSTIN
- PAN
- notes
- archived state

Every party belongs to a business.

Therefore tenant isolation must always be respected.

A query for parties should conceptually never simply mean:

```text
give me all parties
```

It should mean:

```text
give me parties belonging to the currently selected business
```

---

# 15. Ledger Design

The ledger is one of the core architectural concepts of BusinessOS.

Transactions are stored as immutable-ish financial events rather than simply modifying a balance.

The `Transaction` model contains:

- business
- party
- transaction type
- amount
- opening balance type
- notes
- reference number
- reversal reference
- created by
- creation timestamp

Transaction types currently include:

```text
SALE
PURCHASE
PAYMENT_RECEIEVED
PAYMENT_MADE
OPENING_BALANCE
ADJUSTMENT
REVERSAL
```

There is currently a typo in:

```text
PAYMENT_RECEIEVED
```

which should eventually be corrected carefully through a proper migration rather than casually changing production data.

---

# 16. Money Representation

Financial amounts use:

```text
BIGINT
```

and are stored in minor units.

For example:

```text
₹1,250.50
```

would conceptually be represented as:

```text
125050
```

rather than a floating-point value.

This avoids floating-point precision problems.

This is an intentional accounting-system design decision.

---

# 17. Snapshot Balance Pattern

BusinessOS also has:

```text
PartyBalance
```

This stores calculated/current balances for fast access.

It contains:

```text
receivableMinor
payableMinor
```

The intended architecture is:

```text
Transactions = source of financial truth

PartyBalance = current snapshot for fast reads
```

When a transaction changes a party's balance, both the transaction and balance update should occur atomically using a database transaction.

Conceptually:

```text
BEGIN TRANSACTION

Create ledger transaction
        +
Update PartyBalance

COMMIT
```

If either operation fails, both should roll back.

Prisma's:

```ts
prisma.$transaction()
```

will be used for these atomic operations.

---

# 18. Audit Logging

BusinessOS includes an `AuditLog` model.

Audit logs contain:

- business
- user
- action type
- metadata
- IP address
- user agent
- timestamp

The purpose is to establish accountability for important business actions.

Eventually important actions such as:

```text
Created invoice
Deleted party
Changed user role
Changed permission
Recorded payment
Reversed transaction
Changed business settings
```

should produce audit events.

Audit logging should not be added indiscriminately to every trivial read operation.

---

# 19. Authentication Architecture

BusinessOS uses **Better Auth**.

The current Better Auth configuration lives at:

```text
src/lib/auth.ts
```

The Better Auth catch-all route is:

```text
src/app/api/auth/[...all]/route.ts
```

The architecture uses:

```text
Better Auth
    ↓
Prisma Adapter
    ↓
PostgreSQL
```

The Better Auth tables currently include:

```text
user
session
account
verification
```

---

# 20. Authentication Methods

The intended authentication system supports two signup/login paths.

## Email + Password

The user can register using:

- Full name
- Email
- Password
- Other necessary onboarding information

The email must be verified before the user is allowed to proceed.

Better Auth handles:

- Password credential storage
- Password verification
- Sessions
- Verification records
- Verification links
- Authentication state

## Google

Users should also be able to:

```text
Continue with Google
```

Google authenticates the user and provides the identity information required by BusinessOS.

Better Auth will manage the provider account relationship.

Google OAuth accounts are represented through the `Account` table.

Email verification for Google users is handled according to the provider's verified identity information and Better Auth's OAuth behavior rather than sending a redundant password-style verification flow.

---

# 21. Sessions

BusinessOS uses **database-backed Better Auth sessions**.

The `Session` table contains:

```text
id
expiresAt
token
createdAt
updatedAt
ipAddress
userAgent
userId
```

This means sessions are not simply stored as a large amount of authentication state in the browser.

The browser receives the authentication cookie/token necessary to identify the session, while the actual session record exists server-side.

This provides important capabilities.

## Session expiration

Every session has:

```text
expiresAt
```

so sessions can expire.

## Revocation

A session can be invalidated by removing/revoking the corresponding session record.

This makes functionality such as:

```text
Log out
Log out all devices
Revoke a suspicious session
```

possible.

## Session inspection

Because sessions are persisted, BusinessOS can eventually support:

```text
Active sessions
Chrome — Windows
Last active: ...
IP: ...
```

and allow a user to revoke individual sessions.

---

# 22. Why PostgreSQL Sessions Instead of Redis

Redis was considered as a possible session store.

The decision for the current stage is to use Better Auth's PostgreSQL-backed sessions.

Reasons:

- PostgreSQL already exists
- Better Auth supports it directly
- Sessions are persistent data
- Revocation is straightforward
- No second infrastructure dependency is required
- The current application does not have a scale problem requiring Redis

Redis can be introduced later if actual workload characteristics justify it.

It should not be added purely to make the architecture appear more "enterprise."

---

# 23. Authentication State in the Frontend

Redux is **not currently required simply to store the authenticated user**.

Authentication state should primarily come from Better Auth's session mechanism.

The frontend should not treat Redux as a replacement for server-side authentication.

The general principle is:

```text
Authentication truth
        ↓
Better Auth session

UI convenience state
        ↓
React / Better Auth client state

Complex global application state
        ↓
Only introduce a dedicated state manager if the application actually requires it
```

The user/business context may eventually need efficient client-side access, but we should avoid duplicating server truth unnecessarily.

---

# 24. Email Verification

Email verification is implemented using:

```text
Better Auth
+
Resend
```

Better Auth generates the verification URL.

Resend sends the email.

The current flow is:

```text
User registers
      ↓
Better Auth creates user
      ↓
Verification record created
      ↓
Better Auth generates verification URL
      ↓
sendVerificationEmail()
      ↓
Resend
      ↓
Verification template
      ↓
User clicks link
      ↓
Better Auth verifies token
      ↓
emailVerified = true
```

The verification expiry is currently:

```text
1 hour
```

---

# 25. Resend Configuration

A free Resend account is being used.

The verified sending domain is:

```text
mail.businessos.rauhansheikh.com
```

DNS records were added through Cloudflare.

The Zoho MX configuration for the primary domain was deliberately left untouched.

This is important because the user's existing domain email continues to operate through Zoho.

The intended sending address is under the verified Resend domain, for example:

```text
BusinessOS <noreply@mail.businessos.rauhansheikh.com>
```

The verification email therefore does not need to come from:

```text
noreply@rauhansheikh.com
```

and should not pretend that the unverified domain is the Resend sending domain.

---

# 26. Resend Templates

The verification email presentation should live in **Resend Templates**, not inside `auth.ts`.

Current template:

```text
Alias: email-verification
```

The template owns the presentation layer:

- Subject
- HTML
- Reply-to
- Email design
- Template variables

BusinessOS supplies dynamic information such as:

```text
user name
verification URL
```

This produces the desired separation:

```text
BusinessOS
    │
    │ dynamic data
    ▼
Resend API
    │
    ▼
email-verification template
    │
    ▼
User
```

The HTML should not be embedded as a large string inside authentication code.

---

# 27. Email Service

The project has:

```text
src/lib/email.ts
```

This is intended to act as the application's Resend integration boundary.

The rest of the application should not need to know unnecessary Resend implementation details.

The desired abstraction is conceptually:

```text
sendTemplateEmail(...)
```

rather than:

```text
send arbitrary HTML email
```

This keeps transactional email presentation in Resend.

---

# 28. Current Verification Testing

The authentication system has already been tested through Postman.

The following has been verified:

- User registration works
- Verification email is actually received
- Verification link works
- Verified user can sign in
- Unverified user is blocked
- Better Auth returns the expected authentication response for a verified login
- Session records are created
- Credential accounts are created
- Resend delivery works

An observed Better Auth response for an attempted unverified flow was:

```text
MISSING_OR_NULL_ORIGIN
```

with:

```text
Missing or null Origin
```

This was determined to be an origin/request issue in the Postman testing context rather than evidence that the verification system itself was broken.

---

# 29. Current Authentication Configuration

The core configuration currently resembles:

```ts
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  baseURL: process.env.BETTER_AUTH_URL,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  emailVerification: {
    sendOnSignUp: true,

    sendVerificationEmail: async ({ user, url }) => {
      // Send through Resend template

    },

    expiresIn: 60 * 60,
  },
});
```

Google OAuth is intended to be added as part of the authentication UI/integration.

---

# 30. Prisma Migration Strategy

Prisma migrations are treated as real deployment artifacts.

The project has already experienced an important real-world migration situation.

Initially the database contained an old `User` table with three disposable development users.

Better Auth required a different user/account/session schema.

Prisma generated a migration that warned:

```text
You are about to drop the User table, which is not empty.
```

The users were disposable, so the migration was allowed to proceed.

This was intentionally used as a learning exercise for understanding what happens when an existing production schema conflicts with a new schema.

---

# 31. Important Production Migration Principle

The development migration was safe because the users were disposable.

That is **not** the approach for real production data.

If a production migration says:

```text
DROP TABLE User
```

and the table contains real customers, the correct response is generally **not**:

```text
yes
```

Instead, the schema should be migrated using a safe transition.

For example:

```text
Old column
    ↓
Add new column
    ↓
Backfill data
    ↓
Deploy application supporting both
    ↓
Verify data
    ↓
Remove old column later
```

Destructive migrations require special handling when real data exists.

The fact that the current database has no meaningful production users makes destructive migration acceptable during this early stage.

---

# 32. Migration History

Current migrations include:

```text
20260604120419_init_schema
20260808111415_add_email_list
```

and the Better Auth migration:

```text
add_better_auth
```

was generated and applied during the authentication transition.

The local migration status was confirmed as:

```text
Database schema is up to date!
```

The production database should always be managed through committed Prisma migrations rather than manually modifying the schema.

---

# 33. Prisma Configuration

The Prisma configuration is:

```text
prisma.config.ts
```

It uses:

```text
prisma/schema.prisma
```

for the schema and:

```text
prisma/migrations
```

for migrations.

The migration database connection can be separated through:

```text
MIGRATION_DATABASE_URL
```

falling back to:

```text
DATABASE_URL
```

This provides a path toward more controlled deployment workflows.

---

# 34. Deployment

The application is already deployed to:

```text
Vercel
```

The database is hosted on:

```text
Neon PostgreSQL
```

The current build script is:

```json
{
  "build": "prisma generate && prisma migrate deploy && next build"
}
```

This means a Vercel deployment performs:

```text
Install dependencies
      ↓
Prisma generate
      ↓
Prisma migrate deploy
      ↓
Next.js build
      ↓
Deployment
```

This is fundamentally different from:

```text
prisma migrate dev
```

`migrate dev` is a development workflow.

`migrate deploy` is the appropriate mechanism for applying already-created migrations in a deployment environment.

---

# 35. CI/CD Philosophy

The application is already connected to a real deployment pipeline.

Therefore changes should be treated as real deployments even during early development.

The preferred workflow is:

```text
Local development
      ↓
Test locally
      ↓
Create migration if schema changed
      ↓
Review migration
      ↓
Commit migration
      ↓
Push to GitHub
      ↓
Vercel deployment
      ↓
prisma migrate deploy
      ↓
Production build
```

The migration file itself should be committed to Git.

Generated migration files are not disposable artifacts.

---

# 36. Environment Variables

Sensitive credentials must never be committed.

Relevant environment configuration includes things such as:

```text
DATABASE_URL
MIGRATION_DATABASE_URL
BETTER_AUTH_URL
BETTER_AUTH_SECRET
RESEND_API_KEY
EMAIL_FROM
```

Potential Resend template configuration may include:

```text
RESEND_VERIFICATION_TEMPLATE_ALIAS
```

The actual secret values must remain outside Git.

Vercel production environment variables must be configured separately from local `.env`.

---

# 37. Error Handling

The application uses custom application errors.

Current shared errors include:

```text
AppError
ConflictError
```

The general philosophy is:

```text
Expected application error
        ↓
Known AppError
        ↓
Appropriate HTTP response

Unexpected error
        ↓
Log server-side
        ↓
Generic 500 response
```

Internal implementation details should not be exposed to clients.

---

# 38. Validation

Zod is used for request validation.

The old registration flow demonstrated the intended pattern:

```text
Request
   ↓
Zod schema
   ↓
Validated input
   ↓
Service
```

With Better Auth owning registration, login, password authentication, verification, etc., validation for authentication-specific operations should generally follow Better Auth's API rather than rebuilding those operations independently.

Zod remains important for BusinessOS-specific domain endpoints.

---

# 39. Business Logic Boundaries

The application should avoid putting business logic directly into React components or route handlers.

For example, creating a transaction should eventually look conceptually like:

```text
POST /api/transactions
        ↓
validate request
        ↓
transaction service
        ↓
verify authenticated user
        ↓
verify business membership
        ↓
verify permissions
        ↓
create transaction
        ↓
update PartyBalance
        ↓
create audit log
        ↓
commit atomically
```

This is much more important than simply having a large number of files.

The architecture exists to enforce these boundaries.

---

# 40. Tenant Isolation

Multi-tenancy is a critical security requirement.

Every business-owned resource must be scoped to a business.

For example:

```text
Party
Transaction
PartyBalance
AuditLog
```

all contain a `businessId` directly or indirectly.

An authenticated user existing in the system is **not enough** to access a business resource.

The authorization process must eventually be:

```text
Authenticated user
       ↓
Selected business
       ↓
Business membership
       ↓
Role / permission
       ↓
Resource access
```

This should become a central security principle throughout the application.

---

# 41. Business Context

A user may belong to multiple businesses.

Therefore the application will eventually need a concept of the **currently selected business/tenant**.

For example:

```text
User
 ├── ABC Traders
 ├── XYZ Enterprises
 └── Personal Business
```

The UI should allow the user to select the active business.

The backend must never blindly trust a client-provided business ID.

The backend should verify that the authenticated user actually belongs to that business and has the required permission.

---

# 42. State Management Philosophy

Redux is not automatically required.

The application should distinguish:

### Server state

Examples:

- user
- businesses
- parties
- transactions
- balances

These belong to the server/database and should not be duplicated unnecessarily in a client-side global store.

### UI state

Examples:

- modal open/closed
- sidebar state
- selected tab
- filters

These can normally remain local React state.

### Session state

Authentication is owned by Better Auth.

### Complex shared client state

A dedicated state management solution can be introduced only when there is an actual problem that requires it.

The goal is to avoid Redux becoming a dumping ground for server data.

---

# 43. Current Product Modules

The planned module structure currently includes:

```text
Auth
Businesses
Email List
Parties
Transactions
```

Future modules can be added without changing the fundamental architecture.

Potential future areas include:

```text
Invoices
Payments
Expenses
Reports
Inventory
Purchasing
Employees
Documents
Notifications
Settings
Integrations
```

These are product possibilities, not immediate implementation requirements.

---

# 44. Current Development Philosophy

BusinessOS is being built progressively.

The correct sequence is not:

```text
Plan for 6 months
↓
Build everything
↓
Launch
```

Instead:

```text
Design enough architecture
↓
Build
↓
Test
↓
Deploy
↓
Learn
↓
Improve
↓
Continue
```

The project should maintain enough architectural foresight to avoid dead ends while continuing to produce working software.

---

# 45. What Has Already Been Built

The project has already established:

- Next.js application
- TypeScript
- PostgreSQL
- Prisma
- Prisma migrations
- Local development database
- Neon production database
- Vercel deployment
- Basic project/module architecture
- Business domain schema
- Party domain schema
- Transaction domain schema
- Party balance architecture
- Audit log architecture
- Email list functionality
- Better Auth integration
- Prisma adapter for Better Auth
- Database-backed sessions
- Email/password authentication
- Required email verification
- Verification expiry
- Resend integration
- Verified Resend sending domain
- Verification email delivery
- Verification link flow
- Production-aware migration workflow

---

# 46. What Has Been Removed

The original custom registration implementation has been removed.

Previously BusinessOS had:

```text
register route
    ↓
auth service
    ↓
auth repository
    ↓
Prisma
```

with custom:

- Zod registration schema
- Argon2 password hashing
- email conflict checking
- username conflict checking
- user creation

That implementation was intentionally removed after adopting Better Auth.

Argon2 was also removed because Better Auth now owns password authentication.

The application should not maintain two competing authentication systems.

---

# 47. Why Better Auth Owns Authentication

The principle is:

> BusinessOS owns business identity and business rules; Better Auth owns authentication mechanics.

Better Auth handles:

- registration
- password authentication
- OAuth
- sessions
- verification
- accounts
- credentials
- authentication cookies/tokens

BusinessOS handles:

- business membership
- roles
- permissions
- tenant access
- business onboarding
- business-specific authorization
- audit logging
- domain operations

This keeps the authentication boundary clean.

---

# 48. Current Immediate Next Steps

The authentication backend foundation is essentially established.

The next implementation phase should be the **authentication UI**.

That should include:

```text
Register
Login
Continue with Google
Email verification state
Verification success/failure
Forgot password
Reset password
Logout
Authenticated application shell
```

The UI should consume Better Auth rather than recreating authentication APIs unnecessarily.

---

# 49. Authentication UI Flow

The desired user journey is:

```text
                    ┌───────────────┐
                    │   BusinessOS  │
                    │     Login     │
                    └───────┬───────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
       Email + Password             Google OAuth
              │                           │
              ▼                           ▼
       Better Auth                  Google
              │                           │
              └─────────────┬─────────────┘
                            ▼
                    Authenticated User
                            │
                            ▼
                    Business Selection
                            │
                            ▼
                    Business Dashboard
```

For email/password registration:

```text
Register
   ↓
Create account
   ↓
Verification email
   ↓
Verify email
   ↓
Login / continue
   ↓
Business onboarding
```

---

# 50. Business Onboarding

After authentication, the next important product concept is onboarding.

A newly registered user will eventually need to:

```text
Create Business
       ↓
Become OWNER
       ↓
Configure basic business information
       ↓
Enter BusinessOS
```

The first business created by a user should establish their membership as:

```text
OWNER
```

This is preferable to treating the global user record itself as the owner of everything.

---

# 51. Authorization Roadmap

Authorization should evolve in stages.

### Stage 1

Basic role checks:

```text
OWNER
ADMIN
ACCOUNTANT
```

### Stage 2

Centralized permission definitions.

Example:

```text
PARTY_VIEW
PARTY_CREATE
PARTY_UPDATE
PARTY_DELETE

TRANSACTION_VIEW
TRANSACTION_CREATE
TRANSACTION_REVERSE

USER_VIEW
USER_INVITE
USER_REMOVE

BUSINESS_SETTINGS_VIEW
BUSINESS_SETTINGS_UPDATE
```

### Stage 3

Business-configurable role/permission matrix.

### Stage 4

Potentially custom roles.

The data model should be designed so Stage 1 does not prevent Stages 2–4.

---

# 52. Security Priorities

Security is particularly important because BusinessOS will eventually handle business financial information.

Important principles:

- Never trust client-provided business IDs
- Always verify authentication server-side
- Always verify business membership
- Enforce permissions server-side
- Never expose secrets to the client
- Never store plaintext passwords
- Use Better Auth for authentication
- Use HTTPS in production
- Use secure cookies
- Validate external input
- Use parameterized/ORM database operations
- Audit sensitive business actions
- Avoid exposing internal errors
- Treat financial transactions as immutable events where possible
- Use database transactions for financially coupled operations

---

# 53. Financial Data Principles

BusinessOS is not simply a CRUD application.

Financial data requires stronger invariants.

Important principles:

### Never use floating point for money

Use integer minor units.

### Don't silently overwrite financial history

Prefer reversal/correction events.

### Maintain transaction history

The ledger is the source of truth.

### Keep balances consistent

Update snapshots atomically.

### Audit important actions

Financial actions should be attributable to users.

### Tenant isolation is mandatory

A transaction must always belong to the correct business.

---

# 54. What "Industry Grade" Means for BusinessOS

The objective is not to collect technologies.

"Industry grade" means:

```text
Correctness
+
Security
+
Maintainability
+
Observability
+
Data integrity
+
Clear boundaries
+
Reliable deployments
+
Good developer experience
+
Scalability where justified
```

It does not mean:

```text
Microservices
+
Kubernetes
+
Redis
+
Kafka
+
GraphQL
+
Redux
+
20 monitoring tools
```

unless the product eventually has a genuine reason to need them.

---

# 55. Current Deployment Maturity

BusinessOS is already a real deployed application.

Therefore development should increasingly follow production practices:

```text
Local
   ↓
Development testing
   ↓
Migration review
   ↓
Git commit
   ↓
GitHub
   ↓
Vercel
   ↓
Neon
```

The fact that the product is early does not mean production safety can be ignored.

At the same time, because there are currently no meaningful production users, this is an excellent period to make foundational schema and architecture changes that would become significantly harder later.

---

# 56. Current Known Technical Debt / Things to Clean Up

Known items include:

- Complete the Resend template-based email implementation
- Complete Google OAuth configuration
- Build authentication UI
- Establish frontend session handling
- Establish business onboarding
- Establish active business context
- Implement basic authorization
- Eventually introduce granular permissions
- Review naming inconsistencies such as `created_at` vs `createdAt`
- Correct domain enum typo `PAYMENT_RECEIEVED` through a proper migration when appropriate
- Continue improving centralized error handling
- Establish testing strategy
- Establish production observability as the application grows

These should be handled progressively rather than all at once.

---

# 57. Naming Conventions

The project should converge toward consistent naming.

Preferred TypeScript/Prisma style:

```text
camelCase
```

Examples:

```text
createdAt
updatedAt
lastLogin
businessId
userId
```

Database/schema naming should not be changed casually once production data becomes meaningful.

Naming corrections should be handled through migrations.

---

# 58. Testing Strategy

Testing should progressively cover:

### Authentication

- Registration
- Login
- Invalid password
- Email verification
- Expired verification
- Google login
- Logout
- Session expiry
- Session revocation

### Authorization

- User without membership
- User with correct membership
- User with insufficient role
- User with insufficient permission
- Cross-tenant access attempts

### Financial operations

- Transaction creation
- Balance calculation
- Atomic transaction failure
- Reversal
- Opening balance
- Cross-business isolation

### API

- Validation errors
- Conflict errors
- Unauthorized requests
- Forbidden requests
- Not-found cases
- Unexpected failures

The project should eventually introduce automated tests rather than relying exclusively on Postman/manual verification.

---

# 59. Observability Roadmap

As the application grows, observability should cover:

- Application errors
- Authentication failures
- Important business operations
- Database errors
- Deployment failures
- Background jobs if introduced
- Performance problems

Audit logs and application logs serve different purposes.

```text
Audit log
    = business accountability

Application log
    = engineering/debugging
```

They should not be treated as the same system.

---

# 60. Future Infrastructure

Infrastructure should evolve based on actual needs.

Potential future additions:

```text
Redis
Background job queue
Object storage
Search
Caching
Rate limiting infrastructure
Analytics
Monitoring
```

None should be introduced prematurely.

For example, Redis could eventually be useful for:

- caching
- rate limiting
- distributed locks
- queues
- high-volume ephemeral state

But the current PostgreSQL-backed session implementation is sufficient.

---

# 61. Git and Change Management

The repository is hosted on GitHub.

Important principles:

- Commit meaningful changes
- Keep migrations in Git
- Don't commit secrets
- Don't commit generated environment files
- Review destructive migrations
- Don't rewrite migration history after it has reached production
- Prefer small, logically complete commits

Because the repository is also intended to serve as proof of work, the Git history should reflect genuine engineering progression.

---

# 62. Development Workflow

The preferred working loop is:

```text
Understand
   ↓
Design the smallest correct change
   ↓
Implement
   ↓
Run locally
   ↓
Test behavior
   ↓
Inspect database/migration if applicable
   ↓
Commit
   ↓
Push
   ↓
Verify deployment
```

The goal is not to plan the entire system before writing code.

---

# 63. Current State Summary

At the current point in development:

```text
                    BusinessOS
                        │
                        ▼
                 Next.js Application
                        │
          ┌─────────────┴─────────────┐
          │                           │
      Better Auth                 Business Modules
          │                           │
    ┌─────┼─────┐              ┌─────┼─────┐
    │     │     │              │     │     │
 Password Google Sessions    Business Party Transaction
    │     │     │
    └─────┴─────┘
          │
       Prisma
          │
     PostgreSQL
          │
       Neon
```

Email:

```text
Better Auth
     ↓
Email Service
     ↓
Resend
     ↓
email-verification template
     ↓
User
```

Deployment:

```text
GitHub
   ↓
Vercel
   ↓
prisma migrate deploy
   ↓
Neon PostgreSQL
```

---

# 64. Immediate Build Direction

The project should now move from authentication infrastructure into the **user-facing authentication experience**.

The immediate sequence should be:

```text
1. Finish Resend template integration
2. Add Google OAuth
3. Build registration UI
4. Build login UI
5. Build verification UI
6. Build logout
7. Build authenticated layout
8. Build session-aware frontend
9. Build business onboarding
10. Create Business + OWNER membership
11. Establish active business context
12. Implement authorization foundation
13. Begin BusinessOS business functionality
```

We should not jump prematurely into invoices, reports, inventory, or other large modules before the multi-tenant/security foundation is solid.

---

# 65. Guiding Principle for the Entire Project

BusinessOS should always be built with the following mental model:

> **Build today's functionality correctly while preserving a clean path to tomorrow's product.**

We don't need to build the entire future today.

But we also shouldn't make decisions today that knowingly create architectural dead ends.

The project should therefore remain:

```text
Simple enough to move quickly
+
Structured enough to scale
+
Secure enough to trust
+
Clean enough to demonstrate professionally
+
Real enough to eventually become a product
```

That is the engineering direction for BusinessOS.