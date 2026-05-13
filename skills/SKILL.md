---
name: edgarparse
description: Use this skill whenever the user asks about historical financial data, earnings, revenue, profit, debt, cash flow, or any financial metrics for a publicly traded US company — even if they don't mention "edgarparse" or "API." Trigger proactively on any question that could be answered with SEC filing data.
---

# EdgarParse API Skill

Fetch structured historical financial data for US public companies via the EdgarParse API, which parses SEC EDGAR 10-Q and 10-K filings into clean JSON — no scraping, no multiplier guessing.

**API key:** https://edgarparse.com/login — free tier covers 50 major tickers, up to 8 quarterly or 3 annual periods.

## Endpoints

Base URL: `https://api.edgarparse.com/v1`

| What you need | Endpoint |
|---|---|
| Revenue, profit, EPS | `GET /v1/{ticker}/income` |
| Assets, debt, equity, cash | `GET /v1/{ticker}/balance` |
| Operating/investing/financing cash | `GET /v1/{ticker}/cashflow` |
| Check free-tier tickers | `GET /free-tickers` |

Add `?period=quarterly` (default) or `?period=annual`, and `&api_key=YOUR_KEY`.

## Response

```json
{
  "ticker": "AAPL",
  "period": "quarterly",
  "periods": ["2024-09-30", "2024-06-30", "2024-03-31"],
  "line_items": [
    {
      "concept": "us-gaap:Revenues",
      "label": "Revenue",
      "values": [94930000000, 85777000000, 90753000000],
      "format": "currency",
      "is_bold": false
    }
  ]
}
```

`periods[i]` pairs with `values[i]` — zip them to get a time series. `format` is `"currency"`, `"per_share"`, or `"shares"`. Values are raw dollars (not in millions).

## Steps

1. **Map to ticker** — if the user named a company, resolve it (Apple → AAPL, Tesla → TSLA).
2. **Pick one endpoint** — income for P&L questions, balance for assets/debt, cashflow for cash generation. Only call multiple if the user needs data that spans statements.
3. **Fetch quarterly by default** — switch to annual only if the user asks or if quarterly data would be too granular.
4. **Present as a table** — zip `periods` + `values` for the relevant line items, format large numbers (e.g. $94.9B), and highlight the trend.

Avoid fetching all three endpoints speculatively — it's slower and most questions need only one.
