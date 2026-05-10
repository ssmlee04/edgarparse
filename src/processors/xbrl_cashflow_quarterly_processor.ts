import XBRLStatementProcessor from './xbrl_base';
import type { PeriodFacts } from '../xbrl_types';

export type CashflowResult = {
    ytd: PeriodFacts;
};

export default class XBRLCashflowQuarterlyProcessor extends XBRLStatementProcessor {
    protected statementType = 'cashflow';

    extract(): CashflowResult {
        // Prefer the longest available YTD context:
        //   4–9 months  → Q2/Q3 filings
        //   10–13 months → Q4 or fiscal-year-end filings in the 10-q data directory
        //   1–3 months  → Q1 filings where YTD == Q1
        const ytdIds  = this.getConsolidatedContextIds('ytd');
        const ytdMeta = this.getPeriodMeta('ytd');
        const annIds  = this.getConsolidatedContextIds('annual');
        const annMeta = this.getPeriodMeta('annual');
        const qIds    = this.getConsolidatedContextIds('quarterly');
        const qMeta   = this.getPeriodMeta('quarterly');

        const meta = ytdMeta ?? annMeta ?? qMeta;
        const ids  = ytdMeta ? ytdIds : annMeta ? annIds : qIds;

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
