/**
 * Kiểm thêm cho P3 trên sandbox:
 *   (a) gọi thẳng POST tạo kỳ bằng token chỉ có `office:supply:report` (trưởng phòng), mong 403;
 *   (b) tải file Excel của kỳ bằng token trưởng phòng và admin, so cột trong file với cột màn hình cho trưởng
 *       phòng thấy (không có Dự trù, Cần mua, chỉ cột phòng mình);
 *   (c) trang chi tiết kỳ không tràn ngang ở 768px và 390px.
 * Chỉ đọc, trừ (a) nếu backend không chặn.
 *
 *   node tests/e2e/supply-catalog/extra-p3.mjs <thư mục ảnh>
 */
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { createRequire } from 'node:module';
// exceljs chỉ có ở repo BE; mượn để đọc file Excel, web không cài thêm gì.
const ExcelJS = createRequire('/home/tuanpham/work/hr-system/hr-system-be/package.json')('exceljs');
import { mkdirSync, readFileSync } from 'node:fs';

const WEB = 'http://127.0.0.1:4999';
const ACC = JSON.parse(readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/p1-accounts.json', 'utf8'));
const PASSWORD = /const PASSWORD\s*=\s*['"`]([^'"`]+)['"`]/.exec(
	readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/drill-p1.cjs', 'utf8'),
)[1];
const SHOTS = process.argv[2] ?? '/tmp/supply-extra-p3';
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(id, ok, name, detail = '') {
	results.push({ id, ok: !!ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${id} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function token(email) {
	const res = await fetch(`${ACC.api}/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ identifier: email, password: PASSWORD }),
	});
	return (await res.json()).data.accessToken;
}
const admin = await token(ACC.people.admin);
const manager = await token(ACC.people.hanh);

// (a) Tạo kỳ bằng token chỉ có report.
const create = await fetch(`${ACC.api}/office/supply-periods`, {
	method: 'POST',
	headers: { authorization: `Bearer ${manager}`, 'content-type': 'application/json' },
	body: JSON.stringify({ officeSiteId: 1, month: '2027-04', deadline: '2027-03-25', departmentIds: [1] }),
});
const createBody = await create.json().catch(() => null);
check('a. POST tạo kỳ', create.status === 403, 'Token chỉ có report bị chặn 403', `${create.status} ${createBody?.error?.code ?? ''}`);

// (b) Cột trong file Excel so với màn hình.
async function headersOf(tok, periodId) {
	const res = await fetch(`${ACC.api}/office/supply-periods/${periodId}/export`, { headers: { authorization: `Bearer ${tok}` } });
	if (res.status !== 200) return { status: res.status, headers: [], sheets: [] };
	const book = new ExcelJS.Workbook();
	await book.xlsx.load(Buffer.from(await res.arrayBuffer()));
	const sheet = book.worksheets[0];
	let headers = [];
	sheet.eachRow((row, index) => {
		if (headers.length) return;
		const values = row.values.slice(1).map(v => String(v?.richText ? v.richText.map(t => t.text).join('') : (v ?? '')).trim());
		if (values.some(v => /^(Tên mặt hàng|Mặt hàng|Tên)/i.test(v))) headers = values.filter(Boolean).map(v => `${v}`);
		if (index > 15) headers = headers.length ? headers : [];
	});
	return { status: res.status, headers, sheets: book.worksheets.map(w => w.name) };
}
const screen = await (await fetch(`${ACC.api}/office/supply-periods/2`, { headers: { authorization: `Bearer ${manager}` } })).json();
const screenDepts = screen.data.departments.map(d => d.name);
const mgrFile = await headersOf(manager, 2);
const adminFile = await headersOf(admin, 2);
console.log(`   màn hình trưởng phòng (phạm vi ${screen.data.scope}): cột phòng ${JSON.stringify(screenDepts)}, không có Dự trù, Cần mua`);
console.log(`   file của trưởng phòng (${mgrFile.status}, sheet ${JSON.stringify(mgrFile.sheets)}): ${JSON.stringify(mgrFile.headers)}`);
console.log(`   file của admin (${adminFile.status}): ${JSON.stringify(adminFile.headers)}`);
const leaked = mgrFile.headers.filter(h => /Dự trù|Cần mua/i.test(h));
const otherDepts = mgrFile.headers.filter(h => adminFile.headers.includes(h) && !screenDepts.includes(h) && /^(Phòng|Kế toán|Ban )/.test(h));
check(
	'b. Cột file Excel của trưởng phòng',
	mgrFile.status === 200 && leaked.length === 0 && otherDepts.length === 0,
	'File không lộ cột màn hình trưởng phòng không thấy',
	`cột thừa: ${JSON.stringify([...leaked, ...otherDepts])}`,
);

// (c) Không tràn ngang ở 768px và 390px.
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
for (const [email, who] of [
	[ACC.people.admin, 'admin'],
	[ACC.people.hanh, 'manager'],
]) {
	for (const width of [768, 390]) {
		const page = await (
			await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 500, hasTouch: width < 500, deviceScaleFactor: 2 })
		).newPage();
		await page.goto(`${WEB}/login`);
		await page.locator('#email').first().waitFor({ timeout: 120000 });
		await page.locator('#email').first().fill(email);
		await page.locator('input[type="password"]').first().fill(PASSWORD);
		await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
		await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 120000 });
		for (const id of who === 'admin' ? [5, 3] : [2]) {
			await page.goto(`${WEB}/management/office/supply-periods/${id}`);
			await page.locator('[aria-busy="true"]').first().waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
			await page.waitForTimeout(1200);
			const m = await page.evaluate(() => {
				const main = document.querySelector('main');
				const doc = document.documentElement;
				return {
					main: main ? main.scrollWidth - main.clientWidth : -1,
					doc: doc.scrollWidth - doc.clientWidth,
				};
			});
			await page.screenshot({ path: `${SHOTS}/${who}-w${width}-period-${id}.png`, fullPage: false });
			check(`c. ${who} ${width}px kỳ ${id}`, m.main <= 0 && m.doc <= 0, 'Không tràn ngang', `main ${m.main}, trang ${m.doc}`);
		}
		await page.context().close();
	}
}
await browser.close();

const bad = results.filter(r => !r.ok);
console.log(`\n=== ${results.length - bad.length}/${results.length} xanh ===`);
process.exit(bad.length ? 1 : 0);
