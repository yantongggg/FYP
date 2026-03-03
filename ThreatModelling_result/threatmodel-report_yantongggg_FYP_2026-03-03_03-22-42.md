# Automated Threat Modeling and Security Scan Report

## Repository Identity

**GitHub Owner / Username:** yantongggg
**Repository Name:** FYP
**Full Repository Name:** yantongggg/FYP

**Organization:** mbbgrp
**Report Date:** 2026-03-03
**Report Version:** tm-scan v1.0.0
**Report ID:** 20260303_032239
**Report Classification:** Confidential

## SYSTEM CONTEXT

### Actors
- Authenticated User
- External Threat Actor
- Identity/Session Provider
- Internet User

### Assets
- Sensitive User/Secret Data (High) - 162 evidence indicator(s)
- Datastores (postgres, postgresql, users) (High)

### Trust boundaries & Assumptions
- Boundary 1: Internet to Application is untrusted.
- Boundary 2: Application to Data Layer is trusted-only via server authorization.
- Boundary 3: Application to External Services must use authenticated encrypted channels.
- All client input is untrusted until server-side validation succeeds.

## ARCHITECTURE MODEL

```mermaid
flowchart TD
    subgraph z1[Untrusted Zone]
        attacker((Threat Actor))
        user[End User / Browser]
    end

    subgraph z2[Application Zone]
        gateway[API Gateway / Web Layer]
        appsvc[Application Services]
    end

    subgraph z3[Data Zone]
        datastore[(Primary Database)]
        audit[(Audit/Telemetry Store)]
    end

    subgraph z4[External Services Zone]
        idp[(Identity Provider)]
        external[(3rd Party APIs)]
    end

    attacker -->|HTTPS / untrusted input| gateway
    user -->|HTTPS / auth token| gateway
    gateway -->|internal authn/authz context| appsvc
    appsvc -->|SQL/TCP + db credentials| datastore
    appsvc -->|security events| audit
    gateway -->|OIDC/JWT validation| idp
    appsvc -->|TLS API call| external

    classDef highRisk fill:#ffcccc,stroke:#cc0000;
    classDef mediumRisk fill:#ffe6cc,stroke:#cc7a00;
    class gateway highRisk;
    class appsvc highRisk;
    class datastore highRisk;
    class attacker highRisk;
```

## DATA FLOW MATRIX

| Source | Destination | Data type | Protocol | Crosses trust boundary (Y/N) |
|--------|-------------|-----------|----------|-------------------------------|
| API Gateway / Web Layer | Application Services | Validated Request Context | Internal HTTP/RPC | N |
| API Gateway / Web Layer | Identity Provider | JWT/OIDC Claims | HTTPS | Y |
| Application Services | Audit/Telemetry Store | Security Audit Events | Structured Logging | N |
| Application Services | Primary Database | PII + Business Records | SQL/TCP | Y |
| Internet User | API Gateway / Web Layer | Credentials + Request Data | HTTPS | Y |
| Runtime Configuration | Application Services | Secrets/Connection Strings | ENV/File | N |

## 5-D THREAT ANALYSIS (STRIDE + PASTA + LINDDUN + CWE + DREAD)

### [TM-PRIV-001] Improper Logging of PII/Secrets (Tokens, Passwords, Full User Objects)
**STRIDE & LINDDUN Categories & CWE Reference:** Information Disclosure | Detectability | CWE-532
**DREAD:** Damage=8, Reproducibility=9, Exploitability=7, AffectedUsers=9, Discoverability=8, Avg=8.20

**PASTA Attack Scenario:**
- Precondition: Insider or attacker with log access has access to Application logs, APM traces, centralized log stores
- Exploitation: Sensitive fields emitted without redaction
- Business Impact: Privacy breach, regulatory fines, incident response cost

