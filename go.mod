module github.com/JaimeStill/spike-html-go-wasm

go 1.27

// The build's output is never a package: ./... skips it, so the check's go commands never walk
// dist/ while Vite empties it in parallel (mise run check).
ignore ./dist

require (
	github.com/standards-lab/go-core v0.12.0
	github.com/standards-lab/go-web-sdk v0.17.0
	github.com/standards-lab/sqlate v0.7.0
	github.com/standards-lab/sqlate/postgres v0.7.0
)

require (
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/pgx/v5 v5.13.0 // indirect
	golang.org/x/text v0.41.0 // indirect
)
