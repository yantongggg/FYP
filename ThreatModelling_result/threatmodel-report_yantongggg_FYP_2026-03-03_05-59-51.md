# Enterprise Threat Modeling & Security Audit

## Repository Identity
**GitHub Owner / Username:** yantongggg
**Repository Name:** FYP
**Report Date:** 2026-03-03 05:59:50
**Report Version:** tm-scan v1.0.0
**Classification:** Highly Confidential

## 1. SYSTEM CONTEXT

### Actors
- Authenticated End User
- External Threat Actor
- Identity & Access Management (IAM)

### Assets
- Sensitive User/PII Data (High Value) - 40 evidence trace(s)
- Authentication Context/Tokens (High Value) - 86 evidence trace(s)

### Trust Boundaries & Assumptions
- **Boundary 1:** Internet to Application Gateway is inherently untrusted.
- **Boundary 2:** API Layer to Data Store relies on strict server-side authorization.
- **Assumption:** Client-side biometric/eKYC controls can be bypassed; server-side validation is mandatory.

## 2. ARCHITECTURE MODEL

```mermaid
flowchart TD
    subgraph TB1 [TB1: Untrusted Internet Zone]
        attacker((Threat Actor))
        user((End User / Browser))
        client[React Frontend / SPA]
    end

    subgraph TB2 [TB2: Application Internal Services]
        gateway[API Gateway / Auth Controller]
        backend[Python Backend / ML Service]
    end

    subgraph TB3 [TB3: Secure Data Zone]
        db[(Supabase PostgreSQL)]
    end

    %% Data Flows
    attacker -->|HTTPS / Untrusted Probes| gateway
    user -->|HTTPS / Auth Token| gateway
    user -->|UI Interaction| client
    client -->|HTTPS / API Payload| gateway
    gateway -->|Internal RPC / Authz Context| backend
    backend -->|SQL / DB Credentials| db

    classDef highRisk fill:#ffcccc,stroke:#cc0000;
    class gateway highRisk;
    class db highRisk;
    class attacker highRisk;
    class backend highRisk;
```

## 3. DATA FLOW MATRIX

| Source | Destination | Data Type | Protocol | Auth | Crosses Trust Boundary? |
|--------|-------------|-----------|----------|------|-------------------------|
| Frontend Client | API Gateway | User/eKYC Payload | HTTPS | JWT | **Yes** |
| API Gateway | ML Backend | Image/Biometric Data | Internal RPC | Service | No |
| Backend Service | Database | SQL Queries / PII | TCP/5432 | Password | **Yes** |
| App Config | Runtime | DB Secrets / API Keys | ENV | OS Level | No |

## 4. 5-D THREAT ANALYSIS (STRIDE + PASTA + LINDDUN + CWE + DREAD)

### [TM-PRIV-001] Improper Logging of PII/Secrets (Tokens, Passwords, Full User Objects)
**STRIDE / LINDDUN:** Information Disclosure / Detectability | **CWE:** CWE-532
**DREAD Score:** Damage=8, Repro=9, Exploit=7, Users=9, Discover=8 (Avg: 8.20)

**PASTA Attack Scenario:**
- **Precondition:** Application logs, APM traces, centralized log stores
- **Exploitation:** Sensitive fields emitted without redaction
- **Business Impact:** Privacy breach, regulatory fines, incident response cost

