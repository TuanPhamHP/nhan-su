/**
 * H1 đến H10 — quyền địa điểm chấm công có tác dụng với mọi vai trò, không chỉ HR.
 *
 * Bấm thật trên sandbox cổng 3163 với web dev ở cổng 4041 (sandbox mở CORS đúng cổng này, nên
 * không cần cờ tắt kiểm tra cùng nguồn). Mật khẩu và tài khoản đọc lúc chạy từ file sandbox.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';

const WEB = process.env.WEB ?? 'http://localhost:4041';
const SANDBOX_FILE =
	'/tmp/claude-1000/-home-tuanpham-work-hr-system-hr-system-be/e8eae37c-82c1-4953-8da6-8aae8a60f42a/scratchpad/sandbox-anyrole.json';
const SHOTS = new URL('../__shots__/location-any-role/', import.meta.url).pathname;
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

const clean = s => s.replace(/\s+/g, ' ').trim();

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

async function signIn(email) {
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	page.errors = [];
	page.on('pageerror', e => page.errors.push(String(e)));
	page.on('console', m => m.type() === 'error' && page.errors.push(m.text()));
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

const text = async page => clean(await page.locator('body').innerText());

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

async function openLauncher(page) {
	const btn = page.locator('[aria-label="Chuyển phân hệ"]');
	if ((await btn.count()) === 0) return false;
	await btn.first().click();
	await page.waitForTimeout(1200);
	return true;
}

/** Tên các thẻ đang hiện ở trang Cài đặt. */
async function settingCards(page) {
	const names = ['Địa điểm chấm công', 'Ca làm việc', 'Loại giấy tờ', 'Ngày lễ & Nghỉ bù', 'Loại phiếu đề xuất'];
	const body = await text(page);
	return names.filter(n => body.includes(n));
}

/** Các nút ghi trên màn địa điểm. */
function writeButtons(page) {
	return {
		add: page.locator('button[title="Thêm địa điểm"]'),
		edit: page.getByRole('button', { name: /Chỉnh sửa/ }),
		deactivate: page.getByRole('button', { name: 'Vô hiệu hóa', exact: true }),
		assign: page.getByRole('button', { name: /Thêm nhân sự/ }),
	};
}

async function pickFirstLocation(page) {
	await page.locator('button', { hasText: /Hoạt động|Vô hiệu/ }).first().click();
	await page.waitForTimeout(3000);
}

// ════════════════════════ H1, H2: tb01 — CHIEF chỉ xem địa điểm (ca .118) ════════════════════════
const tb01 = await signIn(WHO.tb01.email);
await tb01.waitForTimeout(2000);
line(await openLauncher(tb01), 'H1 tb01 có nút mở lưới phân hệ');
const tb01Launcher = await text(tb01);
line(/Quản trị hệ thống/.test(tb01Launcher), 'H1 lưới có phân hệ Quản trị hệ thống', tb01Launcher.slice(0, 160));
await shot(tb01, 'H1-tb01-luoi-phan-he');
await tb01.getByRole('button', { name: /^Quản trị hệ thống/ }).last().click();
await tb01.waitForTimeout(5000);
await tb01.locator('a[href="/management/settings"]').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
const tb01Links = await tb01.locator('aside a[href], nav a[href]').evaluateAll(els => els.map(e => e.getAttribute('href')));
line(tb01Links.includes('/management/settings'), 'H1 sidebar có mục Cài đặt', tb01Links.join(' '));
line(
	!tb01Links.includes('/management/roles') &&
		!tb01Links.includes('/management/tools') &&
		!tb01Links.includes('/management/system-logs') &&
		!tb01Links.includes('/management/notifications'),
	'H1 sidebar không có Phân quyền, Tools, Logs, Test Notification',
	tb01Links.join(' '),
);

await go(tb01, '/management/settings', 5000);
let cards = await settingCards(tb01);
line(JSON.stringify(cards) === JSON.stringify(['Địa điểm chấm công']), 'H2 tb01 chỉ thấy thẻ Địa điểm chấm công', cards.join(', '));
await shot(tb01, 'H2-tb01-trang-cai-dat');

