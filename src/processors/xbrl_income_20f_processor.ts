import XBRLStatementProcessor from './xbrl_base';
import type { PeriodFacts } from '../xbrl_types';

export type AnnualIncomeResult20F = {
    annual: PeriodFacts;
};

export default class XBRLIncome20FProcessor extends XBRLStatementProcessor {
    protected formType = '20-f';
    protected statementType = 'income';

    extract(): AnnualIncomeResult20F {
        const ids = this.getConsolidatedContextIds('annual');
        const meta = this.getPeriodMeta('annual');

        if (!meta) throw new Error(`No annual consolidated context found for ${this.cik} ${this.datestr}`);

        return {
            annual: {
                startDate: meta.startDate,
                endDate: meta.endDate,
                months: meta.months,
                facts: this.factsForPeriod(ids, 'income'),
            },
        };
    }
}