**Evidence Context (Actionable Trace):**
| File Path | Exact Line | Trigger (Rule/Keyword) | Severity |
|-----------|------------|------------------------|----------|
| `backend/app.py` | **Line 538** | Rule: `vuln-sensitive-data-logging` | **HIGH** |
| `backend/utils/supabase_manager.py` | **Line 272** | Rule: `vuln-sensitive-data-logging` | **HIGH** |
| `supabase/functions/local-chatbot/index.ts` | Line - | Rule: `vuln-sensitive-data-logging` | HIGH |
| `src/lib/supabase.ts` | Line - | Rule: `vuln-sensitive-data-logging` | HIGH |
| `backend/app.py` | Line - | Rule: `vuln-sensitive-data-logging` | HIGH |
| `backend/utils/encryption_utils.py` | Line - | Rule: `vuln-sensitive-data-logging` | HIGH |
| `backend/utils/supabase_manager.py` | Line - | Rule: `vuln-sensitive-data-logging` | HIGH |
| `backend/routes/auth.py` | Line - | Rule: `vuln-sensitive-data-logging` | HIGH |
| `evidence.json` | - | Keyword: `password` | HIGH |
| `evidence.json` | - | Keyword: `console.log` | LOW |
| `supabase/functions/local-chatbot/index.ts` | - | Keyword: `password` | HIGH |
| `supabase/migrations/20250626133933_late_crystal.sql` | - | Keyword: `password` | HIGH |
| `supabase/migrations/20250620102624_foggy_truth.sql` | - | Keyword: `password` | HIGH |
| `src/App.tsx` | - | Keyword: `console.log` | LOW |
| `src/components/GlobalBehavioralWrapper.tsx` | - | Keyword: `password` | HIGH |
| `src/components/GlobalBehavioralWrapper.tsx` | - | Keyword: `console.log` | LOW |
| `src/components/EKYCDocumentViewer.tsx` | - | Keyword: `console.log` | LOW |
| `src/components/BehavioralMonitor.tsx` | - | Keyword: `password` | HIGH |
| `src/components/BehavioralMonitor.tsx` | - | Keyword: `console.log` | LOW |
| `src/components/ChatBot.tsx` | - | Keyword: `password` | HIGH |
| `src/components/ChatBot.tsx` | - | Keyword: `console.log` | LOW |
| `src/components/ProtectedRoute.tsx` | - | Keyword: `console.log` | LOW |
| `src/components/BiometricCapture.tsx` | - | Keyword: `console.log` | LOW |
| `src/lib/supabase.ts` | - | Keyword: `password` | HIGH |
| `src/contexts/AuthContext.tsx` | - | Keyword: `password` | HIGH |
| `src/contexts/AuthContext.tsx` | - | Keyword: `console.log` | LOW |
| `src/pages/AdminEditAccount.tsx` | - | Keyword: `password` | HIGH |
| `src/pages/Login.tsx` | - | Keyword: `password` | HIGH |
| `src/pages/Login.tsx` | - | Keyword: `console.log` | LOW |
| `src/pages/EditProfile.tsx` | - | Keyword: `password` | HIGH |

**Mitigation Requirements:**
- Structured logging + field allowlists
- Redaction middleware for HTTP headers/body
- Secrets scanning on logs and APM payloads

### [TM-API-003] SQL Injection via String Concatenation / Unsafe Query Construction
**STRIDE / LINDDUN:** Tampering / Non-repudiation | **CWE:** CWE-89
**DREAD Score:** Damage=10, Repro=9, Exploit=8, Users=9, Discover=8 (Avg: 8.80)

**PASTA Attack Scenario:**
- **Precondition:** Search/filter endpoints, admin panels, report generators
- **Exploitation:** Injected payloads via query params/body fields
- **Business Impact:** PII leakage, financial loss, database compromise

**Evidence Context (Actionable Trace):**
| File Path | Exact Line | Trigger (Rule/Keyword) | Severity |
|-----------|------------|------------------------|----------|
| `backend/utils/supabase_manager.py` | Line - | Rule: `vuln-sqli-concatenation` | CRITICAL |
| `backend/routes/ekyc.py` | Line - | Rule: `vuln-sqli-concatenation` | CRITICAL |
| `backend/routes/auth.py` | Line - | Rule: `vuln-sqli-concatenation` | CRITICAL |

**Mitigation Requirements:**
- Prepared statements everywhere
- Centralize query building; ban raw concatenation by linting
- Least-privileged DB roles

### [TM-AUTH-002] Credential Stuffing / Missing Rate Limiting on Auth Endpoints
**STRIDE / LINDDUN:** Denial of Service / Detectability | **CWE:** CWE-307
**DREAD Score:** Damage=8, Repro=9, Exploit=8, Users=8, Discover=8 (Avg: 8.20)

**PASTA Attack Scenario:**
- **Precondition:** Login, token refresh, password reset, OTP endpoints
- **Exploitation:** High-rate brute force and credential stuffing
- **Business Impact:** Account takeover, auth outage, infra cost spike

