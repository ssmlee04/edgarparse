/**
 * Generate test mock files from all data/txt filings.
 *
 * Usage:
 *   npx ts-node scripts/gen-mocks.ts           # skip files that already have all 3 mocks
 *   npx ts-node scripts/gen-mocks.ts --force   # regenerate every mock unconditionally
 */

import * as fs from 'fs';
import * as path from 'path';
import XBRLIncomeQuarterlyProcessor from '../src/processors/xbrl_income_quarterly_processor';
import XBRLBalanceQuarterlyProcessor from '../src/processors/xbrl_balance_quarterly_processor';
import XBRLCashflowQuarterlyProcessor from '../src/processors/xbrl_cashflow_quarterly_processor';
import XBRLIncomeAnnualProcessor from '../src/processors/xbrl_income_annual_processor';
import XBRLBalanceAnnualProcessor from '../src/processors/xbrl_balance_annual_processor';
import XBRLCashflowAnnualProcessor from '../src/processors/xbrl_cashflow_annual_processor';

const force = process.argv.includes('--force');

const QUARTERLY_PROCESSORS = [
    XBRLIncomeQuarterlyProcessor,
    XBRLBalanceQuarterlyProcessor,
    XBRLCashflowQuarterlyProcessor,
];
const ANNUAL_PROCESSORS = [
    XBRLIncomeAnnualProcessor,
    XBRLBalanceAnnualProcessor,
    XBRLCashflowAnnualProcessor,
];

const parseCikDate = (filename: string) => {
    const base = path.basename(filename, '.txt');
    const parts = base.split('-');
    return { cik: parts[0], datestr: parts.slice(1).join('-') };
};

const mockPath = (formType: string, statementType: string, cik: string, datestr: string) =>
    path.join('test/mock/xbrl', formType, `${statementType}-${cik}-${datestr}.txt`);

const run = (formType: string, processors: any[], dataDir: string) => {
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.txt'));
    let generated = 0, skipped = 0, errored = 0;

    for (const filename of files) {
        const { cik, datestr } = parseCikDate(filename);
        const statementTypes = processors.map(P => new P().statementType as string);

        const allExist = statementTypes.every(t => fs.existsSync(mockPath(formType, t, cik, datestr)));
        if (!force && allExist) {
            skipped++;
            continue;
        }

        for (const Processor of processors) {
            const p = new Processor();
            try {
                p.initialize(cik, datestr);
                p.process(p.extract(), true);
                generated++;
            } catch (e: any) {
                console.error(`  ERR ${filename} [${p.statementType}]: ${e.message}`);
                errored++;
            }
        }
    }

    console.log(`${formType}: ${generated} generated, ${skipped} skipped, ${errored} errors`);
};

fs.mkdirSync('test/mock/xbrl/10-q', { recursive: true });
fs.mkdirSync('test/mock/xbrl/10-k', { recursive: true });

run('10-q', QUARTERLY_PROCESSORS, 'data/txt/10-q');
run('10-k', ANNUAL_PROCESSORS,    'data/txt/10-k');

console.log('done.');