await go(tb01, '/management/settings/locations', 6000);
line(tb01.url().includes('/settings/locations'), 'H2 tb01 vào được màn địa điểm', tb01.url());
await pickFirstLocation(tb01);
let btn = writeButtons(tb01);
line(
	(await btn.add.count()) === 0 && (await btn.edit.count()) === 0 && (await btn.deactivate.count()) === 0 && (await btn.assign.count()) === 0,
	'H2 không có nút ghi nào',
	`thêm ${await btn.add.count()}, sửa ${await btn.edit.count()}, vô hiệu ${await btn.deactivate.count()}, gán ${await btn.assign.count()}`,
);
const tb01Body = await text(tb01);
line(/Nhân viên được gán/.test(tb01Body), 'H2 vẫn xem được danh sách người của địa điểm', tb01Body.slice(0, 160));
await shot(tb01, 'H2-tb01-man-dia-diem');
await tb01.context().close();

// ════════════════════════ H3: tb02 — CHIEF xem và gán ════════════════════════
const tb02 = await signIn(WHO.tb02.email);
await go(tb02, '/management/settings/locations', 6000);
await pickFirstLocation(tb02);
btn = writeButtons(tb02);
line((await btn.assign.count()) > 0, 'H3 tb02 có nút thêm nhân sự');
line(
	(await btn.add.count()) === 0 && (await btn.edit.count()) === 0 && (await btn.deactivate.count()) === 0,
	'H3 tb02 không có nút thêm, sửa, vô hiệu hóa',
);
const rowsBefore = await tb02.locator('div.group').count();
await clearToasts(tb02);
await btn.assign.first().click();
await tb02.waitForTimeout(2500);
const assignDialog = tb02.locator('div.fixed').filter({ has: tb02.locator('input[type="checkbox"]') }).last();
// Ô đầu tiên trong hộp là "Chọn tất cả", nên chọn ô của một người cụ thể trong danh sách bên dưới.
const candidate = assignDialog.locator('li input[type="checkbox"]').first();
if (await candidate.count()) {
	await candidate.click();
	await tb02.waitForTimeout(400);
	await assignDialog.getByRole('button', { name: /^(Gán|Thêm|Lưu)/ }).last().click();
	const assignToast = await toastText(tb02, 15000);
	line(assignToast.length > 0 && !/lỗi|403/i.test(assignToast), 'H3 gán người vào địa điểm thành công', assignToast);
	await tb02.waitForTimeout(3000);
	await clearToasts(tb02);
	await tb02.locator('div.group').first().locator('button').last().click({ force: true });
	const removeToast = await toastText(tb02, 15000);
	line(removeToast.length > 0 && !/lỗi|403/i.test(removeToast), 'H3 gỡ người khỏi địa điểm thành công', removeToast);
	await tb02.waitForTimeout(2500);
	line((await tb02.locator('div.group').count()) === rowsBefore, 'H3 danh sách trở lại như trước', `${rowsBefore} dòng`);
} else {
	line(false, 'H3 gán người vào địa điểm thành công', 'hộp gán không có ai để chọn');
}
await shot(tb02, 'H3-tb02-gan-va-go');
await tb02.context().close();

// ════════════════════════ H4: tp01 — MANAGER đủ 5 quyền ════════════════════════
const tp01 = await signIn(WHO.tp01.email);
await go(tp01, '/management/settings/locations', 6000);
await pickFirstLocation(tp01);
btn = writeButtons(tp01);
line((await btn.add.count()) > 0, 'H4 tp01 có nút thêm địa điểm');
line((await btn.edit.count()) > 0, 'H4 tp01 có nút chỉnh sửa');
line((await btn.deactivate.count()) > 0, 'H4 tp01 có nút vô hiệu hóa');
line((await btn.assign.count()) > 0, 'H4 tp01 có nút thêm nhân sự');

await clearToasts(tp01);
await btn.edit.first().click();
await tp01.waitForTimeout(2000);
const editDialog = tp01.locator('div.fixed').filter({ has: tp01.locator('input[type="range"]') }).last();
const radius = editDialog.locator('input[type="range"]').first();
const oldRadius = await radius.inputValue();
await radius.focus();
await tp01.keyboard.press('ArrowRight');
await tp01.waitForTimeout(400);
await editDialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
const editToast = await toastText(tp01, 15000);
line(editToast.length > 0 && !/lỗi|403/i.test(editToast), 'H4 tp01 sửa bán kính thành công', editToast);
await tp01.waitForTimeout(2500);
await clearToasts(tp01);
await btn.edit.first().click();
await tp01.waitForTimeout(2000);
const editDialog2 = tp01.locator('div.fixed').filter({ has: tp01.locator('input[type="range"]') }).last();
await editDialog2.locator('input[type="range"]').first().focus();
await tp01.keyboard.press('ArrowLeft');
await tp01.waitForTimeout(400);
await editDialog2.getByRole('button', { name: 'Lưu thay đổi' }).click();
const undoToast = await toastText(tp01, 15000);
line(undoToast.length > 0 && !/lỗi|403/i.test(undoToast), 'H4 tp01 trả bán kính về như cũ', `${undoToast} (về ${oldRadius}m)`);
await shot(tp01, 'H4-tp01-du-nut');
await tp01.context().close();

