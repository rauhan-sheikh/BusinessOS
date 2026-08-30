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
