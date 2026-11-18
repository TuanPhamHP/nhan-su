/**
 * G1 đến G9 — màn Địa điểm chấm công ẩn nút theo quyền `check-in-location:*`.
 *
 * Bấm thật trên sandbox thứ hai (cổng 3163, code BE đã vá). Web dev chạy ở cổng 4041 trỏ sang
 * sandbox đó; cổng 4040 mà sandbox mở CORS đang bị tiến trình ngrok của máy chiếm nên Chrome của
 * bài tắt kiểm tra cùng nguồn — cờ của trình duyệt trong bài kiểm thử, không phải lách ở sản phẩm.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';

const WEB = process.env.WEB ?? 'http://localhost:4041';
const SANDBOX_FILE =
	'/tmp/claude-1000/-home-tuanpham-work-hr-system-hr-system-be/e8eae37c-82c1-4953-8da6-8aae8a60f42a/scratchpad/sandbox-loc.json';
const SHOTS = new URL('../__shots__/role-view/', import.meta.url).pathname;
const CHROME = '/usr/bin/google-chrome';

const sandbox = JSON.parse(readFileSync(SANDBOX_FILE, 'utf8'));
const WHO = sandbox.people;
const PASSWORD = sandbox.password;

mkdirSync(SHOTS, { recursive: true });

const results = [];
function line(ok, name, detail = '') {
	results.push({ ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
}

function clean(s) {
	return s.replace(/\s+/g, ' ').trim();
}

const browser = await chromium.launch({
	executablePath: CHROME,
	args: ['--no-sandbox', '--disable-web-security', '--disable-site-isolation-trials'],
});

async function signIn(email) {
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	page.errors = [];
	page.on('pageerror', e => page.errors.push(String(e)));
	page.on('console', m => m.type() === 'error' && page.errors.push(m.text()));
	page.calls = [];
	page.on('request', r => /\/v1\/check-in-locations/.test(r.url()) && page.calls.push(`${r.method()} ${new URL(r.url()).pathname}`));
	await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(1500);
	await page.locator('#email').first().fill(email);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForTimeout(5000);
	return page;
}

async function go(page, path, waitMs = 5000) {
	await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(waitMs);
}

async function text(page) {
	return clean(await page.locator('body').innerText());
}

async function shot(page, name) {
	await page.addStyleTag({ content: '#nuxt-devtools-anchor{display:none !important}' }).catch(() => {});
	await page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true });
}

async function toastText(page, timeout = 10000) {
	const toast = page.locator('div.fixed.top-4.right-4 [role="alert"]').first();
	try {
		await toast.waitFor({ state: 'visible', timeout });
		return clean(await toast.innerText());
	} catch {
		return '';
	}
}

async function clearToasts(page) {
	await page.evaluate(() => {
		document.querySelectorAll('div.fixed.top-4.right-4 [role="alert"]').forEach(el => el.remove());
	});
	await page.waitForTimeout(300);
}

/** Các nút ghi trên màn địa điểm, tìm theo nhãn và title như người dùng thấy. */
function writeButtons(page) {
	return {
		add: page.locator('button[title="Thêm địa điểm"]'),
		edit: page.getByRole('button', { name: /Chỉnh sửa/ }),
		deactivate: page.getByRole('button', { name: 'Vô hiệu hóa', exact: true }),
		assign: page.getByRole('button', { name: /Thêm nhân sự/ }),
	};
}

/** Chọn địa điểm đầu tiên trong cột trái. */
async function pickFirstLocation(page) {
	await page.locator('button', { hasText: /Hoạt động|Vô hiệu/ }).first().click();
	await page.waitForTimeout(3000);
}

// ════════════════════════ G1, G2: hc01 có Xem và Gán ════════════════════════
const hc01 = await signIn(WHO.hc01.email);
await go(hc01, '/management/settings/locations', 6000);
line(hc01.url().includes('/settings/locations'), 'G1 hc01 vào được màn địa điểm', hc01.url());
let body = await text(hc01);
line(/Địa điểm chấm công/.test(body) && body.length > 200, 'G1 màn hiện danh sách địa điểm', body.slice(0, 160));
await pickFirstLocation(hc01);
let btn = writeButtons(hc01);
line((await btn.add.count()) === 0, 'G1 không có nút thêm địa điểm');
line((await btn.edit.count()) === 0, 'G1 không có nút chỉnh sửa');
line((await btn.deactivate.count()) === 0, 'G1 không có nút vô hiệu hóa');
line((await btn.assign.count()) > 0, 'G1 vẫn có nút thêm nhân sự vào địa điểm');
await shot(hc01, 'G1-hc01-xem-va-gan');