**Evidence Context (Actionable Trace):**
| File Path | Exact Line | Trigger (Rule/Keyword) | Severity |
|-----------|------------|------------------------|----------|
| `evidence.json` | - | Keyword: `authenticate` | MEDIUM |
| `supabase/functions/local-chatbot/index.ts` | - | Keyword: `authenticate` | MEDIUM |
| `supabase/migrations/20250626133933_late_crystal.sql` | - | Keyword: `authenticate` | MEDIUM |
| `supabase/migrations/20250624130931_dawn_smoke.sql` | - | Keyword: `authenticate` | MEDIUM |
| `supabase/migrations/20250620102624_foggy_truth.sql` | - | Keyword: `authenticate` | MEDIUM |
| `supabase/migrations/20250624130544_copper_cell.sql` | - | Keyword: `authenticate` | MEDIUM |
| `src/App.tsx` | - | Keyword: `authenticate` | MEDIUM |
| `src/components/ChatBot.tsx` | - | Keyword: `authenticate` | MEDIUM |
| `src/pages/Documentation.tsx` | - | Keyword: `authenticate` | MEDIUM |
| `backend/routes/auth.py` | - | Keyword: `authenticate` | MEDIUM |

**Mitigation Requirements:**
- IP + account throttling
- Credential stuffing detection (known breached passwords, velocity checks)
- Step-up MFA for risky logins

### [TM-CRYPTO-001] Broken / Weak Cryptography (MD5/SHA1/DES/ECB) for Secrets or Sensitive Data
**STRIDE / LINDDUN:** Information Disclosure / Linkability | **CWE:** CWE-327
**DREAD Score:** Damage=9, Repro=8, Exploit=7, Users=9, Discover=7 (Avg: 8.00)

**PASTA Attack Scenario:**
- **Precondition:** Password storage, token derivation, encryption at rest, backups
- **Exploitation:** Offline cracking; ciphertext pattern analysis
- **Business Impact:** Account compromise, regulatory breach, reputational damage

**Evidence Context (Actionable Trace):**
| File Path | Exact Line | Trigger (Rule/Keyword) | Severity |
|-----------|------------|------------------------|----------|
| `backend/utils/supabase_manager.py` | **Line 1226** | Rule: `vuln-weak-hashing` | **HIGH** |
| `backend/utils/supabase_manager.py` | **Line 1234** | Rule: `vuln-weak-hashing` | **HIGH** |
| `backend/ml_models/liveness_detector.py` | **Line 216** | Rule: `vuln-insecure-random` | **MEDIUM** |
| `backend/ml_models/liveness_detector.py` | **Line 217** | Rule: `vuln-insecure-random` | **MEDIUM** |
| `backend/ml_models/liveness_detector.py` | **Line 219** | Rule: `vuln-insecure-random` | **MEDIUM** |
| `backend/ml_models/liveness_detector.py` | **Line 220** | Rule: `vuln-insecure-random` | **MEDIUM** |
| `backend/utils/supabase_manager.py` | Line - | Rule: `vuln-weak-hashing` | HIGH |
| `backend/ml_models/liveness_detector.py` | Line - | Rule: `vuln-insecure-random` | MEDIUM |
| `evidence.json` | - | Keyword: `bcrypt` | MEDIUM |
| `package.json` | - | Keyword: `bcrypt` | MEDIUM |
| `package-lock.json` | - | Keyword: `bcrypt` | MEDIUM |
| `src/contexts/AuthContext.tsx` | - | Keyword: `bcrypt` | MEDIUM |
| `backend/app.py` | - | Keyword: `bcrypt` | MEDIUM |
| `backend/utils/supabase_manager.py` | - | Keyword: `bcrypt` | MEDIUM |
| `backend/routes/auth.py` | - | Keyword: `bcrypt` | MEDIUM |

**Mitigation Requirements:**
- Ban weak algorithms by policy/lint
- Use AEAD modes (AES-GCM)
- Centralize crypto utilities and key management (KMS/HSM)