**Evidence Table:**
| File Path | Line Number | Trigger | Severity |
|-----------|-------------|---------|----------|
| README.md | not-captured | password | HIGH |
| ThreatModelling_result/threatmodel-report_2026-03-03_02-42-46.md | not-captured | password | HIGH |
| ThreatModelling_result/threatmodel-report_2026-03-03_02-42-46.md | not-captured | console.log | LOW |
| ThreatModelling_result/threatmodel-report_2026-03-03_02-58-49.md | not-captured | password | HIGH |
| ThreatModelling_result/threatmodel-report_2026-03-03_02-58-49.md | not-captured | console.log | LOW |
| ThreatModelling_result/threatmodel-report_yantongggg_FYP_2026-03-03_03-04-43.md | not-captured | password | HIGH |
| ThreatModelling_result/threatmodel-report_yantongggg_FYP_2026-03-03_03-04-43.md | not-captured | console.log | LOW |
| ThreatModelling_result/threatmodel-report_yantongggg_FYP_2026-03-03_03-08-02.md | not-captured | password | HIGH |
| ThreatModelling_result/threatmodel-report_yantongggg_FYP_2026-03-03_03-08-02.md | not-captured | console.log | LOW |
| backend/__pycache__/app.cpython-311.pyc | not-captured | password | HIGH |
| backend/app.py | not-captured | password | HIGH |
| backend/routes/__pycache__/auth.cpython-311.pyc | not-captured | password | HIGH |
| backend/routes/auth.py | not-captured | password | HIGH |
| backend/utils/__pycache__/supabase_manager.cpython-311.pyc | not-captured | password | HIGH |
| backend/utils/encryption_utils.py | not-captured | password | HIGH |
| backend/utils/exportUtils.ts | not-captured | console.log | LOW |
| backend/utils/supabase_manager.py | not-captured | password | HIGH |
| evidence-summary.md | not-captured | password | HIGH |
| evidence.json | not-captured | password | HIGH |
| evidence.json | not-captured | console.log | LOW |
| setUp.bat | not-captured | password | HIGH |
| src/App.tsx | not-captured | console.log | LOW |
| src/components/BehavioralMonitor.tsx | not-captured | password | HIGH |
| src/components/BehavioralMonitor.tsx | not-captured | console.log | LOW |
| src/components/BiometricCapture.tsx | not-captured | console.log | LOW |
| src/components/ChatBot.tsx | not-captured | password | HIGH |
| src/components/ChatBot.tsx | not-captured | console.log | LOW |
| src/components/EKYCDocumentViewer.tsx | not-captured | console.log | LOW |
| src/components/GlobalBehavioralWrapper.tsx | not-captured | password | HIGH |
| src/components/GlobalBehavioralWrapper.tsx | not-captured | console.log | LOW |
| src/components/ProtectedRoute.tsx | not-captured | console.log | LOW |
| src/contexts/AuthContext.tsx | not-captured | password | HIGH |
| src/contexts/AuthContext.tsx | not-captured | console.log | LOW |
| src/lib/supabase.ts | not-captured | password | HIGH |
| src/pages/AdminDashboard.tsx | not-captured | console.log | LOW |
| src/pages/AdminEditAccount.tsx | not-captured | password | HIGH |
| src/pages/BehavioralTestPage.tsx | not-captured | console.log | LOW |
| src/pages/Documentation.tsx | not-captured | password | HIGH |
| src/pages/Documentation.tsx | not-captured | console.log | LOW |
| src/pages/EditProfile.tsx | not-captured | password | HIGH |
| src/pages/EditProfile.tsx | not-captured | console.log | LOW |
| src/pages/Login.tsx | not-captured | password | HIGH |
| src/pages/Login.tsx | not-captured | console.log | LOW |
| src/pages/Register.tsx | not-captured | password | HIGH |
| src/pages/Register.tsx | not-captured | console.log | LOW |
| src/pages/UserHome.tsx | not-captured | password | HIGH |
| src/pages/UserHome.tsx | not-captured | console.log | LOW |
| supabase/functions/local-chatbot/index.ts | not-captured | password | HIGH |
| supabase/migrations/20250620102624_foggy_truth.sql | not-captured | password | HIGH |
| supabase/migrations/20250626133933_late_crystal.sql | not-captured | password | HIGH |
| threatmodel-report.md | not-captured | password | HIGH |
| threatmodel-report.md | not-captured | console.log | LOW |
| threatmodel-report.sarif | not-captured | password | HIGH |

