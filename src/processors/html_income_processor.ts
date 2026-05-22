import { parse as parseHTML } from 'node-html-parser';
import type { HTMLElement } from 'node-html-parser';
import type { PeriodFacts, XBRLFact } from '../xbrl_types';
import {
    scoreIncomeTable, hasPerShareData, looksLikeCashflow, looksLikeBalanceSheet,
    isIncomeTitle, isQuarterPeriod, isSixMonthPeriod, isNineMonthPeriod, isAnnualPeriod,
    extractMonthDay, extractYear, detectMultiplier, extractValue, labelToConcept,
    deriveStartDate,
} from '../html_helpers';

export type HTMLIncomeResult = {
    quarterly?: PeriodFacts;
    ytd?: PeriodFacts;
};

type PeriodType = 'Q' | '6M' | '9M' | 'A';

// A detected period column range, modelled after _edgar-statement-parser's
// col_left_period / col_right_period / col_left_year / col_right_year pattern.
type PeriodRange = {
    periodType: PeriodType;
    months: number;
    // Range of the period-type header cell (e.g. "Three months ended …")
    periodColLeft: number;
    periodColRight: number;
    // Range of the most-recent-year cell within the period header range.
    // Values are collected when colIdx falls here.
    yearColLeft: number;
    yearColRight: number;
    // Full ISO end date, e.g. "2024-09-30"
    endDate: string;
    year: number;
};

const MAX_TABLES = 300;
const MIN_ROWS = 8;
const MONTHS_FOR: Record<PeriodType, number> = { Q: 3, '6M': 6, '9M': 9, A: 12 };

// ── Document extraction ───────────────────────────────────────────────────────

function extractDocumentSections(content: string): string {
    const re = /<document>([\s\S]*?)<\/document>/gi;
    let result = '';
    let m;
    let count = 0;
    while ((m = re.exec(content)) !== null && count < 5) {
        result += m[1];
        count++;
    }
    return result || content;
}

// ── Table scoring & selection ─────────────────────────────────────────────────

function getContextText(table: HTMLElement): string {
    const parts: string[] = [];
    let el = table.previousElementSibling as HTMLElement | null;
    for (let i = 0; i < 5 && el; i++) {
        parts.push(el.textContent ?? '');
        el = el.previousElementSibling as HTMLElement | null;
    }
    // Traverse up to four ancestor levels to capture multiplier hints that live in
    // enclosing divs (e.g. "Expressed in US $000's" is often 2-4 div levels above the <table>)
    let ancestor = table.parentNode as HTMLElement | null;
    for (let depth = 0; depth < 4 && ancestor; depth++) {
        let pel = ancestor.previousElementSibling as HTMLElement | null;
        for (let i = 0; i < 5 && pel; i++) {
            parts.push(pel.textContent ?? '');
            pel = pel.previousElementSibling as HTMLElement | null;
        }
        ancestor = ancestor.parentNode as HTMLElement | null;
    }
    return parts.join(' ').toLowerCase();
}

function findMultiplier(table: HTMLElement, contextText: string): number {
    const ctxMult = detectMultiplier(contextText);
    if (ctxMult > 1) return ctxMult;

    const rows = table.querySelectorAll('tr');
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        const text = (row.textContent ?? '').toLowerCase();
        // Check the whole row first (fast path for short rows)
        if (text.length <= 300) {
            const m = detectMultiplier(text);
            if (m > 1) return m;
        } else {
            // Row is long (e.g. many GAAP/Non-GAAP columns concatenated); check each cell
            for (const cell of row.querySelectorAll('td, th')) {
                const ct = (cell.textContent ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
                const m = detectMultiplier(ct);
                if (m > 1) return m;
            }
        }
    }
    return 1;
}

// Extract the most recent 4-digit year appearing in a table's header rows.
function tableMaxYear(table: HTMLElement): number {
    let max = 0;
    const rows = table.querySelectorAll('tr');
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const matches = (rows[i].textContent ?? '').match(/\b(20\d{2})\b/g);
        if (matches) {
            for (const m of matches) { const y = parseInt(m, 10); if (y > max) max = y; }
        }
    }
    return max;
}

