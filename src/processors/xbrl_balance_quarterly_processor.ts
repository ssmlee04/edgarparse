import XBRLStatementProcessor from './xbrl_base';
import type { XBRLFact } from '../xbrl_types';

export type BalanceResult = {
    endDate: string;
    facts: XBRLFact[];
};

export default class XBRLBalanceQuarterlyProcessor extends XBRLStatementProcessor {
    protected statementType = 'balance';

    extract(): BalanceResult {
        const instantIds = this.getConsolidatedContextIds('instant');
        return {
            endDate: this.datestr,
            facts: this.factsForPeriod(instantIds, 'balance'),
        };
    }
}
