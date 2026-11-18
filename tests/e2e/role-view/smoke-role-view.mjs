/**
 * F1 đến F10 — màn Phân quyền: người có `role:read` được xem, chỉ quản trị viên được sửa.
 *
 * Bấm thật trên sandbox BE cổng 3162 với web dev ở cổng 4040 (CORS của sandbox chỉ mở cổng này).
 * Tài khoản đọc lúc chạy từ file sandbox của session BE, không ghi trong bài.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium, devices } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';

const WEB = process.env.WEB ?? 'http://localhost:4041';
const SANDBOX_FILE =
	'/tmp/claude-1000/-home-tuanpham-work-hr-system-hr-system-be/e8eae37c-82c1-4953-8da6-8aae8a60f42a/scratchpad/sandbox-rv.json';
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

// Cổng 4040 mà sandbox mở CORS đang bị tiến trình ngrok của máy chiếm, nên web dev chạy ở 4041.
// Chrome của bài tắt kiểm tra cùng nguồn để gọi được sandbox; đây là cờ của trình duyệt trong
// bài kiểm thử, không phải chỗ lách ở sản phẩm.
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
	await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(1500);
	await page.locator('#email').first().fill(email);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForTimeout(5000);
	return page;
}

async function go(page, path, waitMs = 4000) {
	await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(waitMs);
}

async function text(page) {
	return clean(await page.locator('body').innerText());
}

async function shot(page, name) {
	await page
		.addStyleTag({ content: '#nuxt-devtools-anchor,.nuxt-devtools-anchor{display:none !important}' })
		.catch(() => {});
	await page.screenshot({ path: `${SHOTS}${name}.png`, fullPage: true });
}

/** Gỡ toast đang hiện, để lần đọc sau không nhặt lại câu của thao tác trước. */
async function clearToasts(page) {
	await page.evaluate(() => {
		document.querySelectorAll('div.fixed.top-4.right-4 [role="alert"]').forEach(el => el.remove());
	});
	await page.waitForTimeout(300);
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

/** Mở lưới chọn phân hệ từ nút ở header. */
async function openLauncher(page) {
	await page.locator('[aria-label="Chuyển phân hệ"]').first().click();
	await page.waitForTimeout(1200);
}

// ════════════════════════ F1 đến F4, F9, F10: hr01 có role:read ════════════════════════
const hr01 = await signIn(WHO.hr01.email);
await hr01.waitForTimeout(2500);
await openLauncher(hr01);
const launcher = clean(await hr01.locator('body').innerText());
line(/Quản trị hệ thống/i.test(launcher), 'F1 hr01 thấy phân hệ Quản trị hệ thống trong lưới', launcher.slice(0, 200));
await shot(hr01, 'F1-hr01-luoi-phan-he');
// Vào phân hệ đó rồi đọc sidebar: mục Phân quyền là một liên kết tới /management/roles. Đọc
// liên kết chứ không đọc chữ, vì mô tả của ô phân hệ cũng có chữ "Phân quyền".
await hr01.getByRole('button', { name: /^Quản trị hệ thống/ }).last().click();
await hr01.waitForTimeout(4000);
// Chờ sidebar của phân hệ dựng xong rồi mới đếm, vì chuyển phân hệ là điều hướng trong ứng dụng.
await hr01.locator('a[href="/management/settings"]').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
line(
	(await hr01.locator('a[href="/management/roles"]').count()) > 0,
	'F1 sidebar của phân hệ có mục Phân quyền',
	hr01.url(),
);

await go(hr01, '/management/roles', 6000);
line(hr01.url().includes('/management/roles'), 'F2 hr01 vào được màn Phân quyền, không bị đá ra', hr01.url());
let body = await text(hr01);
line(
	body.includes('Bạn đang xem ở chế độ chỉ xem. Chỉ quản trị viên được thay đổi phân quyền.'),
	'F2 có dòng báo chế độ chỉ xem',
	body.slice(0, 300),
);
line(!body.includes('Chọn tất cả'), 'F2 không có "Chọn tất cả"');
line(!/Cập nhật quyền|Cập nhật$/m.test(body), 'F2 không có nút Cập nhật quyền');

/** Chọn một vai trò trong danh sách bên trái (cột 288 px đầu trang). */
async function pickRole(page, name) {
	const list = page.locator('div.w-72').first();
	await list.locator('button', { hasText: name }).first().click();
	await page.waitForTimeout(3000);
}

// Chọn vai trò "Nhân sự" rồi đọc trạng thái ô quyền.
await pickRole(hr01, 'Nhân sự');
const boxes = hr01.locator('input[type="checkbox"]');
const total = await boxes.count();
let checked = 0;
let enabled = 0;
for (let i = 0; i < total; i++) {
	if (await boxes.nth(i).isChecked()) checked++;
	if (await boxes.nth(i).isEnabled()) enabled++;
}
line(total > 0 && checked > 0, 'F2 ô quyền hiện đúng trạng thái đã tick', `${checked}/${total} ô được tick`);
line(enabled === 0, 'F2 mọi ô quyền đều khoá, không bấm được', `${enabled} ô còn bấm được`);

// Bấm thử một ô: không được đổi gì.
const before = await boxes.first().isChecked();
await boxes.first().click({ force: true }).catch(() => {});
await hr01.waitForTimeout(800);
line((await boxes.first().isChecked()) === before, 'F2 bấm vào ô quyền không đổi trạng thái');
line(!(await text(hr01)).includes('Bạn có thay đổi chưa được lưu'), 'F2 không hiện dải thay đổi chưa lưu');
await shot(hr01, 'F2-hr01-tab-quyen-chi-xem');

// F4: danh sách vai trò bên trái không có nút tạo, vai trò tuỳ chỉnh không có nút xoá.
const plus = hr01.locator('button[title="Tạo vai trò mới"]');
line((await plus.count()) === 0, 'F4 không có nút "+" tạo vai trò');
await pickRole(hr01, 'Nhân sự phụ');
// "Xóa vai trò" cũng là tên một quyền trong danh sách, nên kiểm bằng nút chứ không bằng chữ.
line(
	(await hr01.getByRole('button', { name: 'Xóa vai trò' }).count()) === 0,
	'F4 vai trò tuỳ chỉnh cũng không có nút Xóa vai trò',
);

// F3: tab Người dùng của vai trò "Nhân viên" (13 người nên có hai trang).
await pickRole(hr01, 'Nhân viên');
await hr01.getByRole('button', { name: 'Người dùng', exact: true }).first().click();
await hr01.waitForTimeout(3000);
body = await text(hr01);
line(/người trong vai trò này/.test(body), 'F3 tab Người dùng hiện danh sách', body.slice(0, 200));
line(!body.includes('Thêm người dùng'), 'F3 không có nút Thêm người dùng');
line((await hr01.getByRole('button', { name: /^Xóa$/ }).count()) === 0, 'F3 không có nút Xóa từng dòng');
line(/Trang \d+ \/ \d+/.test(body), 'F3 có phân trang', (body.match(/Trang \d+ \/ \d+/) ?? [''])[0]);
await shot(hr01, 'F3-hr01-tab-nguoi-dung');

// F9: tải lại trang thì vẫn ở lại.
await hr01.reload({ waitUntil: 'domcontentloaded' });
await hr01.waitForTimeout(6000);
line(hr01.url().includes('/management/roles'), 'F9 tải lại trang vẫn ở màn Phân quyền', hr01.url());
line(
	(await text(hr01)).includes('Bạn đang xem ở chế độ chỉ xem'),
	'F9 sau khi tải lại vẫn ở chế độ chỉ xem',
);

// F10: không trắng trang, có nội dung thật.
body = await text(hr01);
line(body.includes('Danh sách vai trò') && body.length > 200, 'F10 trang hiện đủ nội dung, không trắng', String(body.length));
line(hr01.errors.filter(e => !/Failed to load resource/.test(e)).length === 0, 'F10 không có lỗi JS', hr01.errors.slice(0, 3).join(' | '));
await hr01.context().close();

// ════════════════════════ F5, F6, F7: người không có role:read ════════════════════════
for (const [key, who, backTo] of [
	['hr02', WHO.hr02, '/management'],
	['tp01', WHO.tp01, '/management'],
	['nv01', WHO.nv01, '/'],
]) {
	const page = await signIn(who.email);
	await page.waitForTimeout(2500);
	const launcherBtn = page.locator('[aria-label="Chuyển phân hệ"]');
	const sysApp = page.getByRole('button', { name: /^Quản trị hệ thống/ });
	if (await launcherBtn.count()) {
		await openLauncher(page);
		if (await sysApp.count()) {
			// Vào phân hệ Quản trị hệ thống rồi đọc sidebar: không được có đường vào màn Phân quyền.
			await sysApp.last().click();
			await page.waitForTimeout(4000);
			// Chờ một mục khác của phân hệ hiện ra, để chắc là sidebar đã dựng xong rồi mới kết luận.
			await page.locator('a[href="/management/settings"]').first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
			line(
				(await page.locator('a[href="/management/roles"]').count()) === 0,
				`F5 ${key} không thấy mục Phân quyền trong sidebar phân hệ`,
				page.url(),
			);
		} else {
			line(true, `F5 ${key} không thấy mục Phân quyền trong sidebar phân hệ`, 'không thấy cả phân hệ Quản trị hệ thống');
		}
	} else {
		line(true, `F5 ${key} không thấy mục Phân quyền trong sidebar phân hệ`, 'không có nút mở lưới');
	}

	await go(page, '/management/roles', 5000);
	const toast = await toastText(page, 6000);
	line(!page.url().includes('/management/roles'), `F5 ${key} gõ thẳng URL thì bị đưa đi chỗ khác`, page.url());
	line(page.url().endsWith(backTo), `F5 ${key} về đúng ${backTo}`, page.url());
	if (key !== 'nv01') {
		line(/không có quyền/i.test(toast), `F5 ${key} có toast báo không có quyền`, toast);
	}
	await shot(page, `F5-${key}-bi-chan`);
	await page.context().close();
}

// ════════════════════════ F8: admin vẫn sửa được như cũ ════════════════════════
const admin = await signIn(WHO.admin.email);
await go(admin, '/management/roles', 6000);
body = await text(admin);
line(!body.includes('chế độ chỉ xem'), 'F8 admin không thấy dòng chỉ xem');
line((await admin.locator('button[title="Tạo vai trò mới"]').count()) === 1, 'F8 admin có nút tạo vai trò');
line(body.includes('Chọn tất cả'), 'F8 admin có "Chọn tất cả"');

// Vai trò "Nhân sự phụ" chỉ có một quyền nên chắc chắn còn ô chưa tick để thử.
await pickRole(admin, 'Nhân sự phụ');
const adminBoxes = admin.locator('input[type="checkbox"]');
line((await adminBoxes.first().isEnabled()) === true, 'F8 ô quyền của admin bấm được');

// Tick thêm một quyền rồi lưu, sau đó trả lại trạng thái cũ cho sandbox.
let targetIndex = -1;
const adminTotal = await adminBoxes.count();
for (let i = 1; i < adminTotal; i++) {
	if (!(await adminBoxes.nth(i).isChecked())) {
		targetIndex = i;
		break;
	}
}
if (targetIndex >= 0) {
	await adminBoxes.nth(targetIndex).click();
	await admin.waitForTimeout(800);
	line((await text(admin)).includes('Bạn có thay đổi chưa được lưu'), 'F8 tick quyền thì hiện dải thay đổi chưa lưu');
	await admin.getByRole('button', { name: /^Cập nhật/ }).first().click();
	const saveToast = await toastText(admin, 15000);
	line(/Đã cập nhật quyền/.test(saveToast), 'F8 lưu quyền thành công', saveToast);
	await shot(admin, 'F8-admin-cap-nhat-quyen');
	await admin.waitForTimeout(1500);
	await adminBoxes.nth(targetIndex).click();
	await admin.waitForTimeout(600);
	await admin.getByRole('button', { name: /^Cập nhật/ }).first().click();
	const undoToast = await toastText(admin, 15000);
	line(/Đã cập nhật quyền/.test(undoToast), 'F8 trả lại trạng thái quyền như cũ', undoToast);
} else {
	line(false, 'F8 lưu quyền thành công', 'không tìm thấy ô quyền nào chưa tick');
}

// F8b: thêm rồi gỡ một người ở tab Người dùng.
await admin.getByRole('button', { name: 'Người dùng', exact: true }).first().click();
await admin.waitForTimeout(2500);
// Đếm số dòng thật trong danh sách. Con số ở khung bên phải không tự tươi lại sau khi thêm
// hoặc gỡ người (lỗi sẵn có, xem báo cáo), nên không dùng nó làm thước đo.
const beforeRows = await admin.locator('div.divide-y > div').count();
await clearToasts(admin);
await admin.getByRole('button', { name: /Thêm người dùng/ }).first().click();
await admin.waitForTimeout(2500);
// `div.fixed` cũng khớp khung toast, nên lọc theo chính ô tìm kiếm của hộp thoại.
const addDialog = admin
	.locator('div.fixed')
	.filter({ has: admin.locator('input[placeholder="Tìm theo tên, email, mã NV..."]') })
	.last();
const candidate = addDialog.locator('input[type="checkbox"]').first();
await candidate.click();
await admin.waitForTimeout(500);
await addDialog.getByRole('button', { name: /^Thêm/ }).last().click();
const addToast = await toastText(admin, 15000);
line(addToast.length > 0 && !/lỗi/i.test(addToast), 'F8b thêm người vào vai trò được', addToast);
await admin.waitForTimeout(2500);
const addedRow = admin.locator('div.divide-y > div').first();
const addedName = clean(await addedRow.innerText()).split(' ').slice(0, 3).join(' ');
await clearToasts(admin);
await addedRow.getByRole('button', { name: /^Xóa$/ }).first().click();
const removeToast = await toastText(admin, 15000);
line(/Đã xóa người dùng/.test(removeToast), 'F8b gỡ người khỏi vai trò được', `${addedName} | ${removeToast}`);
await admin.waitForTimeout(4000);
line(
	(await admin.locator('div.divide-y > div').count()) === beforeRows,
	'F8b danh sách người trở lại như trước',
	`trước ${beforeRows} dòng, sau ${await admin.locator('div.divide-y > div').count()} dòng`,
);

// F8c: tạo rồi xoá một vai trò.
const stamp = Date.now() % 100000;
await clearToasts(admin);
await admin.locator('button[title="Tạo vai trò mới"]').click();
await admin.waitForTimeout(1500);
const createDialog = admin
	.locator('div.fixed')
	.filter({ has: admin.locator('input[placeholder="VD: Trưởng phòng kỹ thuật"]') })
	.last();
await createDialog.locator('input[type="text"]').first().fill(`Vai trò thử ${stamp}`);
await createDialog.getByRole('button', { name: 'Tạo vai trò' }).click();
const createToast = await toastText(admin, 15000);
line(createToast.length > 0 && !/lỗi/i.test(createToast), 'F8c tạo được vai trò mới', createToast);
await admin.waitForTimeout(3000);
line((await text(admin)).includes(`Vai trò thử ${stamp}`), 'F8c vai trò mới nằm trong danh sách');
await shot(admin, 'F8-admin-du-nut');

await clearToasts(admin);
await admin.getByRole('button', { name: 'Xóa vai trò' }).first().click();
await admin.waitForTimeout(1200);
await admin
	.locator('div.fixed')
	.filter({ hasText: 'Hành động không thể hoàn tác' })
	.last()
	.getByRole('button', { name: 'Xóa vai trò' })
	.click();
const deleteToast = await toastText(admin, 15000);
line(/Đã xóa vai trò/.test(deleteToast), 'F8c xoá được vai trò vừa tạo', deleteToast);
await admin.waitForTimeout(2500);
line(!(await text(admin)).includes(`Vai trò thử ${stamp}`), 'F8c vai trò đã biến khỏi danh sách');

console.log('\nlỗi console admin:', admin.errors.filter(e => !/Failed to load resource/.test(e)).slice(0, 3));
await admin.context().close();

const bad = results.filter(r => !r.ok);
console.log(`\n=== ${results.length - bad.length}/${results.length} khẳng định xanh ===`);
for (const r of bad) console.log(`  ✗ ${r.name} — ${r.detail}`);
process.exitCode = bad.length ? 1 : 0;
await browser.close();
void devices;
