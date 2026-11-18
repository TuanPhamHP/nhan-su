/**
 * F1 đến F5 — form tạo đơn nghỉ hiện số ngày do máy chủ tính, không tự đếm bỏ cuối tuần.
 *
 * Không có BE cho nhánh hotfix này nên bài chặn mọi request `/v1/**` và tự trả dữ liệu, trong đó
 * `POST /v1/leave-requests/preview` trả `totalDays` theo từng kịch bản. Bài cố tình trả chậm một
 * nhịp để nhìn được câu "Đang tính số ngày…".
 *
 * Cách chạy: dựng dev server của worktree này ở cổng 4030 rồi
 * `node tests/e2e/leave-days/smoke-duration.mjs`.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';

const WEB = process.env.WEB ?? 'http://localhost:4030';
const SHOTS = new URL('../__shots__/leave-days/', import.meta.url).pathname;
const CHROME = '/usr/bin/google-chrome';

mkdirSync(SHOTS, { recursive: true });

const results = [];
function line(ok, name, detail = '') {
	results.push({ ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
}

const ME = {
	id: 1,
	employeeCode: 'KD01',
	fullName: 'Trịnh Văn Long',
	email: 'kd01@example.com',
	role: 'EMPLOYEE',
	status: 'ACTIVE',
	employmentType: 'FULL_TIME',
	department: { id: 3, name: 'Kinh doanh' },
	position: { id: 2, name: 'Nhân viên' },
};

const LEAVE_TYPES = [
	{ id: 1, name: 'Nghỉ phép năm', code: 'ANNUAL', daysPerYear: 12, isPaid: true, isActive: true },
	{ id: 2, name: 'Nghỉ nửa ngày', code: 'HALF_DAY', daysPerYear: null, isPaid: true, isActive: true },
	{ id: 3, name: 'Đi muộn', code: 'LATE', daysPerYear: null, isPaid: true, isActive: true },
	{ id: 4, name: 'Về sớm', code: 'EARLY', daysPerYear: null, isPaid: true, isActive: true },
];

/** `totalDays` bài muốn preview trả về lần gọi tới, và độ trễ để thấy trạng thái đang tải. */
const nextPreview = { totalDays: 2, delayMs: 0 };

async function stubApi(page) {
	await page.route('**/v1/**', async route => {
		const path = new URL(route.request().url()).pathname;
		const json = data => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });

		if (path.endsWith('/v1/employees/me')) return json({ success: true, data: ME });
		if (path.endsWith('/v1/leave-types')) return json({ success: true, data: LEAVE_TYPES });
		if (path.endsWith('/v1/leave-balances/me')) {
			return json({
				success: true,
				data: [
					{
						id: 1,
						year: 2026,
						totalDays: 12,
						usedDays: 3,
						remainingDays: 9,
						leaveType: { id: 1, name: 'Nghỉ phép năm', code: 'ANNUAL' },
					},
				],
			});
		}
		if (path.endsWith('/v1/leave-requests/preview')) {
			if (nextPreview.delayMs) await new Promise(r => setTimeout(r, nextPreview.delayMs));
			return json({
				success: true,
				data: {
					totalDays: nextPreview.totalDays,
					paidDays: nextPreview.totalDays,
					unpaidDays: 0,
					leaveCode: 'P',
					warningMessage: null,
					remainingAfter: Math.max(0, 9 - nextPreview.totalDays),
					currentBalance: 9,
				},
			});
		}
		// Lịch ca của ngày đang chọn: có giờ nghỉ trưa thì ca mới cho nghỉ nửa ngày.
		if (path.endsWith('/v1/shift-schedules/me') || path.endsWith('/v1/shift-schedules')) {
			return json({
				success: true,
				data: [
					{
						id: 1,
						date: '2026-11-21',
						employee: { id: ME.id, fullName: ME.fullName, employeeCode: ME.employeeCode },
						shift: {
							id: 1,
							name: 'Ca cả tuần',
							checkInTime: '08:00',
							checkOutTime: '17:00',
							breakStartTime: '12:00',
							breakEndTime: '13:00',
							workDays: [1, 2, 3, 4, 5, 6, 0],
						},
					},
				],
			});
		}
		if (path.endsWith('/v1/me/entitlements')) return json({ success: true, data: { modules: [] } });
		if (path.endsWith('/v1/me/permissions')) return json({ success: true, data: { permissions: ['*'] } });
		return json({ success: true, data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
	});
}

/** Câu trong ô "Khoảng thời gian". */
async function durationText(page) {
	const box = page.locator('div', { hasText: /^Khoảng thời gian: / }).last();
	return (await box.count()) ? (await box.innerText()).replace(/\s+/g, ' ').replace('Khoảng thời gian: ', '').trim() : '';
}

/** Loại đơn là thẻ `select` thường, không phải `UiSelect`. */
async function pickLeaveType(page, name) {
	await page.locator('select').first().selectOption({ label: name });
	await page.waitForTimeout(1000);
}

