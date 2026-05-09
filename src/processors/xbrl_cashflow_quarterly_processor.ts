import XBRLStatementProcessor from './xbrl_base';
import type { PeriodFacts } from '../xbrl_types';

export type CashflowResult = {
    quarterly: PeriodFacts;
    ytd?: PeriodFacts;
};

export default class XBRLCashflowQuarterlyProcessor extends XBRLStatementProcessor {
    protected statementType = 'cashflow';

    extract(): CashflowResult {
        const q3Ids = this.getConsolidatedContextIds('quarterly');
        const ytdIds = this.getConsolidatedContextIds('ytd');
        const q3Meta = this.getPeriodMeta('quarterly');
        const ytdMeta = this.getPeriodMeta('ytd');

        if (!q3Meta) throw new Error(`No quarterly consolidated context found for ${this.cik} ${this.datestr}`);

        const quarterly: PeriodFacts = {
            startDate: q3Meta.startDate,
            endDate: q3Meta.endDate,
            months: q3Meta.months,
            facts: this.factsForPeriod(q3Ids, 'cashflow'),
        };

        const ytd: PeriodFacts | undefined = ytdMeta
            ? {
                  startDate: ytdMeta.startDate,
                  endDate: ytdMeta.endDate,
                  months: ytdMeta.months,
                  facts: this.factsForPeriod(ytdIds, 'cashflow'),
              }
            : undefined;

        return { quarterly, ...(ytd ? { ytd } : {}) };
    }
}