function selectIncomeTable(tables: HTMLElement[]): { table: HTMLElement | null; multiplier: number } {
    let bestTable: HTMLElement | null = null;
    let bestScore = -1;
    let bestMultiplier = 1;
    let bestYear = 0;
    let hasTitleMatch = false;

    for (let i = 0; i < Math.min(tables.length, MAX_TABLES); i++) {
        const table = tables[i];
        if ((table.querySelectorAll('tr').length) < MIN_ROWS) continue;

        const inner = (table.textContent ?? '').toLowerCase();
        if (looksLikeCashflow(inner) || looksLikeBalanceSheet(inner)) continue;

        const score = scoreIncomeTable(inner);
        if (score < 0.7) continue;

        const isFullTable = score >= 0.99 && hasPerShareData(inner);
        const isLenientFull = score >= 0.7 &&
            (inner.includes('revenue') || inner.includes('net sales')) &&
            (inner.includes('net income') || inner.includes('net loss') || inner.includes('profit'));

        if (!isFullTable && !isLenientFull) continue;

        const contextText = getContextText(table);
        const titleMatch = isIncomeTitle(contextText) || isIncomeTitle(inner);
        const multiplier = findMultiplier(table, contextText);
        const year = tableMaxYear(table);

        // Priority: titleMatch > most-recent year > score > multiplier.
        // Using year before score prevents a prior-year comparison table from winning
        // purely because its column headers happen to contain extra scoring keywords.
        const beats = titleMatch && !hasTitleMatch
            ? true
            : titleMatch === hasTitleMatch && (
                year > bestYear ||
                (year === bestYear && score > bestScore) ||
                (year === bestYear && score === bestScore && multiplier > bestMultiplier)
            );

        if (beats) {
            hasTitleMatch = hasTitleMatch || titleMatch;
            bestTable = table;
            bestScore = score;
            bestMultiplier = multiplier;
            bestYear = year;
        }
    }

    return { table: bestTable, multiplier: bestMultiplier };
}

// ── Column / rowspan tracker ──────────────────────────────────────────────────

function buildRowCursors(numRows: number) {
    const cursors: number[] = new Array(numRows).fill(0);
    const skips: Set<number>[] = Array.from({ length: numRows }, () => new Set<number>());

    function advance(ri: number) {
        while (skips[ri].has(cursors[ri])) cursors[ri]++;
        return cursors[ri];
    }

    function consume(ri: number, colspan: number, rowspan: number) {
        const col = cursors[ri];
        if (rowspan > 1) {
            for (let rr = ri + 1; rr < ri + rowspan && rr < numRows; rr++) {
                for (let cc = col; cc < col + colspan; cc++) skips[rr].add(cc);
            }
        }
        cursors[ri] += colspan;
    }

    return { advance, consume };
}

// ── Period range builder ──────────────────────────────────────────────────────

