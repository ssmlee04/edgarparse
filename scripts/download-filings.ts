/**
 * Downloads raw EDGAR 10-Q submission files.
 * Files are saved to data/txt/10-q/ which is gitignored.
 *
 * Usage:
 *   npx ts-node scripts/download-filings.ts
 *
 * To customise which filings to download, create scripts/filings.json
 * (see scripts/filings.json.example). If the file does not exist the
 * built-in defaults below are used.
 */

import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

type Filing = { ticker: string; cik: string; period: string };

const DEFAULT_FILINGS: Filing[] = [
    { ticker: 'aa',   cik: '1675149', period: '2024-09-30' },
    { ticker: 'msft', cik: '789019',  period: '2023-09-30' },
    { ticker: 'tsla', cik: '1318605', period: '2023-09-30' },
    { ticker: 'amzn', cik: '1018724', period: '2023-09-30' },
    { ticker: 'nvda', cik: '1045810', period: '2022-04-30' },
];

const FILINGS_JSON = path.join(__dirname, 'filings.json');
const FILINGS: Filing[] = fs.existsSync(FILINGS_JSON)
    ? JSON.parse(fs.readFileSync(FILINGS_JSON, 'utf8'))
    : DEFAULT_FILINGS;

const DATA_ROOT = path.join(__dirname, '../data/txt');
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

// Priority tiers: earlier tier wins regardless of score.
// Within a tier, the filing whose reportDate is closest to the target period wins.
const FORM_TYPE_TIERS: readonly string[][] = [
    ['10-Q', '10-K'],
    ['20-F'],
    ['6-K'],
    ['8-K'],
];

const WINDOW_MS = 31 * 24 * 60 * 60 * 1000; // ±1 month

const searchFilings = (
    filings: { form: string[]; reportDate: string[]; accessionNumber: string[] },
    period: string,
): { accession: string; form: string } | null => {
    const { form, reportDate, accessionNumber } = filings;
    const targetMs = new Date(period + 'T00:00:00Z').getTime();

    for (const tier of FORM_TYPE_TIERS) {
        let best: { accession: string; form: string; diff: number } | null = null;
        for (let i = 0; i < form.length; i++) {
            if (!tier.includes(form[i].toUpperCase())) continue;
            const diff = Math.abs(new Date(reportDate[i] + 'T00:00:00Z').getTime() - targetMs);
            if (diff > WINDOW_MS) continue;
            if (!best || diff < best.diff) {
                best = { accession: accessionNumber[i], form: form[i], diff };
            }
        }
        if (best) return { accession: best.accession, form: best.form };
    }
    return null;
};

const findAccession = async (cik: string, period: string): Promise<{ accession: string; form: string }> => {
    const paddedCik = cik.padStart(10, '0');
    const body = await get(`https://data.sec.gov/submissions/CIK${paddedCik}.json`);
    const data = JSON.parse(body);

    const found = searchFilings(data.filings.recent, period);
    if (found) return found;

    // Walk paginated older filings if not found in recent
    for (const file of data.filings.files ?? []) {
        await sleep(200);
        try {
            const pageBody = await get(`https://data.sec.gov/submissions/${file.name}`);
            const result = searchFilings(JSON.parse(pageBody), period);
            if (result) return result;
        } catch {
            // skip pages that fail to load
        }
    }

    throw new Error(`No filing found for CIK ${cik} period ${period}`);
};

const formTypeToDir = (form: string): string => {
    const f = form.toLowerCase().replace('/', '-');
    return path.join(DATA_ROOT, f);
};

const downloadFiling = async (cik: string, accession: string, period: string, form: string) => {
    const accNoDash = accession.replace(/-/g, '');
    const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${accNoDash}/${accession}.txt`;
    console.log(`  downloading ${url}`);
    const buf = await getBuffer(url);
    const outDir = formTypeToDir(form);
    fs.mkdirSync(outDir, { recursive: true });
    const dest = path.join(outDir, `${cik}-${period}.txt`);
    fs.writeFileSync(dest, buf);
    console.log(`  saved → ${dest} (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
};

const ALL_FORM_DIRS = ['10-q', '10-k', '20-f', '6-k', '8-k'].map(f => path.join(DATA_ROOT, f));

const main = async () => {
    for (const { ticker, cik, period } of FILINGS) {
        const alreadyExists = ALL_FORM_DIRS.some(d => fs.existsSync(path.join(d, `${cik}-${period}.txt`)));
        if (alreadyExists) {
            console.log(`skip ${cik}-${period}.txt (already exists)`);
            continue;
        }

        console.log(`\nfetching ${ticker} ${period} ...`);
        try {
            const { accession, form } = await findAccession(cik, period);
            console.log(`  accession: ${accession} (${form})`);
            await sleep(200); // be polite to SEC servers
            await downloadFiling(cik, accession, period, form);
        } catch (err: any) {
            console.error(`  ERROR: ${err.message}`);
        }
        await sleep(200);
    }

    console.log('\ndone.');
};

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
