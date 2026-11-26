/**
 * Chạy hai hướng dẫn của trang Văn phòng phẩm ("Đăng ký văn phòng phẩm", "Chọn người nhận hàng")
 * bằng tài khoản trưởng phòng và nhân viên trên sandbox (xem sandbox.cjs). Mỗi bước ghi tên bước, có
 * ô sáng hay không, và báo khi bước có mốc mà không thấy ô sáng (mốc `data-tour` bị mất). Không ghi gì.
 *
 *   node tests/e2e/supply-catalog/tours.mjs [thư mục ảnh]
 */
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const WEB = 'http://127.0.0.1:4999';
const ACC = JSON.parse(readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/p1-accounts.json', 'utf8'));
const PASSWORD = /const PASSWORD\s*=\s*['"`]([^'"`]+)['"`]/.exec(
	readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/drill-p1.cjs', 'utf8'),
)[1];
const SHOTS = process.argv[2] ?? '/tmp/supply-tours';
mkdirSync(SHOTS, { recursive: true });

/** Bước mong đợi theo từng vai, lấy từ `app/tours/office-supplies.ts`; `true` là bước có mốc. */
const EXPECT = {
	register: {
		manager: [
			['Kỳ đang đăng ký', true],
			['Phiếu khác của phòng', true],
			['Lấy số tháng trước', true],
			['Tìm và lọc mặt hàng', true],
			['Gõ số ngay trên dòng', true],
			['Mặt hàng ngoài danh mục', true],
			['Đã lưu chưa', true],
			['Không có nút nộp', false],
		],
	},
	contact: {
		manager: [
			['Đầu mối nhận hàng', true],
			['Đổi đầu mối', true],
			['Chọn người và lưu', true],
		],
	},
};
EXPECT.register.employee = EXPECT.register.manager;

const results = [];
function check(id, ok, name, detail = '') {
	results.push({ id, ok: !!ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${id} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function signIn(browser, email) {
	const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
	page.errors = [];
	page.on('pageerror', err => page.errors.push(String(err)));
	await page.goto(`${WEB}/login`);
	await page.locator('#email').first().waitFor({ timeout: 120000 });
	await page.locator('#email').first().fill(email);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 120000 });
	await page.goto(`${WEB}/office/supplies`);
	await page.locator('[data-tour="supply-period-bar"]').waitFor({ timeout: 60000 });
	await page.waitForTimeout(800);
	return page;
}

/** Mở danh sách Hướng dẫn, trả tên các hướng dẫn đang thấy. */
async function guideTitles(page) {
	await page.getByRole('button', { name: 'Hướng dẫn theo tính năng' }).click();
	const list = page.getByRole('dialog', { name: 'Danh sách hướng dẫn' });
	await list.waitFor();
	for (const btn of await list.locator('button[aria-expanded="false"]:not([disabled])').all()) await btn.click();
	return list.locator('button span.block.text-sm').allInnerTexts();
}

async function runTour(page, title, tag) {
	const list = page.getByRole('dialog', { name: 'Danh sách hướng dẫn' });
	await list.getByRole('button', { name: new RegExp(title) }).click();
	const seen = [];
	for (let i = 0; i < 15; i++) {
		const box = page.locator('[aria-labelledby="tour-box-title"]');
		try {
			await box.waitFor({ timeout: 8000 });
		} catch {
			break;
		}
		const stepTitle = (await page.locator('#tour-box-title').innerText()).trim();
		if (seen.length && seen.at(-1).title === stepTitle) break;
		await page.waitForTimeout(500);
		const lit = await page.locator('[data-tour-overlay] .ring-2').count();
		seen.push({ title: stepTitle, lit: lit > 0 });
		await page.screenshot({ path: `${SHOTS}/${tag}-${String(seen.length).padStart(2, '0')}.png` });
		const primary = page.locator('[aria-labelledby="tour-box-title"] button').last();
		const label = (await primary.innerText()).trim();
		await primary.click();
		if (label === 'Xong') break;
		// Chờ bước sau hiện (hoặc tour đóng).
		await page.waitForFunction(
			prev => document.querySelector('#tour-box-title')?.textContent?.trim() !== prev,
			stepTitle,
			{ timeout: 10000 },
		).catch(() => {});
	}
	await page.waitForTimeout(500);
	return seen;
}

function compare(id, name, seen, expected) {
	const got = seen.map(s => `${s.title}${s.lit ? '' : ' (không ô sáng)'}`);
	const want = expected.map(([t, lit]) => `${t}${lit ? '' : ' (không ô sáng)'}`);
	const ok = got.length === want.length && got.every((g, i) => g === want[i]);
	check(id, ok, name, ok ? `${seen.length} bước đủ, mốc đúng` : `thấy [${got.join(' | ')}], mong [${want.join(' | ')}]`);
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });

// Trưởng phòng: Đỗ Hồng Hạnh (quản lý phòng HCNS).
let page = await signIn(browser, ACC.people.hanh);
let titles = await guideTitles(page);
check('mgr.list', titles.includes('Đăng ký văn phòng phẩm') && titles.includes('Chọn người nhận hàng'), 'Trưởng phòng thấy cả hai hướng dẫn', titles.join(' | '));
compare('mgr.register', 'Tour đăng ký, trưởng phòng', await runTour(page, 'Đăng ký văn phòng phẩm', 'mgr-register'), EXPECT.register.manager);
await guideTitles(page);
compare('mgr.contact', 'Tour đầu mối, trưởng phòng', await runTour(page, 'Chọn người nhận hàng', 'mgr-contact'), EXPECT.contact.manager);
const formLeft = await page.locator('[data-tour="supply-contact-form"]').count();
check('mgr.contact.close', formLeft === 0, 'Hết tour thì hộp chọn đầu mối tự đóng', `${formLeft} hộp còn mở`);
check('mgr.err', page.errors.length === 0, 'Không lỗi JS', page.errors.join(' | '));
await page.context().close();

// Nhân viên: Trần Minh Tuấn (không phải trưởng phòng, không phải đầu mối).
page = await signIn(browser, ACC.people.tuan);
titles = await guideTitles(page);
check('emp.list', titles.includes('Đăng ký văn phòng phẩm') && !titles.includes('Chọn người nhận hàng'), 'Nhân viên chỉ thấy hướng dẫn đăng ký (đầu mối là việc của quản lý)', titles.join(' | '));
compare('emp.register', 'Tour đăng ký, nhân viên', await runTour(page, 'Đăng ký văn phòng phẩm', 'emp-register'), EXPECT.register.employee);
check('emp.err', page.errors.length === 0, 'Không lỗi JS', page.errors.join(' | '));
await page.context().close();

await browser.close();
const bad = results.filter(r => !r.ok);
console.log(`\n=== ${results.length - bad.length}/${results.length} xanh ===`);
process.exit(bad.length ? 1 : 0);
