# Enterprise Threat Modeling & Security Audit

## Repository Identity
**GitHub Owner / Username:** yantongggg
**Repository Name:** FYP
**Report Date:** 2026-10-12 03:04:57
**Report Version:** tm-scan v1.0.0
**Classification:** Highly Confidential

## 1. SYSTEM CONTEXT

### Actors
- Authenticated End User
- External Threat Actor
- Identity & Access Management (IAM)

### Assets
- Sensitive User/PII Data (High Value) - 43 evidence trace(s)
- Authentication Context/Tokens (High Value) - 96 evidence trace(s)

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

## 2.5 FULL THREAT-MODEL DIAGRAM

```mermaid
flowchart LR
    subgraph EXT [External / Untrusted Zone]
        ta((Threat Actor))
        eu((End User))
    end

    subgraph APP [Application Trust Zone]
        api[API Gateway / Auth Controller]
        web[Web / Mobile Frontend]
        svc[Backend Services]
    end

    subgraph DATA [Data / Secrets Zone]
        db[(Primary DB / Supabase)]
        sec[(Secrets / Config)]
    end

    %% Primary Flows
    eu -->|HTTPS| api
    ta -->|Recon / Probe| api
    eu -->|UI Actions| web
    web -->|API Requests| api
    api -->|Validated Context| svc
    svc -->|SQL / ORM| db
    svc -->|Secret Access| sec

    subgraph THR [Top Threat Scenarios]
        t1["TM-PRIV-001: Improper Logging of PII/Secrets [Tokens, Passwords, Full User Objects]"]
        t2["TM-API-003: SQL Injection via String Concatenation / Unsafe Query Construction"]
        t3["TM-AUTH-002: Credential Stuffing / Missing Rate Limiting on Auth Endpoints"]
        t4["TM-CRYPTO-001: Broken / Weak Cryptography [MD5/SHA1/DES/ECB] for Secrets or Sensitive Data"]
        t5["TM-CLOUD-002: Hardcoded Cloud Credentials / Service Account Keys in Source"]
        t6["TM-BIZ-001: Client-Side Trust of Financial Fields [Price/Quantity/Risk Score Manipulation]"]
    end

    %% Threat Mapping
    ta -.-> t1
    t1 -.-> svc
    ta -.-> t2
    t2 -.-> svc
    ta -.-> t3
    t3 -.-> svc
    ta -.-> t4
    t4 -.-> svc
    ta -.-> t5
    t5 -.-> svc
    ta -.-> t6
    t6 -.-> svc

    classDef highRisk fill:#ffcccc,stroke:#cc0000;
    class ta highRisk;
    class api highRisk;
    class sec highRisk;
    class svc highRisk;
    class db highRisk;
    class t1 highRisk;
    class t2 highRisk;
    class t3 highRisk;
    class t4 highRisk;
    class t5 highRisk;
    class t6 highRisk;
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
| File Path | Exact Line | Trigger (Rule/Keyword) | Severity | Source | Confidence |
|-----------|------------|------------------------|----------|--------|------------|
| `backend/app.py` | 541 | Rule: `vuln-sensitive-data-logging` | HIGH | SAST | High |
| `backend/utils/supabase_manager.py` | 272 | Rule: `vuln-sensitive-data-logging` | HIGH | SAST | High |
| `supabase/functions/local-chatbot/index.ts` | 35 | Rule: `vuln-sensitive-data-logging` | HIGH | Rule+SAST | High |
| `backend/utils/encryption_utils.py` | 8 | Rule: `vuln-sensitive-data-logging` | HIGH | Rule+SAST | High |
| `backend/routes/auth.py` | 21 | Rule: `vuln-sensitive-data-logging` | HIGH | Rule+SAST | High |
| `src/lib/supabase.ts` | 12 | Rule: `vuln-sensitive-data-logging` | HIGH | Rule+SAST | High |

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
| File Path | Exact Line | Trigger (Rule/Keyword) | Severity | Source | Confidence |
|-----------|------------|------------------------|----------|--------|------------|
| `backend/utils/supabase_manager.py` | 108 | Rule: `vuln-sqli-concatenation` | CRITICAL | Rule+SAST | High |
| `backend/routes/auth.py` | 43 | Rule: `vuln-sqli-concatenation` | CRITICAL | Rule+SAST | High |
| `backend/routes/ekyc.py` | 76 | Rule: `vuln-sqli-concatenation` | CRITICAL | Rule+SAST | High |

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
| File Path | Exact Line | Trigger (Rule/Keyword) | Severity | Source | Confidence |
|-----------|------------|------------------------|----------|--------|------------|
| `supabase/migrations/20250624130931_dawn_smoke.sql` | 34 | Keyword: `authenticate` | MEDIUM | Keyword+Line | Medium |
| `supabase/migrations/20250620102624_foggy_truth.sql` | 168 | Keyword: `authenticate` | MEDIUM | Keyword+Line | Medium |
| `supabase/migrations/20250624130544_copper_cell.sql` | 45 | Keyword: `authenticate` | MEDIUM | Keyword+Line | Medium |
| `supabase/migrations/20250626133933_late_crystal.sql` | 197 | Keyword: `authenticate` | MEDIUM | Keyword+Line | Medium |
| `supabase/functions/local-chatbot/index.ts` | 39 | Keyword: `authenticate` | MEDIUM | Keyword+Line | Medium |
| `backend/utils/liveness_challenge.py` | 5 | Keyword: `authenticate` | MEDIUM | Keyword+Line | Medium |
| `backend/routes/auth.py` | 93 | Keyword: `authenticate` | MEDIUM | Keyword+Line | Medium |
| `src/App.tsx` | 58 | Keyword: `authenticate` | MEDIUM | Keyword+Line | Medium |
| `src/components/ChatBot.tsx` | 506 | Keyword: `authenticate` | MEDIUM | Keyword+Line | Medium |
| `src/pages/LivenessLab.tsx` | 37 | Keyword: `authenticate` | MEDIUM | Keyword+Line | Medium |
| `src/pages/Documentation.tsx` | 317 | Keyword: `authenticate` | MEDIUM | Keyword+Line | Medium |

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
| File Path | Exact Line | Trigger (Rule/Keyword) | Severity | Source | Confidence |
|-----------|------------|------------------------|----------|--------|------------|
| `package-lock.json` | 16 | Keyword: `bcrypt` | MEDIUM | Keyword+Line | Medium |
| `package.json` | 18 | Keyword: `bcrypt` | MEDIUM | Keyword+Line | Medium |
| `backend/app.py` | 21 | Keyword: `bcrypt` | MEDIUM | Keyword+Line | Medium |
| `backend/utils/supabase_manager.py` | 5 | Keyword: `bcrypt` | MEDIUM | Keyword+Line | Medium |
| `backend/routes/auth.py` | 2 | Keyword: `bcrypt` | MEDIUM | Keyword+Line | Medium |
| `src/contexts/AuthContext.tsx` | 3 | Keyword: `bcrypt` | MEDIUM | Keyword+Line | Medium |

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
| File Path | Exact Line | Trigger (Rule/Keyword) | Severity | Source | Confidence |
|-----------|------------|------------------------|----------|--------|------------|
| `backend/routes/auth.py` | 132 | Rule: `vuln-hardcoded-credentials` | CRITICAL | SAST | High |

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
No specific code-level evidence captured.

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
*Report generated automatically by tm-scan v1.0.0 on 2026-10-12 03:04:57*
*End of Threat Model Report*