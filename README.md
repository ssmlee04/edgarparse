# edgarparse

Parse SEC EDGAR 10-Q filings into structured financial data using inline XBRL (iXBRL) extraction.

Instead of scraping HTML tables, this library reads the machine-readable XBRL facts that are embedded in every modern EDGAR filing. Values are exact (no multiplier guessing), element names are standardized across companies via the `us-gaap:*` taxonomy, and facts come out in statement order ready to render.

## Install

```sh
npm install edgarparse
```

## Usage

Point a processor at a raw EDGAR `.txt` filing (the full submission file downloaded from EDGAR) and call `extract()`.

```ts
import {
    XBRLIncomeQuarterlyProcessor,
    XBRLBalanceQuarterlyProcessor,
    XBRLCashflowQuarterlyProcessor,
} from 'edgarparse';

// Income statement — quarterly + YTD
// First arg is the CIK (stable EDGAR company identifier, never changes unlike tickers)
const income = new XBRLIncomeQuarterlyProcessor();
income.initialize('789019', '2023-09-30');  // reads data/txt/quarterly/789019-2023-09-30.txt
const result = income.extract();

result.quarterly.facts.forEach(f => console.log(f.label, f.value));
// revenue          56517000000
// cost of revenue  16302000000
// gross profit     40215000000
// ...

// Balance sheet
const balance = new XBRLBalanceQuarterlyProcessor();
balance.initialize('789019', '2023-09-30');
const { endDate, facts } = balance.extract();

// Cash flow statement — quarterly + YTD
const cashflow = new XBRLCashflowQuarterlyProcessor();
cashflow.initialize('789019', '2023-09-30');
const cf = cashflow.extract();
```

You can also pass the raw filing string directly instead of reading from disk:

```ts
const raw = fs.readFileSync('./my-filing.txt', 'utf8');
processor.initialize('789019', '2023-09-30', raw);
```

## Output format

```ts
type XBRLFact = {
    concept: string;   // "us-gaap:Revenues" — stable cross-company XBRL identifier
    label: string;     // "revenue" — human-readable label
    value: number;     // actual dollars, fully scaled
    unit: 'USD';
};

type PeriodFacts = {
    startDate: string; // "2023-07-01"
    endDate: string;   // "2023-09-30"
    months: number;    // 3 or 9
    facts: XBRLFact[]; // ordered as they appear in the filing
};

// Income / cashflow processors return:
{ quarterly: PeriodFacts; ytd?: PeriodFacts }

// Balance sheet processor returns:
{ endDate: string; facts: XBRLFact[] }
```

Facts are returned in document order, which matches the statement layout (revenue → gross profit → operating income → net income for the income statement).

## Input data

Raw EDGAR submission files are not committed to this repo (they are large). They should be placed at:

```
data/txt/quarterly/{cik}-{date}.txt
```

To download the filings needed for the test suite:

```sh
npm run download
```

This fetches each filing from SEC EDGAR's public API and saves it to `data/txt/quarterly/`. You only need to run this once. To add your own filing for a different ticker, download it from [EDGAR full-text search](https://efts.sec.gov/LATEST/search-index?q=10-Q&forms=10-Q) and drop the `.txt` file in that directory.

## How it works

Modern 10-Q filings use **inline XBRL (iXBRL)** — XBRL facts are embedded directly in the HTML document via `<ix:nonFraction>` tags. Each tag carries:

- `name` — the XBRL concept (`us-gaap:Revenues`)
- `contextRef` — links to a period definition (`2023-07-01` → `2023-09-30`)
- `scale` — power of 10 (`6` = millions), making the actual value unambiguous
- `sign` — explicit negation flag

The parser filters the 500+ context definitions down to the handful of consolidated (no business-segment dimension) contexts that match the reporting period, then collects all USD facts for those contexts. A concept map converts `us-gaap:*` element names to human-readable labels.

## Test

```sh
npm test
```

To add a new ticker to the test suite, generate a fixture file then re-run:

```ts
const processor = new XBRLIncomeQuarterlyProcessor();
processor.initialize('320193', '2023-09-30');  // 320193 = AAPL's CIK
processor.process(processor.extract(), true);  // writes test/mock/xbrl/quarterly/income-320193-2023-09-30.txt
```

```sh
npm test
```