function buildPeriodRanges(table: HTMLElement): PeriodRange[] {
    const rows = table.querySelectorAll('tr');
    const numRows = rows.length;
    const { advance, consume } = buildRowCursors(numRows);

    // Intermediate state: period headers detected but year not yet found
    type Pending = {
        periodType: PeriodType;
        periodColLeft: number;
        periodColRight: number;
        mmdd: string | null; // extracted from same cell as period type
    };
    const pending: Pending[] = [];

    // Final detected ranges (one per period type, keeping most-recent year)
    const ranges: Map<PeriodType, PeriodRange> = new Map();

    const HEADER_SCAN_LIMIT = Math.min(numRows, 15);

    for (let ri = 0; ri < HEADER_SCAN_LIMIT; ri++) {
        const row = rows[ri];
        const tds = row.querySelectorAll('td, th');

        for (let ci = 0; ci < tds.length; ci++) {
            const td = tds[ci];
            const colIdx = advance(ri);
            const colspanStr = td.getAttribute('colspan');
            const rowspanStr = td.getAttribute('rowspan');
            const colspan = colspanStr ? parseInt(colspanStr, 10) : 1;
            const rowspan = rowspanStr ? parseInt(rowspanStr, 10) : 1;
            const text = (td.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

            // 1. Detect period type in this cell
            let detectedType: PeriodType | null = null;
            if (isQuarterPeriod(text)) detectedType = 'Q';
            else if (isSixMonthPeriod(text)) detectedType = '6M';
            else if (isNineMonthPeriod(text)) detectedType = '9M';
            else if (isAnnualPeriod(text)) detectedType = 'A';

            if (detectedType !== null) {
                const mmdd = extractMonthDay(text);
                const year = extractYear(text);
                if (mmdd && year) {
                    // Complete date in the same cell — record immediately
                    const endDate = `${year}-${mmdd}`;
                    const existing = ranges.get(detectedType);
                    if (!existing || year > existing.year) {
                        ranges.set(detectedType, {
                            periodType: detectedType,
                            months: MONTHS_FOR[detectedType],
                            periodColLeft: colIdx,
                            periodColRight: colIdx + colspan,
                            yearColLeft: colIdx,
                            yearColRight: colIdx + colspan,
                            endDate,
                            year,
                        });
                    }
                } else {
                    // Date/year in a later row — register as pending
                    pending.push({
                        periodType: detectedType,
                        periodColLeft: colIdx,
                        periodColRight: colIdx + colspan,
                        mmdd,
                    });
                }
            }

            // 1b. If this cell has only a month-day (no year) and falls within a pending
            // period's column range, update that pending entry's mmdd. This handles
            // 3-row headers where month-day and year are in separate rows, e.g.:
            //   row 1: "Three Months Ended"
            //   row 2: "April 26,"   "April 27,"
            //   row 3: "2026"        "2025"
            const intermediateMmdd = extractMonthDay(text);
            if (intermediateMmdd && !extractYear(text)) {
                for (const p of pending) {
                    if (colIdx >= p.periodColLeft && colIdx < p.periodColRight && !p.mmdd) {
                        p.mmdd = intermediateMmdd;
                    }
                }
            }

            // 2. Check if this cell is a year cell under a pending period header
            const year = extractYear(text);
            if (year) {
                for (const p of pending) {
                    if (colIdx >= p.periodColLeft && colIdx < p.periodColRight) {
                        const mmdd = p.mmdd ?? extractMonthDay(text);
                        const endDate = mmdd ? `${year}-${mmdd}` : `${year}-12-31`;
                        const existing = ranges.get(p.periodType);
                        if (!existing || year > existing.year) {
                            ranges.set(p.periodType, {
                                periodType: p.periodType,
                                months: MONTHS_FOR[p.periodType],
                                periodColLeft: p.periodColLeft,
                                periodColRight: p.periodColRight,
                                yearColLeft: colIdx,
                                yearColRight: colIdx + colspan,
                                endDate,
                                year,
                            });
                        }
                    }
                }
            }

            consume(ri, colspan, rowspan);
        }
    }

    return Array.from(ranges.values());
}

// ── Row data extraction ───────────────────────────────────────────────────────

type RowData = {
    label: string;
    isSectionTotal: boolean; // true = label came from a preceding section header (e.g. "revenues" total row)
    values: Map<PeriodType, number | null>;
    isPerShare: boolean;
};

function extractRows(table: HTMLElement, ranges: PeriodRange[], multiplier: number): RowData[] {
    const rows = table.querySelectorAll('tr');
    const numRows = rows.length;
    const { advance, consume } = buildRowCursors(numRows);
    const results: RowData[] = [];
    let isInPerShareSection = false;
    // Tracks section header labels (e.g. "revenues") for unlabelled total rows that follow
    let lastSectionLabel: string | null = null;

    for (let ri = 0; ri < numRows; ri++) {
        const row = rows[ri];
        const tds = row.querySelectorAll('td, th');
        let label: string | null = null;
        const valuesByPeriod = new Map<PeriodType, number | null>();

        for (let ci = 0; ci < tds.length; ci++) {
            const td = tds[ci];
            const colIdx = advance(ri);
            const colspanStr = td.getAttribute('colspan');
            const rowspanStr = td.getAttribute('rowspan');
            const colspan = colspanStr ? parseInt(colspanStr, 10) : 1;
            const rowspan = rowspanStr ? parseInt(rowspanStr, 10) : 1;
            const text = (td.textContent ?? '').replace(/\s+/g, ' ').trim();

            // "in period" = anywhere within the period header span (includes prior-year columns)
            // "in year range" = only the current-year value columns
            const inPeriod = ranges.some(r => colIdx >= r.periodColLeft && colIdx < r.periodColRight);
            const inAnyRange = ranges.some(r => colIdx >= r.yearColLeft && colIdx < r.yearColRight);

            // Label detection: first non-empty cell that is NOT within any period column span
            // AND does not look like a number (prior-year value columns that sit outside the
            // current-year period range would otherwise be mistaken for labels).
            // "(822,299)" → "(822299)" starts with ( then digit → value
            // "(Loss) income…" → "(Loss)…" starts with ( then letter → label
            const stripped = text.replace(/[\s,]/g, '');
            const looksLikeValue = stripped.length > 0 && /^\(?\d/.test(stripped);
            if (label === null && !inPeriod && text && !looksLikeValue) {
                label = text;
                // Update per-share status immediately so value cells in the same row use it
                const ll = label.toLowerCase();
                if (ll.includes('per share') || ll.includes('per common share')) isInPerShareSection = true;
                if (ll.includes('weighted') || ll.includes('shares outstanding') || ll.includes('shares used')) isInPerShareSection = true;
                if (
                    isInPerShareSection && !ll.includes('per share') && !ll.includes('weighted') &&
                    !ll.includes('basic') && !ll.includes('diluted') && !ll.includes('shares') &&
                    (ll.includes('revenue') || ll.includes('income') || ll.includes('expense'))
                ) isInPerShareSection = false;
            }

            // Value collection: always collect from range columns, regardless of whether label is set.
            // This handles unlabelled total rows (e.g. revenue total under "revenues" header).
            if (inAnyRange) {
                for (const r of ranges) {
                    if (colIdx >= r.yearColLeft && colIdx < r.yearColRight) {
                        if ((valuesByPeriod.get(r.periodType) ?? null) === null) {
                            let cellText = text;
                            // Handle split-cell negatives: "(1234" + ")" in next sibling cell
                            if (cellText.startsWith('(') && !cellText.endsWith(')') && ci + 1 < tds.length) {
                                const nextText = (tds[ci + 1].textContent ?? '').trim();
                                if (nextText === ')' || nextText.startsWith(')')) cellText = cellText + ')';
                            }
                            const effectiveMult = isInPerShareSection ? 1 : multiplier;
                            const val = extractValue(cellText, effectiveMult);
                            if (val !== null) valuesByPeriod.set(r.periodType, val);
                        }
                    }
                }
            }

            consume(ri, colspan, rowspan);
        }

        // Labelled rows with values: record them, but keep lastSectionLabel alive so a
        // following unlabelled total row (e.g. revenue = sub1 + sub2 + [unlabelled total])
        // can still claim the section header.
        if (label && valuesByPeriod.size) {
            results.push({ label, isSectionTotal: false, values: valuesByPeriod, isPerShare: isInPerShareSection });
            continue;
        }

        // Label-only rows (section headers with no values): save for unlabelled total
        if (label && !valuesByPeriod.size) {
            lastSectionLabel = label;
            continue;
        }

        // Unlabelled total rows: values present but no label cell → claim the section label
        if (!label && valuesByPeriod.size && lastSectionLabel) {
            const sectionLabel = lastSectionLabel;
            lastSectionLabel = null; // consumed — reset so only the first unlabelled row wins
            const ll = sectionLabel.toLowerCase();
            if (ll.includes('per share') || ll.includes('per common share')) isInPerShareSection = true;
            if (ll.includes('weighted') || ll.includes('shares outstanding') || ll.includes('shares used')) isInPerShareSection = true;
            results.push({ label: sectionLabel, isSectionTotal: true, values: valuesByPeriod, isPerShare: isInPerShareSection });
        }
    }

    return results;
}

// ── Assemble PeriodFacts ──────────────────────────────────────────────────────

function buildPeriodFacts(rows: RowData[], range: PeriodRange): PeriodFacts | undefined {
    const facts: XBRLFact[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
        const val = row.values.get(range.periodType);
        if (val === undefined || val === null) continue;
        const label = labelToConcept(row.label);
        if (!label || seen.has(label)) continue;
        seen.add(label);
        facts.push({ concept: label, label, value: val, unit: 'USD' });
    }

    if (!facts.length) return undefined;
    const startDate = deriveStartDate(range.endDate, range.months);
    return { startDate, endDate: range.endDate, months: range.months, facts };
}

// ── Main processor ────────────────────────────────────────────────────────────

export default class HTMLIncomeProcessor {
    private content: string = '';

    initialize(cik: string, _datestr: string, rawFilingString: string): void {
        this.content = rawFilingString
            .replace(/three-month period ended/gi, 'three months ended')
            .replace(/three month period ended/gi, 'three months ended')
            .replace(/six-month period ended/gi, 'six months ended')
            .replace(/six month period ended/gi, 'six months ended')
            .replace(/nine-month period ended/gi, 'nine months ended')
            .replace(/nine month period ended/gi, 'nine months ended')
            .replace(/half[- ]year ended/gi, 'six months ended');
    }

    extract(): HTMLIncomeResult {
        const html = extractDocumentSections(this.content);
        const root = parseHTML(html);
        const tables = root.querySelectorAll('table') as unknown as HTMLElement[];

        const { table, multiplier } = selectIncomeTable(tables);
        if (!table) return {};

        const ranges = buildPeriodRanges(table);
        if (!ranges.length) return {};

        const rows = extractRows(table, ranges, multiplier);
        if (!rows.length) return {};

        const result: HTMLIncomeResult = {};

        const qRange = ranges.find(r => r.periodType === 'Q');
        if (qRange) result.quarterly = buildPeriodFacts(rows, qRange);

        const ytdRange = ranges.find(r => r.periodType === '9M') ?? ranges.find(r => r.periodType === '6M');
        if (ytdRange) result.ytd = buildPeriodFacts(rows, ytdRange);

        // If no quarterly but 6M found, promote to quarterly
        if (!result.quarterly && result.ytd && ytdRange?.periodType === '6M') {
            result.quarterly = result.ytd;
            delete result.ytd;
        }

        // Annual 6-K filers: primary table has only annual data.
        // Before using it as quarterly, scan other tables for one with a Q range.
        if (!result.quarterly && !result.ytd) {
            for (let i = 0; i < Math.min(tables.length, MAX_TABLES); i++) {
                const t = tables[i];
                if (t === table) continue;
                const inner = (t.textContent ?? '').toLowerCase();
                if (scoreIncomeTable(inner) < 0.7) continue;
                const tRanges = buildPeriodRanges(t);
                const tQRange = tRanges.find(r => r.periodType === 'Q');
                if (!tQRange) continue;
                const ctx = getContextText(t);
                const tMult = findMultiplier(t, ctx);
                const tRows = extractRows(t, tRanges, tMult);
                const qFacts = buildPeriodFacts(tRows, tQRange);
                if (qFacts) {
                    result.quarterly = qFacts;
                    break;
                }
            }
        }

        // Last resort: use annual column as quarterly
        if (!result.quarterly && !result.ytd) {
            const aRange = ranges.find(r => r.periodType === 'A');
            if (aRange) result.quarterly = buildPeriodFacts(rows, aRange);
        }

        return result;
    }
}