// ════════════════════════ H5: tb05 — CHIEF chỉ quản lý loại phiếu ════════════════════════
const tb05 = await signIn(WHO.tb05.email);
await go(tb05, '/management/settings', 5000);
cards = await settingCards(tb05);
line(JSON.stringify(cards) === JSON.stringify(['Loại phiếu đề xuất']), 'H5 tb05 chỉ thấy thẻ Loại phiếu đề xuất', cards.join(', '));
await go(tb05, '/management/settings/request-types', 6000);
const tb05Body = await text(tb05);
line(tb05.url().includes('/settings/request-types'), 'H5 tb05 vào được màn loại phiếu', tb05.url());
line(!/không có quyền|403/i.test(tb05Body) && tb05Body.includes('Loại phiếu'), 'H5 danh sách loại phiếu tải được, không lỗi quyền', tb05Body.slice(0, 200));
await shot(tb05, 'H5-tb05-loai-phieu');
await tb05.context().close();

// ════════════════════════ H6: tb03 — CHIEF không quyền ════════════════════════
const tb03 = await signIn(WHO.tb03.email);
await tb03.waitForTimeout(2000);
if (await openLauncher(tb03)) {
	line(!/Quản trị hệ thống/.test(await text(tb03)), 'H6 tb03 không thấy phân hệ Quản trị hệ thống');
	await tb03.keyboard.press('Escape');
} else {
	line(true, 'H6 tb03 không thấy phân hệ Quản trị hệ thống', 'không có nút mở lưới');
}
await clearToasts(tb03);
await go(tb03, '/management/settings/locations', 5000);
const tb03Toast = await toastText(tb03, 8000);
line(!tb03.url().includes('/settings/locations'), 'H6 gõ thẳng URL thì bị đưa đi chỗ khác', tb03.url());
line(/không có quyền/i.test(tb03Toast), 'H6 có toast báo không có quyền', tb03Toast);
await shot(tb03, 'H6-tb03-bi-chan');
await tb03.context().close();

// ════════════════════════ H7, H8, H9: HR và admin ════════════════════════
const expectAll = ['Địa điểm chấm công', 'Ca làm việc', 'Loại giấy tờ', 'Ngày lễ & Nghỉ bù', 'Loại phiếu đề xuất'];
for (const [key, who, expected] of [
	['hr01', WHO.hr01, expectAll],
	['hr02', WHO.hr02, ['Ca làm việc', 'Loại giấy tờ', 'Ngày lễ & Nghỉ bù']],
	['admin', WHO.admin, expectAll],
]) {
	const page = await signIn(who.email);
	await go(page, '/management/settings', 5000);
	const seen = await settingCards(page);
	line(JSON.stringify(seen) === JSON.stringify(expected), `H7 ${key} thấy đúng các thẻ Cài đặt`, `thấy: ${seen.join(', ')}`);
	await shot(page, `H7-${key}-trang-cai-dat`);
	await page.context().close();
}

// ════════════════════════ H10: nv01 — nhân viên không đổi ════════════════════════
const nv01 = await signIn(WHO.nv01.email);
await nv01.waitForTimeout(2000);
line(!nv01.url().includes('/management'), 'H10 nv01 không ở khu quản trị sau khi đăng nhập', nv01.url());
await go(nv01, '/management/settings', 5000);
line(!nv01.url().includes('/management'), 'H10 nv01 gõ URL quản trị vẫn bị đưa về trang nhân viên', nv01.url());
line(
	nv01.errors.filter(e => !/Failed to load resource/.test(e)).length === 0,
	'H10 không có lỗi JS ở màn nhân viên',
	nv01.errors.slice(0, 2).join(' | '),
);
await shot(nv01, 'H10-nv01-trang-chu');
await nv01.context().close();

const bad = results.filter(r => !r.ok);
console.log(`\n=== ${results.length - bad.length}/${results.length} khẳng định xanh ===`);
for (const r of bad) console.log(`  ✗ ${r.name} — ${r.detail}`);
process.exitCode = bad.length ? 1 : 0;
await browser.close();
