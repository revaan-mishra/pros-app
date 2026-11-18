# Security policy

PROS stores records in the current browser first. If an account build is configured for Firebase, records can synchronize to the account's private Firestore paths. The app stores drafts and local recovery snapshots in browser storage. JSON backup files are readable and can include journal text.

A hosted deployment should use compatible client and Firestore Rules revisions. The [cloud operations guide](docs/CLOUD-OPERATIONS.md) describes how access, revisions, conflicts, and account removal work. Check the [release checklist](docs/RELEASE-CHECKLIST.md) for the current validation scope.

## Report a vulnerability

Contact the maintainer at [revaan.mishra@gmail.com](mailto:revaan.mishra@gmail.com). Include the affected commit, a short description, and the impact. Use a sample profile or a demo emulator for any examples. Keep passwords, tokens, live account records, and private journal text out of reports. Report security issues privately before opening a public issue.
