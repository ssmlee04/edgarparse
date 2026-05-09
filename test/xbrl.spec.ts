import * as fs from 'fs';
import XBRLIncomeQuarterlyProcessor from '../src/processors/xbrl_income_quarterly_processor';
import XBRLBalanceQuarterlyProcessor from '../src/processors/xbrl_balance_quarterly_processor';
import XBRLCashflowQuarterlyProcessor from '../src/processors/xbrl_cashflow_quarterly_processor';

const MOCK_DIR = './test/mock/xbrl/quarterly';

const parseName = (filename: string) => {
    const parts = filename.replace('.txt', '').split('-');
    return { ticker: parts[1], datestr: parts.slice(2).join('-') };
};

describe('xbrl income tests', () => {
    const files = fs.readdirSync(MOCK_DIR).filter(f => f.startsWith('income-'));
    files.forEach(filename => {
        const { ticker, datestr } = parseName(filename);
        it(`quarterly income ${filename}`, () => {
            const processor = new XBRLIncomeQuarterlyProcessor();
            processor.initialize(ticker, datestr);
            const result = processor.extract();
            const expected = JSON.parse(fs.readFileSync(`${MOCK_DIR}/${filename}`, 'utf8'));
            expect(result).toEqual(expected);
        });
    });
});

describe('xbrl balance tests', () => {
    const files = fs.readdirSync(MOCK_DIR).filter(f => f.startsWith('balance-'));
    files.forEach(filename => {
        const { ticker, datestr } = parseName(filename);
        it(`quarterly balance ${filename}`, () => {
            const processor = new XBRLBalanceQuarterlyProcessor();
            processor.initialize(ticker, datestr);
            const result = processor.extract();
            const expected = JSON.parse(fs.readFileSync(`${MOCK_DIR}/${filename}`, 'utf8'));
            expect(result).toEqual(expected);
        });
    });
});

describe('xbrl cashflow tests', () => {
    const files = fs.readdirSync(MOCK_DIR).filter(f => f.startsWith('cashflow-'));
    files.forEach(filename => {
        const { ticker, datestr } = parseName(filename);
        it(`quarterly cashflow ${filename}`, () => {
            const processor = new XBRLCashflowQuarterlyProcessor();
            processor.initialize(ticker, datestr);
            const result = processor.extract();
            const expected = JSON.parse(fs.readFileSync(`${MOCK_DIR}/${filename}`, 'utf8'));
            expect(result).toEqual(expected);
        });
    });
});
