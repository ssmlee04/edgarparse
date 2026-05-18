// ── Scoring ───────────────────────────────────────────────────────────────────

export function scoreIncomeTable(text: string): number {
    let score = 0;
    // Banking-sector compound signal
    if (
        (text.includes('interest income') || text.includes('interest expense')) &&
        text.includes('deposits') && text.includes('loans') && text.includes('borrowing')
    ) score += 0.3;

    if (text.includes('revenue') || text.includes('sales')) score += 0.2;
    if (text.includes('total revenue') || text.includes('net revenues') || text.includes('net sales')) score += 0.1;
    if (text.includes('other income')) score += 0.1;
    if (text.includes('income tax credit')) score += 0.1;
    if (text.includes('total benefits') || text.includes('total expenses')) score += 0.1;
    if (
        text.includes('cost of sales') || text.includes('cost of revenue') ||
        text.includes('cost of net revenue') || text.includes('cost of goods sold') ||
        text.includes('cost of products sold')
    ) score += 0.2;
    if (text.includes('administrative') || text.includes('marketing')) score += 0.2;
    if (text.includes('income attributable') || text.includes('earnings attributable')) score += 0.2;
    if (text.includes('technology') || text.includes('service') || text.includes('fees')) score += 0.1;
    if (text.includes('gross profit')) score += 0.1;
    if (text.includes('operating profit') || text.includes('operating income')) score += 0.1;
    if (text.includes('amortization') || text.includes('depreciation')) score += 0.05;
    if (text.includes('operating expense') || text.includes('operating cost')) score += 0.1;
    if (text.includes('before income taxes') || text.includes('for income taxes')) score += 0.2;
    if (text.includes('research and development')) score += 0.15;
    if (text.includes('general') && text.includes('administrative')) score += 0.15;
    if (text.includes('net income') || text.includes('interest expense') || text.includes('interest income')) score += 0.1;
    if (text.includes('per share') || text.includes('per common share')) score += 0.1;
    if (text.includes('weighted') || text.includes('shares used')) score += 0.1;
    if (text.includes('loss from operations') || text.includes('income from operations')) score += 0.1;
    if (text.includes('expense')) score += 0.05;
    if (text.includes('earnings per share')) score += 0.1;
    if (text.includes('diluted')) score += 0.05;
    if (text.includes('basic and diluted')) score += 0.2;
    // IFRS additions
    if (text.includes('profit for the period') || text.includes('profit/(loss)')) score += 0.15;
    if (text.includes('finance costs') || text.includes('finance income')) score += 0.1;
    return score;
}

export function hasPerShareData(text: string): boolean {
    return (
        text.includes('per share') ||
        text.includes('per common share') ||
        text.includes('per class a') ||
        text.includes('weighted') ||
        text.includes('shares used') ||
        text.includes('basic and diluted')
    );
}

export function looksLikeCashflow(text: string): boolean {
    return (
        text.includes('net cash provided by operating') ||
        text.includes('net cash provided by') ||
        text.includes('cash flows from operating') ||
        text.includes('cash flows from financing') ||
        text.includes('cash flows from investing') ||
        text.includes('operating activities') ||
        text.includes('financing activities') ||
        text.includes('investing activities') ||
        text.includes('net cash from operating') ||
        text.includes('net cash from investing') ||
        text.includes('net cash from financing')
    );
}

export function looksLikeBalanceSheet(text: string): boolean {
    return (
        (text.includes('total asset') || text.includes('current asset')) &&
        text.includes('liabilit') &&
        (text.includes('stockholder') || text.includes('shareholder') || text.includes('total equity'))
    );
}

// ── Title detection ───────────────────────────────────────────────────────────

