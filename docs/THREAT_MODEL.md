# Threat Model

## Overview

This document outlines the threat model for Spectyra, identifying potential security threats and the mitigations in place.

## Threat Categories

### 1. Unauthorized Access

**Threat**: Attacker gains unauthorized access to organization data or resources.

**Attack Vectors**:
- Stolen API keys
- Weak authentication
- Session hijacking
- Cross-tenant data access

**Mitigations**:
- ✅ Strong tenant isolation (enforced server-side)
- ✅ API key expiration and IP restrictions
- ✅ RBAC with role hierarchy
- ✅ JWT authentication with Supabase
- ✅ API key scopes for fine-grained access
- ✅ Audit logging for access monitoring

### 2. Data Leakage

**Threat**: Sensitive data (prompts, responses, API keys) is exposed.

**Attack Vectors**:
- Database breaches
- Unencrypted storage
- Logging sensitive data
- Cross-tenant data access

**Mitigations**:
- ✅ Default "no prompt storage" (privacy-first)
- ✅ Provider keys encrypted at rest (AES-256-GCM)
- ✅ API keys hashed (argon2id)
- ✅ Strong tenant isolation
- ✅ Secure logging (redaction of sensitive data)
- ✅ Encrypted database connections

### 3. Injection Attacks

**Threat**: Attacker injects malicious code or SQL.

**Attack Vectors**:
- SQL injection
- NoSQL injection
- Command injection

**Mitigations**:
- ✅ Parameterized queries (PostgreSQL)
- ✅ Input validation
- ✅ ORM/query builder (prevents SQL injection)
- ✅ Content Security Policy (CSP) headers

### 4. Denial of Service (DoS)

**Threat**: Attacker overwhelms the system, making it unavailable.

**Attack Vectors**:
- Rate limit bypass
- Resource exhaustion
- DDoS attacks

**Mitigations**:
- ✅ Rate limiting (token bucket per org/project/API key)
- ✅ Request size limits (10MB)
- ✅ IP restrictions for API keys
- ✅ Burst control

### 5. Man-in-the-Middle (MITM)

**Threat**: Attacker intercepts or modifies traffic.

**Attack Vectors**:
- Unencrypted connections
- Certificate spoofing
- DNS hijacking

**Mitigations**:
- ✅ TLS 1.2+ for all connections
- ✅ HTTPS enforcement
- ✅ Certificate pinning (where applicable)
- ✅ Encrypted database connections

### 6. Key Theft

**Threat**: Attacker steals API keys or provider keys.

**Attack Vectors**:
- Logging keys in plaintext
- Unencrypted storage
- Key exposure in code/config

**Mitigations**:
- ✅ API keys hashed (never stored in plaintext)
- ✅ Provider keys encrypted at rest
- ✅ Keys shown only once on creation
- ✅ Secret scanning in CI (gitleaks)
- ✅ Key rotation support

### 7. Privilege Escalation

**Threat**: Attacker gains higher privileges than intended.

**Attack Vectors**:
- Role manipulation
- Bypassing RBAC
- API key scope escalation

**Mitigations**:
- ✅ RBAC with role hierarchy
- ✅ Server-side role enforcement
- ✅ API key scopes (fine-grained)
- ✅ Audit logging for privilege changes
- ✅ Middleware enforcement (`requireOrgRole`, `requireScope`)

### 8. Data Exfiltration

**Threat**: Attacker exports or copies sensitive data.

**Attack Vectors**:
- Unauthorized data export
- API abuse
- Cross-tenant queries

**Mitigations**:
- ✅ Export restricted to OWNER/ADMIN
- ✅ Audit logging for exports
- ✅ Tenant isolation (prevents cross-tenant access)
- ✅ Rate limiting (prevents bulk export abuse)

### 9. Supply Chain Attacks

**Threat**: Attacker compromises dependencies or build process.

**Attack Vectors**:
- Malicious npm packages
- Compromised CI/CD
- Dependency vulnerabilities

**Mitigations**:
- ✅ Dependency audit in CI (`pnpm audit`)
- ✅ OSV scanner for vulnerabilities
- ✅ SBOM generation (CycloneDX)
- ✅ npm Trusted Publishing (OIDC)
- ✅ CodeQL static analysis

### 10. Insufficient Logging

**Threat**: Security incidents go undetected due to lack of logging.

**Attack Vectors**:
- Silent failures
- Missing audit trails
- Log tampering

**Mitigations**:
- ✅ Comprehensive audit logging
- ✅ Security-relevant events logged
- ✅ Export capability for compliance
- ✅ Immutable audit logs (database-level)

## Security Controls Summary

### Authentication & Authorization
- JWT authentication (Supabase)
- API key authentication (argon2id hashing)
- RBAC with 5 roles
- API key scopes
- SSO support (Supabase)

### Data Protection
- Default "no prompt storage"
- Provider keys encrypted (AES-256-GCM)
- API keys hashed (argon2id)
- Encrypted database connections
- TLS for all API communication

### Access Controls
- Strong tenant isolation
- IP restrictions for API keys
- Origin restrictions for API keys
- Domain allowlist for organizations
- SSO enforcement

### Monitoring & Compliance
- Comprehensive audit logging
- Export capability (CSV)
- Data retention policies
- Security event tracking

### Infrastructure
- Security headers (helmet)
- CORS hardening
- Rate limiting
- Request size limits

### Development
- CI security gates
- Dependency scanning
- Secret scanning
- CodeQL analysis
- SBOM generation

## Risk Assessment

### High Risk Areas
1. **Provider Key Storage**: Mitigated by encryption and BYOK option
2. **Cross-Tenant Access**: Mitigated by strong tenant isolation
3. **Key Theft**: Mitigated by hashing, encryption, and secret scanning

### Medium Risk Areas
1. **DoS Attacks**: Mitigated by rate limiting and IP restrictions
2. **Privilege Escalation**: Mitigated by RBAC and audit logging
3. **Data Exfiltration**: Mitigated by export controls and audit logging

### Low Risk Areas
1. **Injection Attacks**: Mitigated by parameterized queries
2. **MITM Attacks**: Mitigated by TLS and HTTPS enforcement
3. **Supply Chain**: Mitigated by CI security gates

## Continuous Improvement

### Regular Reviews
- Quarterly threat model review
- Annual security audit
- Dependency updates
- Security header updates

### Monitoring
- Audit log analysis
- Anomaly detection (future)
- Security incident response

## Reporting Security Issues

See the [Security Policy](../.github/SECURITY.md) for vulnerability reporting.

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [SOC 2 Controls](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/aicpasoc2report.html)
