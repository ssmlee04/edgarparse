# EdgarParse API Skill

Use this skill to fetch historical financial filings data (income statements, balance sheets, cash flow statements) for publicly traded US companies via the EdgarParse API, which parses SEC EDGAR filings.

## Trigger

Use this skill when the user asks for:
- Historical financial data for a stock/company
- Income statement, balance sheet, or cash flow data
- Revenue, earnings, EPS, debt, or cash flow history
- SEC filing data or GAAP financials

## API Reference

**Base URL:** `https://api.edgarparse.com/v1`

**Authentication:** Append `?api_key=YOUR_API_KEY` to any request. Without a key, free-tier access covers 50 major tickers (8 quarterly or 3 annual periods). Get a key at https://edgarparse.com/login

---

### Endpoints

#### Income Statement
```
GET https://api.edgarparse.com/v1/{ticker}/income?period={quarterly|annual}&api_key={key}
```
Returns: revenue, gross profit, operating income, net income, EPS (basic/diluted), share counts.

#### Balance Sheet
```
GET https://api.edgarparse.com/v1/{ticker}/balance?period={quarterly|annual}&api_key={key}
```
Returns: total assets, liabilities, equity, cash, debt, receivables, and other balance sheet items.

#### Cash Flow Statement
```
GET https://api.edgarparse.com/v1/{ticker}/cashflow?period={quarterly|annual}&api_key={key}
```
Returns: operating, investing, and financing cash flows, capex, stock buybacks, dividends, net change in cash.

#### List Free Tickers
```
GET https://api.edgarparse.com/free-tickers
```
Returns the 50 tickers available without an API key.

#### List All Tickers
```
GET https://api.edgarparse.com/all-tickers
```
Returns all tickers tracked by EdgarParse.

---

### Response Format

All financial endpoints return JSON:

```json
{
  "ticker": "AAPL",
  "period": "quarterly",
  "periods": ["2024-09-30", "2024-06-30", "2024-03-31", ...],
  "line_items": [
    {
      "concept": "us-gaap:Revenues",
      "label": "Revenue",
      "values": [94930000000, 85777000000, 90753000000, ...],
      "is_bold": false,
      "format": "currency"
    }
  ]
}
```

- `periods`: dates in descending order (most recent first)
- `values`: parallel array to `periods` — `values[i]` corresponds to `periods[i]`
- `format`: `"currency"` | `"per_share"` | `"shares"`
- `is_bold`: `true` for subtotal/total rows

---

## Usage Steps

1. **Check if the ticker is available for free** (optional): `GET https://api.edgarparse.com/free-tickers`
2. **Fetch the desired statement** using the ticker and period type.
3. **Parse `line_items`** — zip `periods` with each item's `values` to build a time series.
4. Present data clearly, noting that values are in raw units (e.g., dollars, not millions) unless the user's context suggests otherwise.

## Example

Fetch Apple's last 8 quarters of income data:
```
GET https://api.edgarparse.com/v1/AAPL/income?period=quarterly
```

Fetch Tesla's annual balance sheet:
```
GET https://api.edgarparse.com/v1/TSLA/balance?period=annual
```

## Notes

- Data is sourced from SEC EDGAR filings (10-Q, 10-K) and normalized to US GAAP concepts.
- Free tier: 50 tickers, up to 8 quarterly or 3 annual periods.
- Paid tier: all tickers, expanded history.
- The ticker in the URL is case-insensitive.
