import XBRLIncomeQuarterlyProcessor from './processors/xbrl_income_quarterly_processor';
import XBRLBalanceQuarterlyProcessor from './processors/xbrl_balance_quarterly_processor';
import XBRLCashflowQuarterlyProcessor from './processors/xbrl_cashflow_quarterly_processor';
import XBRLIncomeAnnualProcessor from './processors/xbrl_income_annual_processor';
import XBRLBalanceAnnualProcessor from './processors/xbrl_balance_annual_processor';
import XBRLCashflowAnnualProcessor from './processors/xbrl_cashflow_annual_processor';

export {
    XBRLIncomeQuarterlyProcessor,
    XBRLBalanceQuarterlyProcessor,
    XBRLCashflowQuarterlyProcessor,
    XBRLIncomeAnnualProcessor,
    XBRLBalanceAnnualProcessor,
    XBRLCashflowAnnualProcessor,
};

export type { XBRLFact, PeriodFacts, ContextInfo, RawFact } from './xbrl_types';
export type { ConceptEntry, StatementType } from './concept-map';

import HTMLIncomeProcessor from './processors/html_income_processor';
export { HTMLIncomeProcessor };
export type { HTMLIncomeResult } from './processors/html_income_processor';