### [TM-CLOUD-002] Hardcoded Cloud Credentials / Service Account Keys in Source
**STRIDE / LINDDUN:** Information Disclosure / Detectability | **CWE:** CWE-798
**DREAD Score:** Damage=10, Repro=8, Exploit=8, Users=9, Discover=7 (Avg: 8.40)

**PASTA Attack Scenario:**
- **Precondition:** Git repositories, build logs, artifact stores
- **Exploitation:** Leaked secrets via commits or CI output
- **Business Impact:** Cloud account takeover, data breach, crypto-mining, service disruption

**Evidence Context (Actionable Trace):**
| File Path | Exact Line | Trigger (Rule/Keyword) | Severity |
|-----------|------------|------------------------|----------|
| `backend/routes/auth.py` | **Line 132** | Rule: `vuln-hardcoded-credentials` | **CRITICAL** |
| `backend/routes/auth.py` | Line - | Rule: `vuln-hardcoded-credentials` | CRITICAL |

**Mitigation Requirements:**
- Secret scanning in CI (gitleaks) + pre-commit hooks
- Use IAM roles / workload identity federation
- Central secret manager with rotation and auditing

### [TM-BIZ-001] Client-Side Trust of Financial Fields (Price/Quantity/Risk Score Manipulation)
**STRIDE / LINDDUN:** Tampering / Unawareness | **CWE:** CWE-602
**DREAD Score:** Damage=10, Repro=7, Exploit=7, Users=8, Discover=6 (Avg: 7.60)

**PASTA Attack Scenario:**
- **Precondition:** Checkout, payout, underwriting, risk scoring APIs
- **Exploitation:** Modify client parameters, replay requests
- **Business Impact:** Financial loss, AML/KYC violations, chargebacks

**Evidence Context (Actionable Trace):**
| File Path | Exact Line | Trigger (Rule/Keyword) | Severity |
|-----------|------------|------------------------|----------|
| `evidence.json` | - | Keyword: `risk_score` | HIGH |

**Mitigation Requirements:**
- Server-side recalculation of totals and risk
- Signed quotes and expiry for price offers
- Fraud monitoring for abnormal deltas

## 5. PASTA ANALYSIS (Attack Trees & Paths)

```mermaid
flowchart TD
    a0["Precondition: Attacker maps attack surface"]
    a1["Initial Exploit: TM-PRIV-001: Improper Logging of PII/Secrets [Tokens, Passwords, Full User Objects]"]
    a2["Pivot/Escalate: TM-API-003: SQL Injection via String Concatenation / Unsafe Query Construction"]
    a3["Objective Reached: TM-AUTH-002: Credential Stuffing / Missing Rate Limiting on Auth Endpoints"]
    a4["Business Impact: High regulatory and financial loss"]

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

## 6. RISK SUMMARY & ACTION PLAN

| Threat ID | Threat Name | Risk Level | DREAD Avg | Mitigation Priority |
|-----------|-------------|------------|-----------|---------------------|
| TM-PRIV-001 | Improper Logging of PII/Secrets (Tokens, Passwords, Full User Objects) | **Critical** | 8.20 | P0 - Immediate |
| TM-API-003 | SQL Injection via String Concatenation / Unsafe Query Construction | **Critical** | 8.80 | P0 - Immediate |
| TM-AUTH-002 | Credential Stuffing / Missing Rate Limiting on Auth Endpoints | **Critical** | 8.20 | P0 - Immediate |
| TM-CRYPTO-001 | Broken / Weak Cryptography (MD5/SHA1/DES/ECB) for Secrets or Sensitive Data | **Critical** | 8.00 | P0 - Immediate |
| TM-CLOUD-002 | Hardcoded Cloud Credentials / Service Account Keys in Source | **Critical** | 8.40 | P0 - Immediate |
| TM-BIZ-001 | Client-Side Trust of Financial Fields (Price/Quantity/Risk Score Manipulation) | **High** | 7.60 | P1 - Current Sprint |

---
*Secret Findings (gitleaks): 0*
*Total Packages (SBOM): 0*
*Report generated automatically by tm-scan v1.0.0 on 2026-03-03 05:59:50*
*End of Threat Model Report*