# Submission Guide

Before submission, provide a package that can be reviewed and run independently:

```text
submission/
├── source/
├── deployment/
├── SECURITY.md
├── THREAT-MODEL.md
├── HARDENING.md
└── TEST-EVIDENCE/
```

The package should keep the normal business workflows available. Include the commands needed to build, reset the database, run the application, and execute your verification evidence.

`HARDENING.md` is the security hardening register. Use your own IDs rather than relying on challenge identifiers:

```text
| ID | Finding | Risk | Change | Verification | Residual Risk |
|----|---------|------|--------|--------------|---------------|
```

Document both seeded issues you remediate and additional security weaknesses you discover. A tool report is useful evidence, but it is not a finding until you explain its consequence and verify the remediation.
