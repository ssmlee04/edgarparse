import XBRLStatementProcessor from './xbrl_base';
import type { PeriodFacts } from '../xbrl_types';

export type CashflowResult = {
    ytd: PeriodFacts;
};

export default class XBRLCashflowQuarterlyProcessor extends XBRLStatementProcessor {
    protected statementType = 'cashflow';

    extract(): CashflowResult {
        // Prefer the YTD context (Q2/Q3 filings, diff 4–9 months).
        // Fall back to quarterly context for Q1 filings where YTD == Q1 (diff 1–3 months).
        const ytdIds  = this.getConsolidatedContextIds('ytd');
        const ytdMeta = this.getPeriodMeta('ytd');
        const qIds    = this.getConsolidatedContextIds('quarterly');
        const qMeta   = this.getPeriodMeta('quarterly');

        const meta = ytdMeta ?? qMeta;
        const ids  = ytdMeta ? ytdIds : qIds;

        if (!meta) throw new Error(`No cashflow context found for ${this.cik} ${this.datestr}`);

        return {
            ytd: {
                startDate: meta.startDate,
                endDate:   meta.endDate,
                months:    meta.months,
                facts:     this.factsForPeriod(ids, 'cashflow'),
            },
        };
    }
}
