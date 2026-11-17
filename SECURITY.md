# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## 🔒 Security Architecture

PROS is designed with privacy and security as first-class guarantees:

- **Local-First Isolation**: By default, all character progression, journal entries, and activity logs are stored entirely client-side in the browser's IndexedDB. No remote servers receive data unless cloud sync is intentionally configured.
- **Credential Hygiene**: The client application contains no administrative secrets or service account keys. Cloud integration (Firebase) uses scoped security rules (`firestore.rules`) enforcing user-level document isolation (`request.auth.uid == userId`).
- **Offline Integrity**: Revision vectors, rollback snapshots, and cryptographic asset verification prevent data tampering or corruption during offline/online synchronization.

---

## 🛡️ Reporting a Vulnerability

If you discover a security vulnerability within PROS, please do not disclose it publicly via GitHub issues.

Instead, please send an email to **revaan.mishra@gmail.com** (or reach out via the GitHub security advisory feature) with:
1. A description of the issue and potential impact.
2. Reproduction steps or proof of concept.
3. Any mitigations you have identified.

You will receive an acknowledgment within 48 hours, followed by updates regarding remediation and public disclosure timelines.
