# Changelog

## [0.2.0] - 2026-01-19

### Added
- Aggregate component integration for O(log n) contact counting by userGroup
- `backfillContactAggregate` mutation for migrating existing data
- Vite/Vercel setup for example demo deployment

### Changed
- Replaced all unbounded `.collect()` calls with bounded `.take(limit)` queries
- Updated example app with API key input and comprehensive demo UI
- Improved type exports using `api.lib` instead of `internal.lib`

### Fixed
- Potential read limit errors on large datasets

## [0.1.21] - Previous

- Cursor-based pagination using paginator helper
- Initial release features
