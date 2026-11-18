/**
 * F1 đến F4 — câu "những ngày sẽ được gán" dưới hai hộp gán ca theo khoảng.
 *
 * Không có BE cho nhánh hotfix này, nên bài chặn mọi request `/v1/**` và tự trả dữ liệu: bốn ca
 * khai ngày làm việc khác nhau, một nhân viên trong lưới. Mục đích là nhìn thấy câu thật trên màn
 * thật, vì hàm dựng câu đã có test riêng ở `tests/shift-workdays.test.ts`.
 *
 * Cách chạy: dựng dev server của worktree này ở cổng 4030 rồi `node tests/e2e/shift-range/smoke-hint.mjs`.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';

const WEB = process.env.WEB ?? 'http://localhost:4030';
const SHOTS = new URL('../__shots__/shift-range/', import.meta.url).pathname;
const CHROME = '/usr/bin/google-chrome';

mkdirSync(SHOTS, { recursive: true });

const results = [];
function line(ok, name, detail = '') {
	results.push({ ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
}

const SHIFTS = [
	{ id: 1, name: 'Ca cả tuần', workDays: [1, 2, 3, 4, 5, 6, 0] },
	{ id: 2, name: 'Ca hành chính', workDays: [1, 2, 3, 4, 5] },
	{ id: 3, name: 'Ca sáu ngày', workDays: [1, 2, 3, 4, 5, 6] },
	{ id: 4, name: 'Ca lẻ ngày', workDays: [1, 3, 5] },
].map(s => ({
	checkInTime: '08:00',
	checkOutTime: '17:00',
	breakStartTime: null,
	breakEndTime: null,
	lateThresholdMin: 5,
	earlyThresholdMin: 5,
	isOnline: false,
	requiresLocationCheck: false,
	checkInWindowStart: null,
	checkInWindowEnd: null,
	checkOutWindowStart: null,
	checkOutWindowEnd: null,
	requireCheckIn: true,
	requireCheckOut: true,
	isActive: true,
	createdAt: '2026-01-01T00:00:00.000Z',
	...s,
}));

const ME = {
	id: 1,
	employeeCode: 'EMP001',
	fullName: 'Quản trị viên',
	email: 'admin@example.com',
	role: 'ADMIN',
	status: 'ACTIVE',
	department: { id: 1, name: 'Hành chính - Nhân sự' },
	position: { id: 1, name: 'Trưởng phòng' },
};

const EMPLOYEES = [
	{
		id: 9,
		employeeCode: 'KD01',
		fullName: 'Trịnh Văn Long',
		email: 'kd01@example.com',
		status: 'ACTIVE',
		department: { id: 3, name: 'Kinh doanh' },
	},
];

/** Trả dữ liệu cho mọi endpoint trang này gọi; endpoint lạ thì trả rỗng cho khỏi vỡ trang. */
async function stubApi(page) {
	await page.route('**/v1/**', route => {
		const url = new URL(route.request().url());
		const path = url.pathname;
		const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });

		if (path.endsWith('/v1/employees/me')) return json({ success: true, data: ME });
		if (path.endsWith('/v1/work-shifts')) return json({ success: true, data: SHIFTS });
		if (path.endsWith('/v1/employees')) {
			return json({ success: true, data: EMPLOYEES, meta: { page: 1, limit: 100, total: 1, totalPages: 1 } });
		}
		if (path.endsWith('/v1/shift-schedules/calendar')) return json({ success: true, data: [] });
		if (path.endsWith('/v1/me/entitlements')) return json({ success: true, data: { modules: [] } });
		if (path.endsWith('/v1/me/permissions')) return json({ success: true, data: { permissions: ['*'] } });
		return json({ success: true, data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
	});
}

/** Đọc câu dưới chân hộp đang mở. */
async function hintText(page) {
	const box = page.locator('div.fixed.inset-0').last();
	const hint = box.locator('p.text-xs').filter({ hasText: /Gán vào|Chọn ca để xem|chưa khai ngày/ }).last();
	return (await hint.count()) ? (await hint.innerText()).replace(/\s+/g, ' ').trim() : '';
}

