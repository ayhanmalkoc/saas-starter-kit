# Release Checklist

Use this checklist before cutting a release.

## Build and warning gates

- [ ] `npm run build` completes for release environment configuration.
- [ ] Build output does **not** include the browser baseline warning (`outdated dataset currency`).
- [ ] Build output does not contain new untriaged warnings compared to the previous release baseline.

## Dependency hygiene

- [ ] Browser baseline dependency chain (`autoprefixer` → `browserslist` → `baseline-browser-mapping`) is within SLA (updated within the last 30 days of upstream release).
- [ ] Dependabot PRs for the `browser-baseline` group (`autoprefixer`) are reviewed and either merged or explicitly deferred with rationale.
