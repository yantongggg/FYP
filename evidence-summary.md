# Evidence Summary: target-repo

**Scan Date:** 2026-03-03
**Repository:** target-repo

## Overview

| Category | Count |
|----------|-------|
| OpenAPI/Swagger Files | 0 |
| DB Migration Files | 8 |
| Config Files | 1 |
| Keyword Hits | 424 |
| Rule Hits | 12 |
| Auth Hints | 102 |
| Database Hints | 72 |
| Risky Config Hints | 6 |

## Database Migration Files

- `supabase/migrations/20250626133933_late_crystal.sql`
- `supabase/migrations/20250624130931_dawn_smoke.sql`
- `supabase/migrations/20250624085451_quick_cottage.sql`
- `supabase/migrations/20250620102624_foggy_truth.sql`
- `supabase/migrations/20250624130544_copper_cell.sql`
- `supabase/migrations/20250624084919_sparkling_oasis.sql`
- `supabase/migrations/20250623105842_stark_glade.sql`
- `supabase/migrations/20250623102226_winter_bonus.sql`

## Configuration Files

- `.env.example`

## High Priority Keyword Hits

| Keyword | Category | File |
|---------|----------|------|
| users | database | `README.md` |
| password | credential | `README.md` |
| jwt | authn | `package-lock.json` |
| api_key | secret | `.env.example` |
| jwt | authn | `setUp.bat` |
| password | credential | `setUp.bat` |
| secret | secret | `setUp.bat` |
| password= | secret | `setUp.bat` |
| users | database | `supabase/functions/local-chatbot/index.ts` |
| jwt | authn | `supabase/functions/local-chatbot/index.ts` |
| password | credential | `supabase/functions/local-chatbot/index.ts` |
| apikey | secret | `supabase/functions/local-chatbot/index.ts` |
| apikey | secret | `supabase/functions/behavioral-analysis/index.ts` |
| users | database | `supabase/migrations/20250626133933_late_crystal.sql` |
| password | credential | `supabase/migrations/20250626133933_late_crystal.sql` |
| users | database | `supabase/migrations/20250624130931_dawn_smoke.sql` |
| users | database | `supabase/migrations/20250624085451_quick_cottage.sql` |
| users | database | `supabase/migrations/20250620102624_foggy_truth.sql` |
| password | credential | `supabase/migrations/20250620102624_foggy_truth.sql` |
| users | database | `supabase/migrations/20250624130544_copper_cell.sql` |
| users | database | `supabase/migrations/20250624084919_sparkling_oasis.sql` |
| users | database | `supabase/migrations/20250623105842_stark_glade.sql` |
| users | database | `supabase/migrations/20250623102226_winter_bonus.sql` |
| password | credential | `src/components/GlobalBehavioralWrapper.tsx` |
| password | credential | `src/components/BehavioralMonitor.tsx` |
| password | credential | `src/components/ChatBot.tsx` |
| users | database | `src/lib/supabase.ts` |
| password | credential | `src/lib/supabase.ts` |
| users | database | `src/contexts/AuthContext.tsx` |
| password | credential | `src/contexts/AuthContext.tsx` |
| users | database | `src/pages/Home.tsx` |
| users | database | `src/pages/AdminEditAccount.tsx` |
| password | credential | `src/pages/AdminEditAccount.tsx` |
| users | database | `src/pages/Login.tsx` |
| password | credential | `src/pages/Login.tsx` |
| password | credential | `src/pages/EditProfile.tsx` |
| password | credential | `src/pages/UserHome.tsx` |
| users | database | `src/pages/MyAnomalies.tsx` |
| users | database | `src/pages/DatabaseSchema.tsx` |
| jwt | authn | `src/pages/Architecture.tsx` |
| users | database | `src/pages/AdminDashboard.tsx` |
| password | credential | `src/pages/Register.tsx` |
| users | database | `src/pages/Documentation.tsx` |
| jwt | authn | `src/pages/Documentation.tsx` |
| password | credential | `src/pages/Documentation.tsx` |
| secret | secret | `src/pages/Documentation.tsx` |
| users | database | `backend/app.py` |
| password | credential | `backend/app.py` |
| users | database | `backend/__pycache__/enhanced_face_routes.cpython-312.pyc` |
| users | database | `backend/__pycache__/enhanced_face_routes.cpython-311.pyc` |
| ... | ... | ... and 42 more |

## Rule Hits

