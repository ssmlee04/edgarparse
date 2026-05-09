import * as fs from 'fs';
import { CONCEPT_MAP, SECTOR_CONCEPTS, CIK_SECTORS, StatementType } from '../concept-map';
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

// ── Base Processor ────────────────────────────────────────────────────────────

export default class XBRLStatementProcessor {
    cik!: string;
    datestr!: string;
    protected timeframe: string = 'quarterly';
    protected statementType: string = 'xbrl';

    private contextMap: Map<string, ContextInfo> = new Map();
    private rawFacts: RawFact[] = [];

    initialize(cik: string, datestr: string, rawFilingString: string = '') {
        this.cik = cik;
        this.datestr = datestr;
        const content = rawFilingString || this.readSourceData();
        this.buildContextMap(content);
        this.extractRawFacts(content);
    }

    private readSourceData(): string {
        const filename = `./data/txt/10-q/${this.cik}-${this.datestr}.txt`;
        return fs.readFileSync(filename).toString();
    }

    private buildContextMap(content: string) {
        const re = /<xbrli:context id="([^"]+)">(.*?)<\/xbrli:context>/gs;
        let m;
        while ((m = re.exec(content)) !== null) {
            const [, id, body] = m;
            const hasSegment = body.includes('<xbrli:segment>');

            const instant = body.match(/<xbrli:instant>([^<]+)<\/xbrli:instant>/)?.[1]?.trim();
            const startDate = body.match(/<xbrli:startdate>([^<]+)<\/xbrli:startdate>/i)?.[1]?.trim();
            const endDate = body.match(/<xbrli:enddate>([^<]+)<\/xbrli:enddate>/i)?.[1]?.trim();

            if (instant) {
                this.contextMap.set(id, { type: 'instant', date: instant, hasSegment });
            } else if (startDate && endDate) {
                this.contextMap.set(id, { type: 'duration', startDate, endDate, hasSegment });
            }
        }
    }

    private extractRawFacts(content: string) {
        // Self-closing nil facts (skip these)
        // Regular facts: <ix:nonFraction ...>value</ix:nonFraction>
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
    }

    protected getConsolidatedContextIds(periodType: 'quarterly' | 'ytd' | 'instant'): Set<string> {
        const ids = new Set<string>();
        for (const [id, ctx] of this.contextMap) {
            if (ctx.hasSegment) continue;

            if (periodType === 'instant') {
                if (ctx.type === 'instant' && ctx.date === this.datestr) ids.add(id);
            } else if (ctx.type === 'duration' && ctx.endDate === this.datestr) {
                const diff = monthDiff(ctx.startDate!, ctx.endDate);
                // quarterly → month diff ≈ 2 (Jul–Sep, Oct–Dec, etc.)
                // ytd (9m)  → month diff ≈ 8
                if (periodType === 'quarterly' && diff >= 1 && diff <= 3) ids.add(id);
                if (periodType === 'ytd' && diff >= 7 && diff <= 9) ids.add(id);
            }
        }
        return ids;
    }

    protected getPeriodMeta(periodType: 'quarterly' | 'ytd'): { startDate: string; endDate: string; months: number } | null {
        for (const [, ctx] of this.contextMap) {
            if (ctx.hasSegment || ctx.type !== 'duration' || ctx.endDate !== this.datestr) continue;
            const diff = monthDiff(ctx.startDate!, ctx.endDate);
            if (periodType === 'quarterly' && diff >= 1 && diff <= 3) {
                return { startDate: ctx.startDate!, endDate: ctx.endDate, months: diff + 1 };
            }
            if (periodType === 'ytd' && diff >= 7 && diff <= 9) {
                return { startDate: ctx.startDate!, endDate: ctx.endDate, months: diff + 1 };
            }
        }
        return null;
    }

    protected factsForPeriod(contextIds: Set<string>, statementType: StatementType): XBRLFact[] {
        const seen = new Set<string>();
        const facts: XBRLFact[] = [];

        // Build effective concept map: global + any sector-specific additions for this CIK
        const sectorKey = CIK_SECTORS[this.cik];
        const sectorEntries = sectorKey ? SECTOR_CONCEPTS[sectorKey] ?? {} : {};
        const effectiveMap = { ...CONCEPT_MAP, ...sectorEntries };

        for (const raw of this.rawFacts) {
            if (!contextIds.has(raw.contextRef)) continue;

            const entry = effectiveMap[raw.concept];
            if (!entry) continue;
            const stmts = Array.isArray(entry.statement) ? entry.statement : [entry.statement];
            if (!stmts.includes(statementType)) continue;

            // deduplicate: same concept appearing multiple times for same period
            if (seen.has(raw.concept)) continue;
            seen.add(raw.concept);

            facts.push({
                concept: raw.concept,
                label: entry.label,
                value: raw.value,
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
        const dir = `./test/mock/xbrl/10-q`;
        fs.mkdirSync(dir, { recursive: true });
        const filename = `${dir}/${this.statementType}-${this.cik}-${this.datestr}.txt`;
        fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    }
}

export type { XBRLFact, PeriodFacts };
