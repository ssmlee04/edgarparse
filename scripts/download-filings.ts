/**
 * Downloads raw EDGAR 10-Q submission files needed to run the test suite.
 * Files are saved to data/txt/quarterly/ which is gitignored.
 *
 * Usage:
 *   npx ts-node scripts/download-filings.ts
 */

import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

const FILINGS: { ticker: string; cik: string; period: string }[] = [
    { ticker: 'aa',   cik: '1675149', period: '2024-09-30' },
    { ticker: 'msft', cik: '789019',  period: '2023-09-30' },
    { ticker: 'tsla', cik: '1318605', period: '2023-09-30' },
    { ticker: 'amzn', cik: '1018724', period: '2023-09-30' },
    { ticker: 'nvda', cik: '1045810', period: '2022-04-30' },
];

const OUT_DIR = path.join(__dirname, '../data/txt/quarterly');
// SEC requires a User-Agent with a name and contact email
const USER_AGENT = 'edgarparse contact@example.com';

const get = (url: string): Promise<string> =>
    new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': USER_AGENT } }, res => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return get(res.headers.location!).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            const chunks: Buffer[] = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            res.on('error', reject);
        }).on('error', reject);
    });

const getBuffer = (url: string): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': USER_AGENT } }, res => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return getBuffer(res.headers.location!).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            }
            const chunks: Buffer[] = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const findAccession = async (cik: string, period: string): Promise<string> => {
    const paddedCik = cik.padStart(10, '0');
    const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;
    const body = await get(url);
    const data = JSON.parse(body);
    const { form, reportDate, accessionNumber } = data.filings.recent;
    for (let i = 0; i < form.length; i++) {
        if (form[i] === '10-Q' && reportDate[i] === period) {
            return accessionNumber[i];
        }
    }
    // check older filings pages if not found in recent
    throw new Error(`No 10-Q found for CIK ${cik} period ${period}`);
};

const downloadFiling = async (cik: string, accession: string, ticker: string, period: string) => {
    const accNoDash = accession.replace(/-/g, '');
    const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${accNoDash}/${accession}.txt`;
    console.log(`  downloading ${url}`);
    const buf = await getBuffer(url);
    const dest = path.join(OUT_DIR, `${ticker}-${period}.txt`);
    fs.writeFileSync(dest, buf);
    console.log(`  saved → ${dest} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
};

const main = async () => {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    for (const { ticker, cik, period } of FILINGS) {
        const dest = path.join(OUT_DIR, `${cik}-${period}.txt`);
        if (fs.existsSync(dest)) {
            console.log(`skip ${cik}-${period}.txt (already exists)`);
            continue;
        }
        console.log(`\nfetching ${ticker} ${period} ...`);
        try {
            const accession = await findAccession(cik, period);
            console.log(`  accession: ${accession}`);
            await sleep(200); // be polite to SEC servers
            await downloadFiling(cik, accession, cik, period);
        } catch (err: any) {
            console.error(`  ERROR: ${err.message}`);
        }
        await sleep(200);
    }

    console.log('\ndone.');
};

main();
