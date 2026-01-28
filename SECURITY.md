# Security Policy

## Supported Versions

We actively support security updates for the latest stable version of Spectyra.

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please report it to us as described below.

### How to Report

**Email:** security@spectyra.com

Please include the following information in your report:

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- The location of the affected code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Initial Assessment**: We will provide an initial assessment within 7 days
- **Updates**: We will keep you informed of our progress every 7-10 days
- **Resolution**: We will notify you when the vulnerability is resolved

### Disclosure Policy

- We will work with you to understand and resolve the issue quickly
- We will credit you for the discovery (if desired)
- We will not take legal action against security researchers who:
  - Act in good faith
  - Do not access or modify data that does not belong to them
  - Do not violate any laws or breach any agreements
  - Do not cause harm to our users or systems

### Out of Scope

The following are considered out of scope for security reporting:

- Denial of Service (DoS) attacks
- Social engineering attacks
- Physical attacks
- Issues requiring physical access to a user's device
- Issues in third-party applications or services
- Issues that require unrealistic user interaction
- Missing security headers without a demonstrated security impact
- Self-XSS (cross-site scripting)
- Issues related to software version disclosure

## Security Best Practices

### For Users

- Keep your API keys secure and never commit them to version control
- Use environment variables for sensitive configuration
- Regularly rotate your API keys
- Use IP restrictions for API keys when possible
- Enable audit logging for compliance requirements
- Review audit logs regularly

### For Developers

- Follow secure coding practices
- Keep dependencies up to date
- Use the latest version of Spectyra
- Review security advisories regularly
- Report vulnerabilities responsibly

## Security Features

Spectyra implements enterprise-grade security controls:

- **Strong Tenant Isolation**: Every request is scoped to organization/project
- **RBAC + Scopes**: Role-based access control and fine-grained API key scopes
- **Audit Logging**: Complete audit trail for security-relevant events
- **Encrypted Provider Keys**: Provider API keys encrypted at rest using AES-256-GCM
- **Data Retention Controls**: Configurable retention policies, "no prompt storage" by default
- **Rate Limiting**: Per-organization/project/API key rate limiting
- **Security Headers**: Hardened CORS, CSP, and security headers
- **CI Security Gates**: Automated dependency scanning, CodeQL, secret scanning, SBOM generation

For more details, see:
- [docs/ENTERPRISE_SECURITY.md](docs/ENTERPRISE_SECURITY.md) - Complete enterprise security guide
- [docs/DATA_HANDLING.md](docs/DATA_HANDLING.md) - Data handling and storage policies
- [docs/RETENTION.md](docs/RETENTION.md) - Data retention policies

## Security Updates

Security updates are released as part of our regular release cycle. Critical security vulnerabilities may result in out-of-cycle releases.

Subscribe to security advisories:
- GitHub Security Advisories: https://github.com/spectyra/spectyra/security/advisories
- Email: security@spectyra.com

## Contact

For security-related questions or concerns, please contact:
- **Email**: security@spectyra.com
- **PGP Key**: [Available upon request]
