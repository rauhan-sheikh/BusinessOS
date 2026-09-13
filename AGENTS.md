<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# CRITICAL MANDATORY REQUIREMENT: Complete Mobile & Screen Responsiveness

Every screen, page, modal, table, navigation bar, header, and footer in this project MUST be fully responsive across all screen sizes (mobile < 640px, tablet 640px-1024px, and desktop > 1024px).

### Mandatory Rules for Every Component:
1. **Header & Navigation**: Small screen viewports MUST ALWAYS have accessible mobile navigation (e.g. mobile drawer, hamburger menu) containing all links, workspace context, and user controls. Never hide navigation on mobile without a mobile drawer/menu toggle.
2. **Tables & Ledgers**: All tables must be wrapped in `overflow-x-auto` containers and styled so data remains legible and easily scrollable on narrow screens without breaking parent layout width.
3. **Forms & Modals**: Modals and form grids must use responsive flex/grid layouts (e.g. `grid-cols-1 sm:grid-cols-2`, full width on mobile, proper padding `p-4 sm:p-6`) and prevent horizontal viewport overflow.
4. **Toolbars & Filters**: Filter bars and action buttons must wrap cleanly (`flex-col sm:flex-row`, `w-full sm:w-auto`).

# CRITICAL MANDATORY REQUIREMENT: Documentation Synchronization

Whenever any worthwhile changes, new features, schema updates, API routes, or architectural adjustments are made to the codebase, ALWAYS update **both** of these in the same change, and keep them accurate:

1. [`README.md`](file:///c:/Users/Admin/Desktop/Engineering/Projects/BusinessOS/README.md) — the engineering reference: architecture, data model, API, deployment, testing, and known limitations.
2. [`USER_GUIDE.md`](file:///c:/Users/Admin/Desktop/Engineering/Projects/BusinessOS/USER_GUIDE.md) — the task-oriented guide for the person *using* BusinessOS, not building it.

### Rules

- Documentation is part of the deliverable, not follow-up work. A change that alters what a user sees or does is not finished until the guide describes it.
- When a limitation is fixed, **delete it** from the README's "Known Limitations". A stale claim is worse than no claim: the original audit found the README describing a `src/middleware/` directory and a "cashflow" dashboard that never existed.
- Keep test counts, route lists and directory trees current when they change.
- The user guide explains *how to do a thing and why it behaves that way*; the README explains *how it is built*. Do not duplicate one inside the other &mdash; link instead.