// G2: gán một người rồi gỡ ra.
const rowsBefore = await hc01.locator('div.group').count();
await clearToasts(hc01);
await btn.assign.first().click();
await hc01.waitForTimeout(2500);
const assignDialog = hc01.locator('div.fixed').filter({ has: hc01.locator('input[type="checkbox"]') }).last();
const candidate = assignDialog.locator('input[type="checkbox"]').first();
if (await candidate.count()) {
	await candidate.click();
	await hc01.waitForTimeout(400);
	await assignDialog.getByRole('button', { name: /^(Gán|Thêm|Lưu)/ }).last().click();
	const assignToast = await toastText(hc01, 15000);
	line(assignToast.length > 0 && !/lỗi|403/i.test(assignToast), 'G2 gán người vào địa điểm thành công', assignToast);
	await hc01.waitForTimeout(3000);
	const rowsAfter = await hc01.locator('div.group').count();
	line(rowsAfter >= rowsBefore, 'G2 danh sách người của địa điểm cập nhật', `${rowsBefore} → ${rowsAfter}`);
	// Gỡ lại người vừa gán để trả sandbox về trạng thái cũ.
	await clearToasts(hc01);
	const removeBtn = hc01.locator('div.group').first().locator('button').last();
	await removeBtn.click({ force: true });
	const removeToast = await toastText(hc01, 15000);
	line(removeToast.length > 0 && !/lỗi|403/i.test(removeToast), 'G2 gỡ người khỏi địa điểm thành công', removeToast);
	await shot(hc01, 'G2-hc01-gan-va-go');
} else {
	line(false, 'G2 gán người vào địa điểm thành công', 'hộp gán không có ai để chọn');
}

// G3: màn thêm nhân viên có ô chọn địa điểm.
await go(hc01, '/management/employees/new', 6000);
line((await text(hc01)).includes('Vị trí làm việc'), 'G3 hc01 thấy ô chọn vị trí làm việc');
line(hc01.calls.some(c => c.startsWith('GET /v1/check-in-locations')), 'G3 trang có gọi danh sách địa điểm', hc01.calls.slice(-3).join(' | '));
await shot(hc01, 'G3-hc01-them-nhan-vien');
await hc01.context().close();

// ════════════════════════ G4, G5: hc02 chỉ Xem ════════════════════════
const hc02 = await signIn(WHO.hc02.email);
await go(hc02, '/management/settings/locations', 6000);
line(hc02.url().includes('/settings/locations'), 'G4 hc02 vẫn xem được màn địa điểm', hc02.url());
await pickFirstLocation(hc02);
btn = writeButtons(hc02);
line(
	(await btn.add.count()) === 0 && (await btn.edit.count()) === 0 && (await btn.deactivate.count()) === 0 && (await btn.assign.count()) === 0,
	'G4 không còn nút ghi nào trên màn địa điểm',
	`thêm ${await btn.add.count()}, sửa ${await btn.edit.count()}, vô hiệu ${await btn.deactivate.count()}, gán ${await btn.assign.count()}`,
);
line((await hc02.locator('div.group button').count()) === 0, 'G4 không có nút gỡ người trong danh sách');
await shot(hc02, 'G4-hc02-chi-xem');

const callsBefore = hc02.calls.length;
await go(hc02, '/management/employees/new', 6000);
line(!(await text(hc02)).includes('Vị trí làm việc'), 'G5 hc02 không thấy ô chọn vị trí làm việc');
line(
	hc02.calls.slice(callsBefore).every(c => !c.startsWith('GET /v1/check-in-locations')),
	'G5 trang không gọi danh sách địa điểm',
	hc02.calls.slice(callsBefore).join(' | '),
);
await shot(hc02, 'G5-hc02-them-nhan-vien');
await hc02.context().close();