/**
 * Chọn một ca trong hộp đang mở.
 *
 * Nhãn option là "<tên ca> (08:00 – 17:00)" nên tìm theo tiền tố tên, và option của `UiSelect`
 * được teleport ra body nên bấm bằng evaluate cho khỏi vướng "ngoài khung nhìn".
 */
async function pickShift(page, name) {
	const box = page.locator('div.fixed.inset-0').last();
	await box.locator('label', { hasText: 'Ca làm việc' }).first().locator('xpath=following::button[1]').click();
	await page.waitForTimeout(600);
	const option = page.getByRole('button', { name: new RegExp(`^${name} \\(`) }).last();
	await option.waitFor({ state: 'attached', timeout: 10000 });
	await option.evaluate(el => el.click());
	await page.waitForTimeout(700);
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([
	{ name: 'access_token', value: 'stub-token', url: WEB },
	{ name: 'refresh_token', value: 'stub-refresh', url: WEB },
]);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
await stubApi(page);

await page.goto(`${WEB}/management/settings/shifts`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
// Trang mở ở tab "Khuôn ca"; hai hộp gán ca nằm ở tab "Phân ca".
await page.getByRole('button', { name: /^Phân ca/ }).first().click();
await page.waitForTimeout(2500);
line(
	(await page.locator('body').innerText()).includes('Gán hàng loạt'),
	'mở được tab Phân ca với dữ liệu giả',
	(await page.locator('body').innerText()).slice(0, 200).replace(/\s+/g, ' '),
);

// ─── F1, F2, F3: hộp "Gán ca hàng loạt" ───
await page.getByRole('button', { name: 'Gán hàng loạt' }).first().click();
await page.waitForTimeout(1200);
line((await hintText(page)) === 'Chọn ca để xem những ngày sẽ được gán.', 'F1 chưa chọn ca thì nhắc chọn ca', await hintText(page));
await page.screenshot({ path: `${SHOTS}F1-chua-chon-ca.png`, fullPage: true });

await pickShift(page, 'Ca cả tuần');
line((await hintText(page)) === 'Gán vào T2–CN theo khuôn ca, ghi đè ca đã có.', 'F2 ca khai T2–CN', await hintText(page));
await page.screenshot({ path: `${SHOTS}F2-ca-ca-tuan.png`, fullPage: true });

await pickShift(page, 'Ca hành chính');
line((await hintText(page)) === 'Gán vào T2–T6 theo khuôn ca, ghi đè ca đã có.', 'F3 đổi sang ca T2–T6', await hintText(page));
await page.screenshot({ path: `${SHOTS}F3-ca-hanh-chinh.png`, fullPage: true });

await pickShift(page, 'Ca lẻ ngày');
line(
	(await hintText(page)) === 'Gán vào T2, T4, T6 theo khuôn ca, ghi đè ca đã có.',
	'F3b ca không liền thì liệt kê từng ngày',
	await hintText(page),
);
await page.screenshot({ path: `${SHOTS}F3b-ca-le-ngay.png`, fullPage: true });

await page.getByRole('button', { name: 'Hủy' }).last().click();
await page.waitForTimeout(800);

// ─── F4: hộp "Gán ca theo khoảng" của một nhân viên ───
await page.getByRole('button', { name: /Trịnh Văn Long/ }).first().click();
await page.waitForTimeout(1200);
line((await hintText(page)) === 'Chọn ca để xem những ngày sẽ được gán.', 'F4 hộp một nhân viên: chưa chọn ca', await hintText(page));
await pickShift(page, 'Ca sáu ngày');
line((await hintText(page)) === 'Gán vào T2–T7 theo khuôn ca, ghi đè ca đã có.', 'F4 ca khai T2–T7', await hintText(page));
await page.screenshot({ path: `${SHOTS}F4-mot-nhan-vien-ca-sau-ngay.png`, fullPage: true });

console.log('\nlỗi console:', errors.filter(e => !/Failed to load resource|favicon/.test(e)).slice(0, 5));
const bad = results.filter(r => !r.ok);
console.log(`\n=== ${results.length - bad.length}/${results.length} khẳng định xanh ===`);
for (const r of bad) console.log(`  ✗ ${r.name} — ${r.detail}`);
process.exitCode = bad.length ? 1 : 0;
await browser.close();