export function isIncomeTitle(text: string): boolean {
    const t = text.toLowerCase();
    return (
        t.includes('income statements') ||
        t.includes('consolidated statement of income') ||
        t.includes('statement of consolidated operations') ||
        t.includes('consolidated statement of loss') ||
        t.includes('statements of comprehensive income') ||
        t.includes('consolidated statement of profit and loss') ||
        t.includes('consolidated statement of profit or loss') ||
        t.includes('consolidated income statement') ||
        t.includes('statements of operation') ||
        t.includes('statement of operation') ||
        t.includes('statement of earnings') ||
        t.includes('statements of consolidated income') ||
        t.includes('statements of income') ||
        t.includes('statements of earnings') ||
        // IFRS
        t.includes('statement of profit or loss') ||
        t.includes('condensed interim income') ||
        t.includes('interim income statement') ||
        t.includes('interim statement of operations') ||
        // 8-K press release
        t.includes('results of operations') ||
        t.includes('financial highlights')
    );
}

// ── Period type detection ─────────────────────────────────────────────────────

export function isQuarterPeriod(text: string): boolean {
    const t = text.toLowerCase();
    return (
        t.includes('three months ended') ||
        t.includes('three-month period ended') ||
        t.includes('three month period ended') ||
        t.includes('3 months ended') ||
        t.includes('fiscal quarter ended') ||
        t.includes('first quarter ended') ||
        t.includes('second quarter ended') ||
        t.includes('third quarter ended') ||
        t.includes('fourth quarter ended') ||
        t.includes('12 weeks ended') ||
        t.includes('13 weeks ended') ||
        t.includes('twelve weeks ended') ||
        t.includes('thirteen weeks ended') ||
        (t.includes('quarter ended') && !t.includes(' quarter ended'))
    );
}

export function isSixMonthPeriod(text: string): boolean {
    const t = text.toLowerCase();
    return (
        t.includes('six months ended') ||
        t.includes('six-months ended') ||
        t.includes('six-month period ended') ||
        t.includes('six month period ended') ||
        t.includes('half-year ended') ||
        t.includes('half year ended') ||
        t.includes('two quarters ended') ||
        t.includes('24 weeks ended') ||
        t.includes('25 weeks ended') ||
        t.includes('26 weeks ended') ||
        t.includes('27 weeks ended') ||
        t.includes('28 weeks ended')
    );
}

export function isNineMonthPeriod(text: string): boolean {
    const t = text.toLowerCase();
    return (
        t.includes('nine months ended') ||
        t.includes('nine-months ended') ||
        t.includes('nine-month period ended') ||
        t.includes('nine month period ended') ||
        t.includes('first three quarters') ||
        t.includes('three quarters ended') ||
        t.includes('three fiscal quarters') ||
        t.includes('35 weeks ended') ||
        t.includes('36 weeks ended') ||
        t.includes('37 weeks ended') ||
        t.includes('38 weeks ended') ||
        t.includes('39 weeks ended') ||
        t.includes('40 weeks ended')
    );
}

export function isAnnualPeriod(text: string): boolean {
    const t = text.toLowerCase();
    return (
        t.includes('twelve months ended') ||
        t.includes('year-ended') ||
        t.includes('year ended') ||
        t.includes('years ended') ||
        t.includes('52 weeks ended') ||
        t.includes('53 weeks ended')
    );
}

// ── Date helpers ──────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
    january: 1, jan: 1,
    february: 2, feb: 2,
    march: 3, mar: 3,
    april: 4, apr: 4,
    may: 5,
    june: 6, jun: 6,
    july: 7, jul: 7,
    august: 8, aug: 8,
    september: 9, sep: 9,
    october: 10, oct: 10,
    november: 11, nov: 11,
    december: 12, dec: 12,
};

export function extractMonthDay(text: string): string | null {
    const t = text.toLowerCase();
    const monthKeys = Object.keys(MONTH_MAP).join('|');

    // "September 30" / "September 30," / "Sep 30"
    const re1 = new RegExp(`(${monthKeys})[\\s]+(0?[1-9]|[12][0-9]|3[01])(?:\\s|,|$)`);
    const m1 = t.match(re1);
    if (m1 && m1[1] && m1[2]) {
        return `${String(MONTH_MAP[m1[1]]).padStart(2, '0')}-${String(m1[2]).padStart(2, '0')}`;
    }

    // "30 September" / "30 Sep" (day-first, common in UK/IFRS filings)
    const re2 = new RegExp(`\\b(0?[1-9]|[12][0-9]|3[01])[\\s]+(${monthKeys})\\b`);
    const m2 = t.match(re2);
    if (m2 && m2[1] && m2[2]) {
        return `${String(MONTH_MAP[m2[2]]).padStart(2, '0')}-${String(m2[1]).padStart(2, '0')}`;
    }

    return null;
}