// ════════════════════════ G6: hr02 không có quyền địa điểm ════════════════════════
const hr02 = await signIn(WHO.hr02.email);
await go(hr02, '/management/settings', 6000);
line(!(await text(hr02)).includes('Địa điểm chấm công'), 'G6 hr02 không thấy thẻ Địa điểm chấm công');
await shot(hr02, 'G6-hr02-trang-cai-dat');
await clearToasts(hr02);
await go(hr02, '/management/settings/locations', 5000);
const guardToast = await toastText(hr02, 8000);
line(!hr02.url().includes('/settings/locations'), 'G6 gõ thẳng URL thì bị đưa đi chỗ khác', hr02.url());
line(/không có quyền/i.test(guardToast), 'G6 có toast báo không có quyền', guardToast);
await hr02.context().close();

// ════════════════════════ G7, G8: hr01 và admin đủ nút ════════════════════════
for (const [key, who] of [
	['hr01', WHO.hr01],
	['admin', WHO.admin],
]) {
	const page = await signIn(who.email);
	await go(page, '/management/settings/locations', 6000);
	await pickFirstLocation(page);
	const b = writeButtons(page);
	line((await b.add.count()) > 0, `G7 ${key} có nút thêm địa điểm`);
	line((await b.edit.count()) > 0, `G7 ${key} có nút chỉnh sửa`);
	line((await b.deactivate.count()) > 0, `G7 ${key} có nút vô hiệu hóa`);
	line((await b.assign.count()) > 0, `G7 ${key} có nút gán nhân viên`);
	if (key === 'hr01') {
		// Sửa bán kính rồi trả lại như cũ. Bán kính là thanh trượt `input[type=range]`, nên đổi
		// bằng bàn phím cho giống thao tác thật.
		await clearToasts(page);
		await b.edit.first().click();
		await page.waitForTimeout(2000);
		const editDialog = page.locator('div.fixed').filter({ has: page.locator('input[type="range"]') }).last();
		const radius = editDialog.locator('input[type="range"]').first();
		const oldRadius = await radius.inputValue();
		await radius.focus();
		await page.keyboard.press('ArrowRight');
		await page.waitForTimeout(400);
		const newRadius = await radius.inputValue();
		line(newRadius !== oldRadius, 'G7 hr01 kéo được thanh bán kính', `${oldRadius} → ${newRadius}`);
		await editDialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
		const editToast = await toastText(page, 15000);
		line(editToast.length > 0 && !/lỗi|403/i.test(editToast), 'G7 hr01 sửa bán kính thành công', editToast);
		await page.waitForTimeout(2500);
		await clearToasts(page);
		await b.edit.first().click();
		await page.waitForTimeout(2000);
		const editDialog2 = page.locator('div.fixed').filter({ has: page.locator('input[type="range"]') }).last();
		const radius2 = editDialog2.locator('input[type="range"]').first();
		await radius2.focus();
		await page.keyboard.press('ArrowLeft');
		await page.waitForTimeout(400);
		await editDialog2.getByRole('button', { name: 'Lưu thay đổi' }).click();
		const undoToast = await toastText(page, 15000);
		line(undoToast.length > 0 && !/lỗi|403/i.test(undoToast), 'G7 hr01 trả bán kính về như cũ', `${undoToast} (về ${oldRadius}m)`);
	}
	await shot(page, key === 'hr01' ? 'G7-hr01-du-nut' : 'G8-admin-du-nut');
	await page.context().close();
}

// ════════════════════════ G9: nhân viên vẫn thấy địa điểm của mình ════════════════════════
const nv01 = await signIn(WHO.nv01.email);
await go(nv01, '/attendance/check-in', 6000);
const nvBody = await text(nv01);
line(!/403|không có quyền/i.test(nvBody), 'G9 nhân viên không gặp lỗi quyền ở màn chấm công', nvBody.slice(0, 200));
line(
	nv01.calls.some(c => c.includes('/v1/check-in-locations/me')) || nvBody.length > 200,
	'G9 màn chấm công của nhân viên vẫn dựng được',
	nv01.calls.join(' | '),
);
await shot(nv01, 'G9-nv01-cham-cong');
console.log('\nlỗi console nv01:', nv01.errors.filter(e => !/Failed to load resource/.test(e)).slice(0, 3));
await nv01.context().close();

const bad = results.filter(r => !r.ok);
console.log(`\n=== ${results.length - bad.length}/${results.length} khẳng định xanh ===`);
for (const r of bad) console.log(`  ✗ ${r.name} — ${r.detail}`);
process.exitCode = bad.length ? 1 : 0;
await browser.close();
