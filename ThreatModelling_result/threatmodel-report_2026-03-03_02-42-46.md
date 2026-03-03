# Automated Threat Modeling and Security Scan Report

**Repository:** target-repo
**Organization:** mbbgrp
**Report Date:** 2026-03-03
**Report Version:** tm-scan v1.0.0
**Report ID:** 20260303_024244
**Report Classification:** Confidential

## Architecture Overview

```mermaid
flowchart TD
    attacker((Threat Actor))
    app[Application]
    db[(Database)]
    attacker -->|TM-CRYPTO-001,TM-PRIV-001,TM-AUTH-002,TM-BIZ-001| app
    app -->|Data Flows| db
    classDef highRisk fill:#ffcccc,stroke:#cc0000;
    class app highRisk;
    class attacker highRisk;
    class db highRisk;
```

## Scan Metadata

- **Scan Mode:** quick
- **Since Days:** 30
- **Git Depth:** 1

## Executive Summary

**Overall Risk Level:** High

- **Total Evidence Findings:** 506
- **Rule Hits:** 12
- **High-Priority Keywords:** 117
- **Secret Findings (gitleaks):** 0
- **Total Packages (SBOM):** 0
- **OpenAPI Specs Found:** 0
- **DB Migration Files:** 8

### Risk Level Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 7 |
| MEDIUM | 1 |
| LOW | 0 |

### STRIDE Distribution

| STRIDE Category | Count |
|-----------------|-------|
| Spoofing | 0 |
| Tampering | 1 |
| Repudiation | 0 |
| Information Disclosure | 2 |
| Denial of Service | 1 |
| Elevation of Privilege | 0 |

<div class="page-break"></div>

## Detailed Threat Models

### [TM-CRYPTO-001] Broken / Weak Cryptography (MD5/SHA1/DES/ECB) for Secrets or Sensitive Data
**STRIDE Category:** Information Disclosure | **Default Impact:** High | **CWE References:** N/A

**Description:**
Use of outdated hashing/encryption algorithms or insecure modes enables offline cracking and data compromise.

**Evidence:**
No rule-based evidence captured.

**Recommended Controls:**
- Ban weak algorithms by policy/lint
- Use AEAD modes (AES-GCM)
- Centralize crypto utilities and key management (KMS/HSM)

**Questions for Review:**
- Are passwords stored using bcrypt/Argon2 with per-user salts?
- Is any AES used in ECB/CBC without authentication?

### [TM-PRIV-001] Improper Logging of PII/Secrets (Tokens, Passwords, Full User Objects)
**STRIDE Category:** Information Disclosure | **Default Impact:** High | **CWE References:** N/A

**Description:**
Logs include raw PII (email, SSN, phone), credentials, or tokens, violating privacy and compliance controls.

**Evidence:**
No rule-based evidence captured.

**Recommended Controls:**
- Structured logging + field allowlists
- Redaction middleware for HTTP headers/body
- Secrets scanning on logs and APM payloads

**Questions for Review:**
- Are Authorization headers or tokens ever logged?
- Do we log full request/response bodies in production?

### [TM-AUTH-002] Credential Stuffing / Missing Rate Limiting on Auth Endpoints
**STRIDE Category:** Denial of Service | **Default Impact:** High | **CWE References:** N/A

**Description:**
Authentication endpoints lack throttling and abuse protections, enabling credential stuffing and resource exhaustion.

**Evidence:**
No rule-based evidence captured.

**Recommended Controls:**
- IP + account throttling
- Credential stuffing detection (known breached passwords, velocity checks)
- Step-up MFA for risky logins

**Questions for Review:**
- Do we throttle by IP and by account identifier?
- Do we have lockout/backoff and 2FA/step-up flows?

### [TM-BIZ-001] Client-Side Trust of Financial Fields (Price/Quantity/Risk Score Manipulation)
**STRIDE Category:** Tampering | **Default Impact:** Critical | **CWE References:** N/A

**Description:**
Server trusts client-supplied price/quantity/risk fields, enabling fraud by parameter tampering.

**Evidence:**
No rule-based evidence captured.

**Recommended Controls:**
- Server-side recalculation of totals and risk
- Signed quotes and expiry for price offers
- Fraud monitoring for abnormal deltas

