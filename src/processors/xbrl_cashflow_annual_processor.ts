import XBRLStatementProcessor from './xbrl_base';
import type { PeriodFacts } from '../xbrl_types';

export type AnnualCashflowResult = {
    annual: PeriodFacts;
};

export default class XBRLCashflowAnnualProcessor extends XBRLStatementProcessor {
    protected formType = '10-k';
    protected statementType = 'cashflow';

    extract(): AnnualCashflowResult {
        const ids = this.getConsolidatedContextIds('annual');
        const meta = this.getPeriodMeta('annual');

        if (!meta) throw new Error(`No annual consolidated context found for ${this.cik} ${this.datestr}`);

        return {
            annual: {
                startDate: meta.startDate,
                endDate: meta.endDate,
                months: meta.months,
                facts: this.factsForPeriod(ids, 'cashflow'),
            },
        };
    }
}