| Rule ID | Severity | Category | File |
|---------|----------|----------|------|
| vuln-sensitive-data-logging | HIGH | repudiation | `supabase/functions/local-chatbot/index.ts` |
| vuln-sensitive-data-logging | HIGH | repudiation | `src/lib/supabase.ts` |
| vuln-sensitive-data-logging | HIGH | repudiation | `backend/app.py` |
| vuln-sensitive-data-logging | HIGH | repudiation | `backend/utils/encryption_utils.py` |
| vuln-sqli-concatenation | CRITICAL | injection | `backend/utils/supabase_manager.py` |
| vuln-weak-hashing | HIGH | crypto | `backend/utils/supabase_manager.py` |
| vuln-sensitive-data-logging | HIGH | repudiation | `backend/utils/supabase_manager.py` |
| vuln-insecure-random | MEDIUM | crypto | `backend/ml_models/liveness_detector.py` |
| vuln-sqli-concatenation | CRITICAL | injection | `backend/routes/ekyc.py` |
| vuln-sqli-concatenation | CRITICAL | injection | `backend/routes/auth.py` |
| vuln-hardcoded-credentials | CRITICAL | authn | `backend/routes/auth.py` |
| vuln-sensitive-data-logging | HIGH | repudiation | `backend/routes/auth.py` |

## Authentication/Authorization Hints

| Type | Category | File |
|------|----------|------|
| password | credential | `README.md` |
| jwt | authn | `package-lock.json` |
| jwt | authn | `setUp.bat` |
| password | credential | `setUp.bat` |
| jwt | authn | `supabase/functions/local-chatbot/index.ts` |
| authenticate | authn | `supabase/functions/local-chatbot/index.ts` |
| login | authn | `supabase/functions/local-chatbot/index.ts` |
| password | credential | `supabase/functions/local-chatbot/index.ts` |
| session | session | `supabase/functions/local-chatbot/index.ts` |
| session | session | `supabase/functions/behavioral-analysis/index.ts` |
| authenticate | authn | `supabase/migrations/20250626133933_late_crystal.sq...` |
| login | authn | `supabase/migrations/20250626133933_late_crystal.sq...` |
| password | credential | `supabase/migrations/20250626133933_late_crystal.sq...` |
| session | session | `supabase/migrations/20250626133933_late_crystal.sq...` |
| authenticate | authn | `supabase/migrations/20250624130931_dawn_smoke.sql` |
| login | authn | `supabase/migrations/20250624130931_dawn_smoke.sql` |
| authenticate | authn | `supabase/migrations/20250620102624_foggy_truth.sql` |
| login | authn | `supabase/migrations/20250620102624_foggy_truth.sql` |
| password | credential | `supabase/migrations/20250620102624_foggy_truth.sql` |
| session | session | `supabase/migrations/20250620102624_foggy_truth.sql` |
| authenticate | authn | `supabase/migrations/20250624130544_copper_cell.sql` |
| login | authn | `supabase/migrations/20250624130544_copper_cell.sql` |
| authenticate | authn | `src/App.tsx` |
| login | authn | `src/App.tsx` |
| login | authn | `src/components/GlobalBehavioralWrapper.tsx` |
| password | credential | `src/components/GlobalBehavioralWrapper.tsx` |
| session | session | `src/components/GlobalBehavioralWrapper.tsx` |
| password | credential | `src/components/BehavioralMonitor.tsx` |
| session | session | `src/components/BehavioralMonitor.tsx` |
| login | authn | `src/components/Navbar.tsx` |
| ... | ... | ... and 72 more |

## Database Technology Hints

- **postgres** found in 9 file(s)
  - `README.md`
  - `package-lock.json`
  - `supabase/functions/local-chatbot/index.ts`
  - `src/components/ChatBot.tsx`
  - `src/pages/UserHome.tsx`
  - ... and 4 more
- **postgresql** found in 6 file(s)
  - `README.md`
  - `supabase/functions/local-chatbot/index.ts`
  - `src/components/ChatBot.tsx`
  - `src/pages/DatabaseSchema.tsx`
  - `src/pages/Architecture.tsx`
  - ... and 1 more
- **users** found in 57 file(s)
  - `README.md`
  - `supabase/functions/local-chatbot/index.ts`
  - `supabase/migrations/20250626133933_late_crystal.sql`
  - `supabase/migrations/20250624130931_dawn_smoke.sql`
  - `supabase/migrations/20250624085451_quick_cottage.sql`
  - ... and 52 more

## Risky Configuration Hints

> **Note:** Values are redacted for security

| Type | Value (Redacted) | File |
|------|------------------|------|
| secret_reference | `api_key` | `.env.example` |
| secret_reference | `secret` | `setUp.bat` |
| secret_reference | `password=` | `setUp.bat` |
| secret_reference | `apikey` | `supabase/functions/local-chatbot/index.t...` |
| secret_reference | `apikey` | `supabase/functions/behavioral-analysis/i...` |
| secret_reference | `secret` | `src/pages/Documentation.tsx` |