**Questions for Review:**
- Do we ever persist client-provided totals or risk scores?
- Are promotions/coupons validated server-side?

## Asset/Flow Inventory

| Asset/Flow | Confidentiality | Integrity | Availability | Sensitivity | Evidence | Notes |
|------------|-----------------|-----------|--------------|-------------|----------|-------|
| User Data (USERS table) | High | High | Medium | High | 60 reference(s) | Contains PII - check for encryption |
| Database (postgres) | High | High | High | High | 12 reference(s) | Check connection string security |
| Database (users) | High | High | High | High | 60 reference(s) | Check connection string security |
| Database (postgresql) | High | High | High | High | 9 reference(s) | Check connection string security |
| Risk Assessment Engine | Medium | High | High | High | 3 reference(s) | PATCH-SPECIFIC: Verify server-side calculation |
| Date/Time Validation | Low | High | Medium | Medium | 46 reference(s) | PATCH-SPECIFIC: Verify server-side validation |
| Authentication System | Medium | High | High | High | 5 type(s) | session, password, login, jwt, authenticate |

## Threat Analysis

| Threat | STRIDE Category | Likelihood | Impact | Priority | Evidence | Recommended Controls | Questions to Confirm |
|--------|-----------------|------------|--------|----------|----------|----------------------|----------------------|
| Broken / Weak Cryptography (MD5/SHA1/DES/ECB) for Secrets or Sensitive Data | Information Disclosure | Medium | High | TBD | keywords: 2, rules: 0 | Ban weak algorithms by policy/lint; Use AEAD mo... | Are passwords stored using bcrypt/Argon2 with p... |
| Improper Logging of PII/Secrets (Tokens, Passwords, Full User Objects) | Information Disclosure | High | High | TBD | keywords: 2, rules: 0 | Structured logging + field allowlists; Redactio... | Are Authorization headers or tokens ever logged? |
| Credential Stuffing / Missing Rate Limiting on Auth Endpoints | Denial of Service | High | High | TBD | keywords: 1, rules: 0 | IP + account throttling; Credential stuffing de... | Do we throttle by IP and by account identifier? |
| Client-Side Trust of Financial Fields (Price/Quantity/Risk Score Manipulation) | Tampering | High | Critical | TBD | keywords: 1, rules: 0 | Server-side recalculation of totals and risk; S... | Do we ever persist client-provided totals or ri... |

## STRIDE Analysis

### Spoofing

**Indicators Found (118):**
- authenticate
- jwt
- login
- password
- session
- ... and 108 more

### Tampering

**Indicators Found (32):**
- 1h
- 24h
- 4h
- 7d
- risk_score
- ... and 22 more

### Repudiation

**Indicators Found (43):**
- console.log
- logger.
- print(
- ... and 33 more

### Information Disclosure

**Indicators Found (100):**
- api_key
- apikey
- password=
- postgres
- postgresql
- secret
- users
- ... and 90 more

## Recommendations

### [HIGH] Review 117 high-priority code patterns

Patch-specific keywords detected. Verify server-side validation and business logic enforcement.

### [HIGH] Review database connection security

Ensure credentials are stored in environment variables or a secret manager. Use least-privilege database accounts.

### [MEDIUM] Verify authentication/authorization implementation

118 auth-related indicators found. Ensure MFA, proper session management, and JWT validation.

### [LOW] Implement comprehensive audit logging

Log all security-relevant events with user identity, timestamp, and action. Ensure logs are tamper-evident.

## Questions for Security Reviewers

Please confirm the following during review:

1. Do we ever persist client-provided totals or risk scores?
2. Are promotions/coupons validated server-side?
3. Do we throttle by IP and by account identifier?
4. Do we have lockout/backoff and 2FA/step-up flows?
5. Are Authorization headers or tokens ever logged?
6. Do we log full request/response bodies in production?
7. Are passwords stored using bcrypt/Argon2 with per-user salts?
8. Is any AES used in ECB/CBC without authentication?
9. Are risk scores calculated server-side only?
10. Are database credentials stored in a secret manager or environment variables?
11. Is MFA implemented for sensitive operations?
12. Are JWT signatures validated on every request?

---

*Report generated by tm-scan v1.0.0 on 2026-03-03 02:42:45*
*This is an automated threat model report based on static analysis. Manual review required.*
