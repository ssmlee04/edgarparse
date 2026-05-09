import XBRLStatementProcessor from './xbrl_base';
import type { XBRLFact } from '../xbrl_types';

export type AnnualBalanceResult = {
    endDate: string;
    facts: XBRLFact[];
};

export default class XBRLBalanceAnnualProcessor extends XBRLStatementProcessor {
    protected formType = '10-k';
    protected statementType = 'balance';

    extract(): AnnualBalanceResult {
        const ids = this.getConsolidatedContextIds('instant');
        return {
            endDate: this.datestr,
            facts: this.factsForPeriod(ids, 'balance'),
        };
    }
}
