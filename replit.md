# NursePrep Analytics
A comprehensive platform helping nursing students pass the NCLEX exam through intelligent assessment analysis, personalized study plans, and advanced content management.

## Run & Operate
- **Run Dev Server**: `npm run dev`
- **Build**: `npm run build`
- **Typecheck**: `npm run typecheck`
- **Codegen (Drizzle)**: `npm run generate-drizzle-types`
- **DB Push (Drizzle)**: `npm run db-push`
- **Required Env Vars**: `SESSION_SECRET`

## Stack
- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL (Neon)
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **UI**: Radix UI, shadcn/ui, Tailwind CSS
- **State Management**: TanStack Query
- **Authentication**: Session-based (Express sessions, connect-pg-simple)
- **PDF Processing**: `pdf-parse`, `multer`, `react-dropzone`
- **RAG**: Custom RAG system with intelligent chunking, hybrid search, AI answer generation
- **Build Tool**: Vite

## Where things live
- **Frontend Source**: `client/`
- **Backend Source**: `server/`
- **Database Schema**: `db/schema.ts`
- **API Routes**: `server/routes/`
- **Admin Routes**: `server/admin-routes.ts`
- **Curriculum Catalog API**: `server/routes/curriculum-catalog-routes.ts`
- **UI Components**: `client/components/ui/`
- **Authentication Logic**: `server/admin-auth-session.ts`
- **PDF Generation Logic**: `pdf-generator.ts`, `enhanced-pdf-generator.ts`

## Architecture decisions
- **Passwordless Auth**: For student login, uses magic links to enhance security and user experience.
- **Drizzle ORM**: Chosen for type-safe schema definitions and migrations, leveraging PostgreSQL's capabilities.
- **Custom RAG System**: Instead of an off-the-shelf solution, a bespoke RAG system was developed for multi-format document support, intelligent chunking, and hybrid search tailored to educational content.
- **Vite for Development**: Selected for its fast hot module replacement and build times, optimizing developer workflow.
- **Monorepo Structure**: Frontend and backend live in a single repository for easier development and deployment, managed by Vite's middleware in development.

## Product
- **Student Features**: Passwordless authentication, PDF assessment analysis, personalized study plans, curriculum integration, progress tracking.
- **Educator/Admin Features**: Admin dashboard, resource management, demand analytics, knowledge base (RAG), lead generation & call booking.
- **Core Capabilities**: NCLEX assessment report upload & analysis, AI-powered study plan generation, educational resource mapping, semantic search within a knowledge base, automated lead capture and scheduling.

## User preferences
_Populate as you build_

## Gotchas
- **Admin Login**: Admin credentials are `admin@nurseprep.com` / `admin123` (password hash was invalidated).
- **Date Handling**: `new Date(value)` calls require null/invalid value guarding to prevent crashes.
- **External Curriculum API**: Currently returns 503; expected behavior until the service is active.
- **Progress API Polling**: Ensure `mvp-action-plan.tsx` only calls `/api/progress/topics` when authenticated to avoid 401 errors.
- **SESSION_SECRET**: Must be set for production sessions to work correctly.

## Pointers
- **Radix UI Docs**: [https://www.radix-ui.com/](https://www.radix-ui.com/)
- **shadcn/ui Docs**: [https://ui.shadcn.com/](https://ui.shadcn.com/)
- **Drizzle ORM Docs**: [https://orm.drizzle.team/](https://orm.drizzle.team/)
- **Tailwind CSS Docs**: [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
- **TanStack Query Docs**: [https://tanstack.com/query/latest](https://tanstack.com/query/latest)
- **Vite Docs**: [https://vitejs.dev/guide/](https://vitejs.dev/guide/)