# Troubleshooting filing parse issues

To investigate a parsing problem for a specific company and period (e.g. AAPL 2026-03-31):

1. Add an entry to `scripts/filings.json`:
   ```json
   { "ticker": "aapl", "cik": "320193", "period": "2026-03-31" }
   ```
2. Run `npm run download` — fetches the raw filing from EDGAR into `data/txt/`
3. Run `npm run gen-mocks` — parses the filing and writes the result to `test/mock/`
4. Inspect `test/mock/html/{form-type}/income-{cik}-{period}.txt` or the equivalent XBRL mock
5. Debug with `npx ts-node` to trace the processor directly on the raw file
6. Fix the issue and re-run `npm run gen-mocks -- --force` to verify