**Recommended Technical Mitigations:**
- Structured logging + field allowlists
- Redaction middleware for HTTP headers/body
- Secrets scanning on logs and APM payloads
- Python: enforce server-side validation using Pydantic/FastAPI validators and reject unsafe payload shapes.
- TypeScript/React: never trust client-side computed security/business fields; send minimal inputs and recalculate on server.
- TypeScript backend: apply strict schema validation (zod/joi) and centralized authorization middleware per route.
- Python/TS APIs: verify JWT signature, issuer, audience, expiry on every protected request.
- React/Python logs: redact Authorization headers, tokens, passwords, and PII at logger middleware.

### [TM-CRYPTO-001] Broken / Weak Cryptography (MD5/SHA1/DES/ECB) for Secrets or Sensitive Data
**STRIDE & LINDDUN Categories & CWE Reference:** Information Disclosure | Linkability | CWE-327
**DREAD:** Damage=9, Reproducibility=8, Exploitability=7, AffectedUsers=9, Discoverability=7, Avg=8.00

**PASTA Attack Scenario:**
- Precondition: External attacker or insider has access to Password storage, token derivation, encryption at rest, backups
- Exploitation: Offline cracking; ciphertext pattern analysis
- Business Impact: Account compromise, regulatory breach, reputational damage

**Evidence Table:**
| File Path | Line Number | Trigger | Severity |
|-----------|-------------|---------|----------|
| ThreatModelling_result/threatmodel-report_2026-03-03_02-42-46.md | not-captured | argon2 | MEDIUM |
| ThreatModelling_result/threatmodel-report_2026-03-03_02-42-46.md | not-captured | bcrypt | MEDIUM |
| ThreatModelling_result/threatmodel-report_2026-03-03_02-58-49.md | not-captured | argon2 | MEDIUM |
| ThreatModelling_result/threatmodel-report_2026-03-03_02-58-49.md | not-captured | bcrypt | MEDIUM |
| ThreatModelling_result/threatmodel-report_yantongggg_FYP_2026-03-03_03-04-43.md | not-captured | argon2 | MEDIUM |
| ThreatModelling_result/threatmodel-report_yantongggg_FYP_2026-03-03_03-04-43.md | not-captured | bcrypt | MEDIUM |
| ThreatModelling_result/threatmodel-report_yantongggg_FYP_2026-03-03_03-08-02.md | not-captured | argon2 | MEDIUM |
| ThreatModelling_result/threatmodel-report_yantongggg_FYP_2026-03-03_03-08-02.md | not-captured | bcrypt | MEDIUM |
| backend/__pycache__/app.cpython-311.pyc | not-captured | bcrypt | MEDIUM |
| backend/app.py | not-captured | bcrypt | MEDIUM |
| backend/routes/__pycache__/auth.cpython-311.pyc | not-captured | bcrypt | MEDIUM |
| backend/routes/auth.py | not-captured | bcrypt | MEDIUM |
| backend/utils/__pycache__/supabase_manager.cpython-311.pyc | not-captured | bcrypt | MEDIUM |
| backend/utils/supabase_manager.py | not-captured | bcrypt | MEDIUM |
| evidence.json | not-captured | bcrypt | MEDIUM |
| package-lock.json | not-captured | bcrypt | MEDIUM |
| package.json | not-captured | bcrypt | MEDIUM |
| requirements.txt | not-captured | bcrypt | MEDIUM |
| setUp.bat | not-captured | bcrypt | MEDIUM |
| src/contexts/AuthContext.tsx | not-captured | bcrypt | MEDIUM |
| threatmodel-report.md | not-captured | argon2 | MEDIUM |
| threatmodel-report.md | not-captured | bcrypt | MEDIUM |
| threatmodel-report.sarif | not-captured | argon2 | MEDIUM |
| threatmodel-report.sarif | not-captured | bcrypt | MEDIUM |

