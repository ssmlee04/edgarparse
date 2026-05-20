import * as fs from 'fs';
import { CONCEPT_MAP, SECTOR_CONCEPTS, COMPANY_SPECIFIC_CONCEPTS, StatementType } from '../concept-map';
import type { ConceptEntry } from '../concept-map';
import type { XBRLFact, PeriodFacts, ContextInfo, RawFact } from '../xbrl_types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const parseAttrs = (str: string): Record<string, string> => {
    const result: Record<string, string> = {};
    const re = /(\w+(?:[:\-]\w+)*)="([^"]*)"/g;
    let m;
    while ((m = re.exec(str)) !== null) {
        result[m[1].toLowerCase()] = m[2];
    }
    return result;
};

const stripHtml = (str: string): string =>
    str.replace(/<[^>]+>/g, '').trim();

// month index distance between two ISO date strings (e.g. "2024-07-01" → "2024-09-30" → 2)
const monthDiff = (startDate: string, endDate: string): number => {
    const s = new Date(startDate + 'T00:00:00Z');
    const e = new Date(endDate + 'T00:00:00Z');
    return (e.getFullYear() * 12 + e.getMonth()) - (s.getFullYear() * 12 + s.getMonth());
};

const camelToWords = (str: string): string =>
    str.replace(/([A-Z])/g, ' $1').toLowerCase().trim();

// Extract the actual period of report from the SGML envelope header.
// CONFORMED PERIOD OF REPORT is in YYYYMMDD format.
const extractPeriodOfReport = (content: string): string | null => {
    const m = content.match(/conformed period of report:\s*(\d{8})/i);
    if (!m) return null;
    const d = m[1];
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
};

// ── Base Processor ────────────────────────────────────────────────────────────

export default class XBRLStatementProcessor {
    cik!: string;
    datestr!: string;
    protected formType: string = '10-q';   // overridden to '10-k' in annual processors
    protected statementType: string = 'xbrl';

    private contextMap: Map<string, ContextInfo> = new Map();
    private rawFacts: RawFact[] = [];

    initialize(cik: string, datestr: string, rawFilingString: string = '') {
        this.cik = cik;
        this.datestr = datestr;
        const content = rawFilingString || this.readSourceData();
        // Override datestr with the actual period from the SGML header — filenames
        // for non-calendar fiscal companies may not match the true period end date.
        const actualPeriod = extractPeriodOfReport(content);
        if (actualPeriod) this.datestr = actualPeriod;
        this.buildContextMap(content);
        this.extractRawFacts(content);
    }

    private readSourceData(): string {
        const filename = `./data/txt/${this.formType}/${this.cik}-${this.datestr}.txt`;
        return fs.readFileSync(filename).toString();
    }