/**
 * Chọn khoảng ngày bằng nút preset của `UiDateRangePicker`.
 *
 * Ô lịch dựng ô ngày bằng `div` với class băm của CSS module nên bấm từng ngày rất dễ trượt; bài
 * này chỉ cần một khoảng hợp lệ vì số ngày là do preview trả về, không phải do khoảng quyết định.
 */
async function pickRange(page, presetLabel) {
	await page.locator('div', { hasText: /^Chọn khoảng ngày$|^\d{2}\/\d{2}\/\d{4} – \d{2}\/\d{2}\/\d{4}$/ }).last().click();
	await page.waitForTimeout(700);
	await page.getByRole('button', { name: presetLabel, exact: true }).last().click();
	await page.waitForTimeout(400);
	await page.keyboard.press('Escape');
	await page.waitForTimeout(300);
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'access_token', value: 'stub-token', url: WEB }]);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
await stubApi(page);

await page.goto(`${WEB}/users/leave-requests/create`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
line(body.includes('Hình thức'), 'mở được form tạo đơn nghỉ với dữ liệu giả', body.slice(0, 200));

// ─── F4: ghi chú của phép năm ───
await pickLeaveType(page, 'Nghỉ phép năm');
const note = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
line(
	note.includes('Số ngày nghỉ tính theo ca làm việc của bạn: ngày có ca thì tính, kể cả thứ Bảy, Chủ nhật; ngày lễ không tính.'),
	'F4 ghi chú phép năm nói đúng luật mới',
	note.slice(0, 300),
);
line(!note.includes('cuối tuần không tính'), 'F4 không còn câu "ngày lễ và cuối tuần không tính"');
await page.screenshot({ path: `${SHOTS}F4-ghi-chu-phep-nam.png`, fullPage: true });

// ─── F3 rồi F1: chọn khoảng T7–CN, preview chậm một nhịp rồi trả 2 ngày ───
nextPreview.totalDays = 2;
nextPreview.delayMs = 2500;
await pickRange(page, 'Tuần này');
await page.waitForTimeout(900);
line((await durationText(page)) === 'Đang tính số ngày…', 'F3 trong lúc chờ máy chủ thì báo đang tính', await durationText(page));
await page.screenshot({ path: `${SHOTS}F3-dang-tinh.png`, fullPage: true });

await page.waitForTimeout(3500);
line((await durationText(page)) === '2 ngày nghỉ (tính theo ca)', 'F1 nghỉ T7 và CN ra 2 ngày theo ca', await durationText(page));
line(!(await durationText(page)).includes('server sẽ tính lại'), 'F1 bỏ chú thích "server sẽ tính lại"');
await page.screenshot({ path: `${SHOTS}F1-hai-ngay-theo-ca.png`, fullPage: true });

// ─── F2: khoảng không có ngày nào có ca ───
nextPreview.totalDays = 0;
nextPreview.delayMs = 0;
await pickRange(page, 'Tháng này');
await page.waitForTimeout(2500);
line(
	(await durationText(page)) === '0 ngày: khoảng này không có ngày nào bạn có ca',
	'F2 khoảng không có ca thì nói rõ vì sao bằng không',
	await durationText(page),
);
await page.screenshot({ path: `${SHOTS}F2-khong-co-ngay-nao-co-ca.png`, fullPage: true });

// ─── F5: nửa ngày, đi muộn, về sớm giữ nguyên ───
await pickLeaveType(page, 'Nghỉ nửa ngày');
await page.waitForTimeout(1200);
line((await durationText(page)) === '0.5 ngày', 'F5 nửa ngày vẫn là 0.5 ngày', await durationText(page));
await page.screenshot({ path: `${SHOTS}F5-nua-ngay.png`, fullPage: true });

await pickLeaveType(page, 'Đi muộn');
await page.waitForTimeout(800);
const lateInput = page.locator('input[type="number"], input[inputmode="numeric"]').first();
if (await lateInput.count()) {
	await lateInput.fill('30');
	await page.waitForTimeout(800);
	line((await durationText(page)) === '30 phút', 'F5 đi muộn vẫn tính bằng phút', await durationText(page));
	await page.screenshot({ path: `${SHOTS}F5-di-muon.png`, fullPage: true });
} else {
	line(false, 'F5 đi muộn vẫn tính bằng phút', 'không tìm thấy ô nhập số phút');
}

console.log('\nlỗi console:', errors.filter(e => !/Failed to load resource|favicon|socket\.io/.test(e)).slice(0, 5));
const bad = results.filter(r => !r.ok);
console.log(`\n=== ${results.length - bad.length}/${results.length} khẳng định xanh ===`);
for (const r of bad) console.log(`  ✗ ${r.name} — ${r.detail}`);
process.exitCode = bad.length ? 1 : 0;
await browser.close();