**Recommended Technical Mitigations:**
- Ban weak algorithms by policy/lint
- Use AEAD modes (AES-GCM)
- Centralize crypto utilities and key management (KMS/HSM)
- Python: enforce server-side validation using Pydantic/FastAPI validators and reject unsafe payload shapes.
- TypeScript/React: never trust client-side computed security/business fields; send minimal inputs and recalculate on server.
- TypeScript backend: apply strict schema validation (zod/joi) and centralized authorization middleware per route.
- React/Python logs: redact Authorization headers, tokens, passwords, and PII at logger middleware.

### [TM-AUTH-002] Credential Stuffing / Missing Rate Limiting on Auth Endpoints
**STRIDE & LINDDUN Categories & CWE Reference:** Denial of Service | Detectability | CWE-307
**DREAD:** Damage=8, Reproducibility=9, Exploitability=8, AffectedUsers=8, Discoverability=8, Avg=8.20

**PASTA Attack Scenario:**
- Precondition: External attacker (botnet) has access to Login, token refresh, password reset, OTP endpoints
- Exploitation: High-rate brute force and credential stuffing
- Business Impact: Account takeover, auth outage, infra cost spike

**Evidence Table:**
| File Path | Line Number | Trigger | Severity |
|-----------|-------------|---------|----------|
| ThreatModelling_result/threatmodel-report_2026-03-03_02-42-46.md | not-captured | authenticate | MEDIUM |
| ThreatModelling_result/threatmodel-report_2026-03-03_02-58-49.md | not-captured | authenticate | MEDIUM |
| ThreatModelling_result/threatmodel-report_yantongggg_FYP_2026-03-03_03-04-43.md | not-captured | authenticate | MEDIUM |
| ThreatModelling_result/threatmodel-report_yantongggg_FYP_2026-03-03_03-08-02.md | not-captured | authenticate | MEDIUM |
| backend/__pycache__/enhanced_face_routes.cpython-311.pyc | not-captured | authenticate | MEDIUM |
| backend/__pycache__/enhanced_face_routes.cpython-312.pyc | not-captured | authenticate | MEDIUM |
| backend/routes/__pycache__/auth.cpython-311.pyc | not-captured | authenticate | MEDIUM |
| backend/routes/auth.py | not-captured | authenticate | MEDIUM |
| evidence-summary.md | not-captured | authenticate | MEDIUM |
| evidence.json | not-captured | authenticate | MEDIUM |
| src/App.tsx | not-captured | authenticate | MEDIUM |
| src/components/ChatBot.tsx | not-captured | authenticate | MEDIUM |
| src/pages/Documentation.tsx | not-captured | authenticate | MEDIUM |
| supabase/functions/local-chatbot/index.ts | not-captured | authenticate | MEDIUM |
| supabase/migrations/20250620102624_foggy_truth.sql | not-captured | authenticate | MEDIUM |
| supabase/migrations/20250624130544_copper_cell.sql | not-captured | authenticate | MEDIUM |
| supabase/migrations/20250624130931_dawn_smoke.sql | not-captured | authenticate | MEDIUM |
| supabase/migrations/20250626133933_late_crystal.sql | not-captured | authenticate | MEDIUM |
| threatmodel-report.md | not-captured | authenticate | MEDIUM |

**Recommended Technical Mitigations:**
- IP + account throttling
- Credential stuffing detection (known breached passwords, velocity checks)
- Step-up MFA for risky logins
- Python: enforce server-side validation using Pydantic/FastAPI validators and reject unsafe payload shapes.
- TypeScript/React: never trust client-side computed security/business fields; send minimal inputs and recalculate on server.
- TypeScript backend: apply strict schema validation (zod/joi) and centralized authorization middleware per route.
- Python/TS APIs: verify JWT signature, issuer, audience, expiry on every protected request.
- Python/TS gateway: enforce IP + account rate-limits, lockout/backoff, and anomaly detection.