export function extractYear(text: string): number | null {
    const tokens = text.replace(/,/g, ' ').split(/\s+/);
    for (const token of tokens) {
        const y = parseInt(token, 10);
        if (y >= 1980 && y <= 2080) return y;
    }
    return null;
}

// Derive the startDate from endDate and number of months
export function deriveStartDate(endDate: string, months: number): string {
    const d = new Date(endDate + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() - months);
    d.setUTCDate(1);
    return d.toISOString().slice(0, 10);
}

// ── Multiplier detection ──────────────────────────────────────────────────────

export function detectMultiplier(text: string): number {
    const t = text.toLowerCase();
    // Match "in [optional-currency-or-country] billions/millions/thousands, except"
    // Handles: "in millions", "in £ millions", "in US millions", "in USD millions", "in NT$ thousands"
    const units = /in\s+(?:[£$€¥₩]|[a-z]{1,3}\$?\s+)?(?:[£$€¥₩]\s*)?billions?,\s*except/;
    if (units.test(t)) return 1_000_000_000;
    const millX = /in\s+(?:[£$€¥₩]|[a-z]{1,3}\$?\s+)?(?:[£$€¥₩]\s*)?millions?,\s*except/;
    if (millX.test(t)) return 1_000_000;
    const thouX = /in\s+(?:[£$€¥₩]|[a-z]{1,3}\$?\s+)?(?:[£$€¥₩]\s*)?thousands?,\s*except/;
    if (thouX.test(t)) return 1_000;
    if (t.includes('($000, except')) return 1_000;
    // Standalone (no "except") — also match "expressed in US millions"
    const billS = /in\s+(?:[£$€¥₩]|[a-z]{1,3}\$?\s+)?(?:[£$€¥₩]\s*)?billions?/;
    if (billS.test(t)) return 1_000_000_000;
    const millS = /in\s+(?:[£$€¥₩]|[a-z]{1,3}\$?\s+)?(?:[£$€¥₩]\s*)?millions?/;
    if (millS.test(t)) return 1_000_000;
    const thouS = /in\s+(?:[£$€¥₩]|[a-z]{1,3}\$?\s+)?(?:[£$€¥₩]\s*)?thousands?/;
    if (thouS.test(t)) return 1_000;
    if (t.includes("$000's") || t.includes('$000s')) return 1_000;
    return 1;
}

// ── Value extraction ──────────────────────────────────────────────────────────

export function extractValue(raw: string, multiplier: number): number | null {
    // Strip $ signs, non-breaking spaces, zero-width spaces
    const text = raw
        .replace(/\$/g, '')
        .replace(/[ ​]/g, '')
        .replace(/,/g, '')
        .trim();

    if (!text || text === '—' || text === '–' || text === '-' || text === '') return null;

    // Parentheses = negative: (1234) → -1234
    if (text.startsWith('(') && text.endsWith(')')) {
        const n = parseFloat(text.slice(1, -1));
        if (!isNaN(n)) return -n * multiplier;
        return null;
    }

    const n = parseFloat(text);
    if (!isNaN(n)) return n * multiplier;
    return null;
}

// ── Label → concept mapping ───────────────────────────────────────────────────

