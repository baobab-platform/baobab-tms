# HYB-01: pinned Composer installation and native Fleet-Ops migrations

**HELD pending connected test results, legal approval and supplier/runtime security qualification.** This increment builds on merged PR #17.

The workflow installs the exact upstream 237-package Composer lock with supported PHP 8.2.35+, no dependency updates, and no Docker build arguments containing tokens. It checks the installed Fleet-Ops package identity and attempts Laravel package discovery and native Fleet-Ops migrations against two disposable MySQL 8.0.44 instances exposed only to the CI runner's localhost. Native orders, drivers and vehicles tables must be independently verified in both databases.

The Fleetbase vendor registry and transitive packages may require protected credentials. An installation or migration failure is **not** evidence of an approved runtime and should block merging this PR until corrected or explicitly documented as a blocked qualification attempt. No seeded real clients, dispatch or external carrier operation is permitted.

A preliminary CycloneDX 1.5 source-lock inventory is generated. It is **not a signed/installed artifact SBOM**, does not resolve any CVE or transitive AGPL/licence risk, and cannot certify a production image. A Composer audit warning keeps release admission HELD even if engineering tests pass. CP/IAM native execution, queue/scheduler, legal/commercial licensing, sovereign market context, security review and application image are still outstanding.

## First native Composer/migration findings

GitHub Actions successfully installed the pinned Fleetbase Composer dependency graph and found the locked Fleet-Ops artifact. The first actual Laravel migration run then reported `SQLSTATE[HY000] [1049] Unknown database 'fleetbase_a_storefront'`, proving that Fleetbase's Storefront extension uses a distinct MySQL database connection derived from the primary database name. The revised CI provisions independent `fleetbase_a_storefront` and `fleetbase_b_storefront` databases on their respective synthetic tenant's MySQL 8 server before native migrations. This finding and remediation are **not** evidence of full migration success until the latest workflow passes. Keep all other extension and application runtime requirements separately qualified.