### [TM-BIZ-001] Client-Side Trust of Financial Fields (Price/Quantity/Risk Score Manipulation)
**STRIDE & LINDDUN Categories & CWE Reference:** Tampering | Unawareness | CWE-602
**DREAD:** Damage=10, Reproducibility=7, Exploitability=7, AffectedUsers=8, Discoverability=6, Avg=7.60

**PASTA Attack Scenario:**
- Precondition: Fraudster has access to Checkout, payout, underwriting, risk scoring APIs
- Exploitation: Modify client parameters, replay requests
- Business Impact: Financial loss, AML/KYC violations, chargebacks

**Evidence Table:**
| File Path | Line Number | Trigger | Severity |
|-----------|-------------|---------|----------|
| ThreatModelling_result/threatmodel-report_2026-03-03_02-42-46.md | not-captured | risk_score | HIGH |
| ThreatModelling_result/threatmodel-report_2026-03-03_02-58-49.md | not-captured | risk_score | HIGH |
| ThreatModelling_result/threatmodel-report_yantongggg_FYP_2026-03-03_03-04-43.md | not-captured | risk_score | HIGH |
| ThreatModelling_result/threatmodel-report_yantongggg_FYP_2026-03-03_03-08-02.md | not-captured | risk_score | HIGH |
| backend/ml_models/__pycache__/behavior_auth.cpython-311.pyc | not-captured | risk_score | HIGH |
| evidence.json | not-captured | risk_score | HIGH |
| threatmodel-report.md | not-captured | risk_score | HIGH |

**Recommended Technical Mitigations:**
- Server-side recalculation of totals and risk
- Signed quotes and expiry for price offers
- Fraud monitoring for abnormal deltas
- Python: enforce server-side validation using Pydantic/FastAPI validators and reject unsafe payload shapes.
- TypeScript/React: never trust client-side computed security/business fields; send minimal inputs and recalculate on server.
- TypeScript backend: apply strict schema validation (zod/joi) and centralized authorization middleware per route.

## PASTA ANALYSIS (Attack Trees & Paths)

```mermaid
flowchart TD
    a0[Preconditions: Internet reachability and attacker capability]
    a1[Initial Exploitation: TM-PRIV-001 Improper Logging of PII/Secrets (Tokens, Passwords, Full User Objects)]
    a2[Privilege/Logic Abuse: TM-CRYPTO-001 Broken / Weak Cryptography (MD5/SHA1/DES/ECB) for Secrets or Sensitive Data]
    a3[Lateral Movement: TM-AUTH-002 Credential Stuffing / Missing Rate Limiting on Auth Endpoints]
    a4[Business Impact: Data breach, fraud, or service disruption]

    a0 -.-> a1
    a1 -.-> a2
    a2 -.-> a3
    a3 -.-> a4

    classDef highRisk fill:#ffcccc,stroke:#cc0000;
    class a1 highRisk;
    class a2 highRisk;
    class a3 highRisk;
    linkStyle 0 stroke:#cc0000,stroke-width:2px,stroke-dasharray: 5 5;
    linkStyle 1 stroke:#cc0000,stroke-width:2px,stroke-dasharray: 5 5;
    linkStyle 2 stroke:#cc0000,stroke-width:2px,stroke-dasharray: 5 5;
    linkStyle 3 stroke:#cc0000,stroke-width:2px,stroke-dasharray: 5 5;
```

## RISK SUMMARY

| Threat ID | Risk Level | DREAD Avg | Mitigation Priority |
|-----------|------------|-----------|---------------------|
| TM-PRIV-001 | Critical | 8.20 | P0 - Immediate |
| TM-CRYPTO-001 | Critical | 8.00 | P0 - Immediate |
| TM-AUTH-002 | Critical | 8.20 | P0 - Immediate |
| TM-BIZ-001 | Critical | 7.60 | P0 - Immediate |

---

*Secret Findings (gitleaks): 0*
*Total Packages (SBOM): 0*
*Report generated by tm-scan v1.0.0 on 2026-03-03 03:22:40*
*Automated output from static analysis; manual security review is required.*
