import * as fs from 'fs';
import XBRLIncomeAnnualProcessor from '../src/processors/xbrl_income_annual_processor';
import XBRLBalanceAnnualProcessor from '../src/processors/xbrl_balance_annual_processor';
import XBRLCashflowAnnualProcessor from '../src/processors/xbrl_cashflow_annual_processor';

const MOCK_DIR = './test/mock/xbrl/10-k';

const parseName = (filename: string) => {
    const parts = filename.replace('.txt', '').split('-');
    return { cik: parts[1], datestr: parts.slice(2).join('-') };
};

describe('xbrl 10-k cashflow tests', () => {
    const files = fs.readdirSync(MOCK_DIR).filter(f => f.startsWith('cashflow-'));
    files.forEach(filename => {
        const { cik, datestr } = parseName(filename);
        it(`annual cashflow ${filename}`, () => {
            const processor = new XBRLCashflowAnnualProcessor();
            processor.initialize(cik, datestr);
            const result = processor.extract();
            const expected = JSON.parse(fs.readFileSync(`${MOCK_DIR}/${filename}`, 'utf8'));
            expect(result).toEqual(expected);
        });
    });
});

describe('xbrl 10-k balance tests', () => {
    const files = fs.readdirSync(MOCK_DIR).filter(f => f.startsWith('balance-'));
    files.forEach(filename => {
        const { cik, datestr } = parseName(filename);
        it(`annual balance ${filename}`, () => {
            const processor = new XBRLBalanceAnnualProcessor();
            processor.initialize(cik, datestr);
            const result = processor.extract();
            const expected = JSON.parse(fs.readFileSync(`${MOCK_DIR}/${filename}`, 'utf8'));
            expect(result).toEqual(expected);
        });
    });
});

describe('xbrl 10-k income tests', () => {
    const files = fs.readdirSync(MOCK_DIR).filter(f => f.startsWith('income-'));
    files.forEach(filename => {
        const { cik, datestr } = parseName(filename);
        it(`annual income ${filename}`, () => {
            const processor = new XBRLIncomeAnnualProcessor();
            processor.initialize(cik, datestr);
            const result = processor.extract();
            const expected = JSON.parse(fs.readFileSync(`${MOCK_DIR}/${filename}`, 'utf8'));
            expect(result).toEqual(expected);
        });
    });
});