// Returns the normalized label string (matching concept-map.ts label values)
// or null if no match.
export function labelToConcept(raw: string): string | null {
    const t = raw.toLowerCase()
        .replace(/\(.*?\)/g, '') // strip parenthetical qualifiers like "(loss)"
        .replace(/[,\/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Revenue
    if (
        t === 'revenue' || t === 'revenues' || t === 'net revenue' || t === 'net revenues' ||
        t.startsWith('total revenue') || t === 'net sales' || t === 'total net revenue' ||
        t === 'total revenues' || t.startsWith('revenue from contract')
    ) return 'revenue';

    // Cost
    if (
        t.includes('cost of revenue') || t.includes('cost of sales') ||
        t.includes('cost of goods sold') || t.includes('cost of net revenue') ||
        t.includes('cost of products sold') || t.includes('cost of services')
    ) return 'cost of revenue';

    if (t === 'gross profit' || t === 'gross margin') return 'gross profit';

    // Operating expenses
    if (t.includes('research and development') || t.includes('r&d')) return 'research and development';
    if (
        t.includes('selling, general and administrative') ||
        t.includes('selling general and administrative') ||
        t === 'sg&a' || t === 'general and administrative' || t === 'g&a'
    ) return 'selling, general and administrative';
    if (t === 'sales and marketing' || t.startsWith('selling and marketing')) return 'sales and marketing';
    if (t.includes('total operating expense') || t.startsWith('operating expenses')) return 'total operating expenses';
    if (t.includes('total costs and expenses')) return 'total costs and expenses';

    // Operating income / loss
    if (
        t === 'operating income' || t === 'operating profit' ||
        t === 'operating loss' || t === 'income from operations' ||
        t === 'loss from operations' || t.startsWith('operating income')
    ) return 'operating income';

    // Below the line
    if (t.includes('interest expense') || t.includes('finance costs')) return 'interest expense';
    if (t.includes('interest income') || t.includes('finance income') || t.includes('investment income')) return 'interest income';
    if (
        t.includes('interest income') && t.includes('expense') && t.includes('net')
    ) return 'interest income (expense), net';
    if (t.includes('other income') || t.includes('other expense') || t.includes('other non-operating')) return 'other income (expense)';

    // Pre-tax
    if (
        t.includes('before income tax') || t.includes('before tax') ||
        t === 'pre-tax income' || t === 'pre-tax loss' ||
        t.includes('income loss from continuing operations before')
    ) return 'income before income taxes';

    // Tax
    if (
        t.includes('income tax') || t.includes('provision for income taxes') ||
        t.includes('income taxes')
    ) return 'income tax expense (benefit)';

    // Net income / loss — must not match "profit on disposal/sale", "gross profit", "operating profit"
    if (
        t === 'net income' || t === 'net loss' ||
        t === 'profit for the period' || t === 'profit for the year' ||
        t === 'loss for the period' || t === 'loss for the year' ||
        t === 'income for the period' || t === 'income for the year' ||
        t.startsWith('net income') || t.startsWith('net loss') ||
        t === 'net earnings' ||
        t === 'profit' || t === 'loss' ||
        (t.includes('profit') && !t.includes('gross') && !t.includes('operating') &&
         !t.includes('disposal') && !t.includes('sale of') && !t.includes('on sale') &&
         !t.includes('disposal') && !t.includes('divestiture') && !t.includes('discontinued'))
    ) return 'net income';

    if (
        t.includes('net income attributable') || t.includes('net income available to common') ||
        t.includes('net earnings attributable')
    ) return 'net income attributable to common stockholders';

    // EPS — handled by context in extractRows; these catch standalone label rows
    if (t === 'basic' || t === 'basic:') return 'earnings per share - basic';
    if (t === 'diluted' || t === 'diluted:') return 'earnings per share - diluted';
    if (t === 'basic and diluted' || t === 'basic and diluted:') return 'earnings per share - basic';

    if (
        t.includes('earnings per share') || t.includes('net income per share') ||
        t.includes('net loss per share') || t.includes('loss per share')
    ) {
        if (t.includes('diluted')) return 'earnings per share - diluted';
        if (t.includes('basic')) return 'earnings per share - basic';
        // undifferentiated EPS label — caller should emit both
        return 'earnings per share - basic';
    }

    // Weighted-average shares
    if (t.includes('weighted') && t.includes('share')) {
        if (t.includes('diluted')) return 'weighted-average shares - diluted';
        return 'weighted-average shares - basic';
    }

    return null;
}