    private buildContextMap(content: string) {
        // Match both <xbrli:context> (prefixed) and <context> (default namespace) forms
        const re = /<(?:xbrli:)?context id="([^"]+)">(.*?)<\/(?:xbrli:)?context>/gs;
        let m;
        while ((m = re.exec(content)) !== null) {
            const [, id, body] = m;
            const hasSegment = body.includes('segment>');

            const instant = body.match(/<(?:xbrli:)?instant>([^<]+)<\/(?:xbrli:)?instant>/i)?.[1]?.trim();
            const startDate = body.match(/<(?:xbrli:)?startdate>([^<]+)<\/(?:xbrli:)?startdate>/i)?.[1]?.trim();
            const endDate = body.match(/<(?:xbrli:)?enddate>([^<]+)<\/(?:xbrli:)?enddate>/i)?.[1]?.trim();

            if (instant) {
                this.contextMap.set(id, { type: 'instant', date: instant, hasSegment });
            } else if (startDate && endDate) {
                this.contextMap.set(id, { type: 'duration', startDate, endDate, hasSegment });
            }
        }
    }

    private extractRawFacts(content: string) {
        // Primary: inline XBRL (iXBRL) — <ix:nonFraction ...>value</ix:nonFraction>
        const re = /<ix:nonFraction([^>]*?)(?:\/>|>([\s\S]*?)<\/ix:nonFraction>)/gi;
        let m;
        while ((m = re.exec(content)) !== null) {
            const [, attrStr, rawContent] = m;
            if (!rawContent) continue; // self-closing nil

            const attrs = parseAttrs(attrStr);
            if (!attrs.name || !attrs.contextref || !attrs.unitref) continue;

            const text = stripHtml(rawContent).replace(/,/g, '').trim();
            const num = parseFloat(text);
            if (isNaN(num)) continue;

            const scale = parseInt(attrs.scale || '0', 10);
            const sign = attrs.sign === '-' ? -1 : 1;

            this.rawFacts.push({
                concept: attrs.name,
                contextRef: attrs.contextref,
                unitRef: attrs.unitref,
                value: num * Math.pow(10, scale) * sign,
            });
        }

        // Fallback: traditional XBRL instance document embedded as EX-101.INS (pre-iXBRL filings)
        if (this.rawFacts.length === 0) {
            this.extractTraditionalXBRLFacts(content);
        }
    }

    private extractTraditionalXBRLFacts(content: string) {
        const start = content.indexOf('<XBRL>');
        const end = content.indexOf('</XBRL>');
        if (start === -1 || end === -1) return;
        const block = content.slice(start + 6, end);

        // <ns:ConceptName contextRef="..." unitRef="..." ...>value</ns:ConceptName>
        // Value is already the full numeric amount (no scale attribute in traditional XBRL)
        // Namespace prefix may contain hyphens (e.g. us-gaap, ifrs-full)
        const re = /<([\w-]+:[\w]+)([^>]*?)>([\-\d\.]+)<\/[\w-]+:[\w]+>/g;
        let m;
        while ((m = re.exec(block)) !== null) {
            const [, concept, attrStr, text] = m;
            const attrs = parseAttrs(attrStr);
            if (!attrs.contextref || !attrs.unitref) continue;
            const num = parseFloat(text);
            if (isNaN(num)) continue;
            this.rawFacts.push({
                concept,
                contextRef: attrs.contextref,
                unitRef: attrs.unitref,
                value: num,
            });
        }
    }

    protected getConsolidatedContextIds(periodType: 'quarterly' | 'ytd' | 'annual' | 'instant'): Set<string> {
        const ids = new Set<string>();
        for (const [id, ctx] of this.contextMap) {
            if (ctx.hasSegment) continue;

            if (periodType === 'instant') {
                if (ctx.type === 'instant' && ctx.date === this.datestr) ids.add(id);
            } else if (ctx.type === 'duration' && ctx.endDate === this.datestr) {
                const diff = monthDiff(ctx.startDate!, ctx.endDate);
                // quarterly → month diff ≈ 2 (Jul–Sep, Oct–Dec, etc.)
                // ytd       → month diff 4–9 (covers Q2 6m, Q3 9m YTD periods)
                // annual    → month diff ≈ 11 (fiscal year, any start month)
                if (periodType === 'quarterly' && diff >= 1 && diff <= 3) ids.add(id);
                if (periodType === 'ytd' && diff >= 4 && diff <= 9) ids.add(id);
                if (periodType === 'annual' && diff >= 10 && diff <= 13) ids.add(id);
            }
        }
        return ids;
    }

    protected getPeriodMeta(periodType: 'quarterly' | 'ytd' | 'annual'): { startDate: string; endDate: string; months: number } | null {
        for (const [, ctx] of this.contextMap) {
            if (ctx.hasSegment || ctx.type !== 'duration' || ctx.endDate !== this.datestr) continue;
            const diff = monthDiff(ctx.startDate!, ctx.endDate);
            if (periodType === 'quarterly' && diff >= 1 && diff <= 3) {
                return { startDate: ctx.startDate!, endDate: ctx.endDate, months: diff + 1 };
            }
            if (periodType === 'ytd' && diff >= 4 && diff <= 9) {
                return { startDate: ctx.startDate!, endDate: ctx.endDate, months: diff + 1 };
            }
            if (periodType === 'annual' && diff >= 10 && diff <= 13) {
                return { startDate: ctx.startDate!, endDate: ctx.endDate, months: diff + 1 };
            }
        }
        return null;
    }

    protected factsForPeriod(contextIds: Set<string>, statementType: StatementType): XBRLFact[] {
        const seen = new Set<string>();
        const facts: XBRLFact[] = [];

        // Build effective concept map: global + all sector concepts merged unconditionally.
        // Companies only report XBRL concepts for their own industry, so cross-sector
        // concepts never produce spurious facts in unrelated filings.
        const allSectorEntries = Object.values(SECTOR_CONCEPTS).reduce(
            (acc, s) => ({ ...acc, ...s }), {} as Record<string, ConceptEntry>
        );
        const companyEntries = COMPANY_SPECIFIC_CONCEPTS[this.cik.replace(/^0+/, '')] ?? {};
        const effectiveMap = { ...CONCEPT_MAP, ...allSectorEntries, ...companyEntries };

        for (const raw of this.rawFacts) {
            if (!contextIds.has(raw.contextRef)) continue;

            const entry = effectiveMap[raw.concept];
            if (!entry) continue;
            const stmts = Array.isArray(entry.statement) ? entry.statement : [entry.statement];
            if (!stmts.includes(statementType)) continue;

            // deduplicate: same concept appearing multiple times for same period
            if (seen.has(raw.concept)) continue;
            seen.add(raw.concept);

            const value = entry.negate ? -raw.value : raw.value;
            facts.push({
                concept: entry.map_to ?? raw.concept,
                label: entry.label,
                value: value || 0, // normalize -0 → 0
                unit: 'USD',
            });
        }

        return facts;
    }

    process(data: any, shouldCreateTestFiles: boolean = false) {
        if (shouldCreateTestFiles && data) {
            this.createTestFile(data);
        }
    }

    private createTestFile(data: any) {
        const dir = `./test/mock/xbrl/${this.formType}`;
        fs.mkdirSync(dir, { recursive: true });
        const filename = `${dir}/${this.statementType}-${this.cik}-${this.datestr}.txt`;
        fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    }
}

export type { XBRLFact, PeriodFacts };
