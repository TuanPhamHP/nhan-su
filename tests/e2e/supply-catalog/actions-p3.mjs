/**
 * Bấm thử thật các việc trên trang Chi tiết kỳ chưa có trong smoke-p3: Thêm phòng, Huỷ kỳ, Phiếu bổ sung, Chốt, Cấp,
 * Ghi đã giao thay, Sửa số thực nhận, Đóng kỳ. Mỗi việc: mở từ menu Khác hoặc hộp thoại → xác nhận → đối chiếu API
 * → màn đổi trạng thái mà không tải lại trang (đếm số lần trang tải).
 *
 * Chạy sau seed-p3.cjs (kỳ 7 rỗng để thêm phòng rồi huỷ; kỳ 3 đã khoá có phiếu ở đủ bước; kỳ 1 có phiếu đã nhận).
 *
 *   node tests/e2e/supply-catalog/actions-p3.mjs <thư mục ảnh>
 */
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const WEB = 'http://127.0.0.1:4999';
const ACC = JSON.parse(readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/p1-accounts.json', 'utf8'));
const PASSWORD = /const PASSWORD\s*=\s*['"`]([^'"`]+)['"`]/.exec(
	readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/drill-p1.cjs', 'utf8'),
)[1];
const SHOTS = process.argv[2] ?? '/tmp/supply-actions-p3';
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(id, ok, name, detail = '') {
	results.push({ id, ok: !!ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${id} ${name}${detail ? ` — ${detail}` : ''}`);
}
const clean = s => String(s).replace(/\s+/g, ' ').trim();

const adminTok = await (async () => {
	const res = await fetch(`${ACC.api}/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ identifier: ACC.people.admin, password: PASSWORD }),
	});
	return (await res.json()).data.accessToken;
})();
async function get(url) {
	const res = await fetch(`${ACC.api}${url}`, { headers: { authorization: `Bearer ${adminTok}` } });
	return { status: res.status, data: (await res.json().catch(() => null))?.data };
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', err => errors.push(String(err)));
/** Số lần tài liệu được tải (điều hướng thật); đổi trạng thái tại chỗ thì không tăng. */
let loads = 0;
page.on('load', () => loads++);
const calls = [];
page.on('request', req => {
	if (req.method() !== 'GET' && /\/v1\/office\//.test(req.url())) calls.push(`${req.method()} ${new URL(req.url()).pathname}`);
});

await page.goto(`${WEB}/login`);
await page.locator('#email').first().waitFor({ timeout: 120000 });
await page.locator('#email').first().fill(ACC.people.admin);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 120000 });

async function openPeriod(id) {
	await page.goto(`${WEB}/management/office/supply-periods/${id}`);
	await page.locator('[aria-busy="true"]').first().waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
	await page.waitForTimeout(800);
	await page.addStyleTag({ content: '#nuxt-devtools-anchor,.nuxt-devtools-anchor{display:none !important}' }).catch(() => {});
	loads = 0;
	calls.length = 0;
}
async function menu(label) {
	await page.getByRole('button', { name: /^Khác/ }).click();
	await page.getByText(label, { exact: true }).click();
}
const toast = async () => clean(await page.locator('div.fixed.top-4.right-4 [role="alert"]').last().innerText({ timeout: 15000 }).catch(() => ''));
async function clearToasts() {
	await page.evaluate(() => document.querySelectorAll('div.fixed.top-4.right-4 [role="alert"] button').forEach(b => b.click()));
	await page.waitForTimeout(300);
}
const requestRows = () => page.locator('#period-request-list > li');
/** Dòng phiếu trong danh sách mở rộng, theo tên phòng và nhãn trạng thái. */
function rowWith(text) {
	return requestRows().filter({ hasText: text }).first();
}
const reqModal = () => page.getByRole('dialog', { name: 'Chi tiết phiếu văn phòng phẩm' });

/** Chạy từ phần nào: 1 = kỳ 7 (thêm phòng, huỷ), 3 = kỳ 3, 7 = kỳ 1 (sửa số nhận), 8 = chỉ đóng kỳ 1. */
const FROM = Number(process.env.FROM ?? 1);
try {
if (FROM <= 1) {
// ─── Kỳ 7: Thêm phòng rồi Huỷ kỳ ────────────────────────────────────────────
await openPeriod(7);
await menu('Thêm phòng');
const addDlg = page.getByRole('dialog', { name: 'Thêm phòng vào kỳ' });
const boxes = addDlg.locator('input[type="checkbox"]');
await boxes.nth(0).check();
await boxes.nth(1).check();
await page.screenshot({ path: `${SHOTS}/01-add-departments.png` });
await clearToasts();
await addDlg.getByRole('button', { name: /^Thêm 2 phòng vào kỳ$/ }).click();
let t = await toast();
await page.waitForTimeout(800);
let title = clean(await page.locator('#period-departments-title').innerText());
let p7 = await get('/office/supply-periods/7');
check(
	'1. Thêm phòng',
	/Đã thêm 2 phòng/.test(t) && /0\/4 đã đăng ký/.test(title) && p7.data?.period?.departmentsTotal === 4 && calls.includes('POST /v1/office/supply-periods/7/departments') && loads === 0,
	'Menu Khác → hộp chọn phòng → API thêm phòng; card cập nhật tại chỗ',
	`toast "${t.slice(0, 50)}"; "${title}"; API ${p7.data?.period?.departmentsTotal} phòng; gọi ${calls.join(', ')}; tải trang ${loads}`,
);

calls.length = 0;
await menu('Huỷ kỳ');
const cancelDlg = page.getByRole('dialog', { name: 'Huỷ kỳ?' });
const cancelText = clean(await cancelDlg.innerText());
await clearToasts();
await cancelDlg.getByRole('button', { name: 'Huỷ kỳ này' }).click();
await page.waitForURL(/supply-periods\/?$/, { timeout: 20000 }).catch(() => {});
t = await toast();
p7 = await get('/office/supply-periods/7');
check(
	'2. Huỷ kỳ',
	/biến mất khỏi danh sách/.test(cancelText) && /Đã huỷ kỳ/.test(t) && p7.status === 404 && /supply-periods\/?$/.test(new URL(page.url()).pathname) && calls.includes('POST /v1/office/supply-periods/7/cancel'),
	'Hỏi lại → API huỷ → kỳ không còn (404), về danh sách kỳ, không hỏi "chưa lưu"',
	`toast "${t.slice(0, 50)}"; GET kỳ 7 → ${p7.status}; ${page.url()}`,
);

}
if (FROM <= 3) {
// ─── Kỳ 3: Phiếu bổ sung, Chốt, Cấp, Ghi đã giao thay ──────────────────────
await openPeriod(3);
const before3 = (await get('/office/supply-periods/3')).data;
const target = before3.departments.find(d => d.requests.length === 1 && d.requests[0].status === 'LOCKED' && d.requests[0].lineCount > 0);
const rowsBefore = await requestRows().count();
await menu('Phiếu bổ sung');
const supp = page.getByRole('dialog', { name: 'Tạo phiếu bổ sung' });
// Hộp chọn sẵn phòng đầu tiên: mở ô chọn ngay sau nhãn "Phòng ban".
await supp.locator('label:has-text("Phòng ban") + div button').first().click();
await page.locator('button').filter({ hasText: new RegExp(`^\\s*${target.name}\\s*$`) }).last().click();
await supp.getByPlaceholder('VD: Thiếu giấy in cho đợt quyết toán').fill('Phát sinh hội thảo cuối năm');
await supp.getByText('Chọn mặt hàng').click();
await page.getByPlaceholder('Tìm mặt hàng').last().fill('but chi');
await page.waitForTimeout(300);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await supp.getByPlaceholder('Số lượng').fill('4');
await page.screenshot({ path: `${SHOTS}/03-supplement.png` });
await clearToasts();
await supp.getByRole('button', { name: 'Tạo phiếu bổ sung' }).click();
await supp.waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1000);
const after3 = (await get('/office/supply-periods/3')).data;
const targetAfter = after3.departments.find(d => d.departmentId === target.departmentId);
const rowsAfter = await requestRows().count();
check(
	'3. Phiếu bổ sung',
	targetAfter.requests.length === 2 && rowsAfter === rowsBefore + 1 && calls.includes('POST /v1/office/supply-periods/3/supplements') && loads === 0,
	'Menu Khác → hộp phiếu bổ sung → API; danh sách phiếu thêm một dòng tại chỗ',
	`${target.name}: ${targetAfter.requests.length} phiếu; dòng ${rowsBefore}→${rowsAfter}; tải trang ${loads}`,
);

// Chốt rồi Cấp phiếu chính của phòng vừa có phiếu bổ sung.
const mainId = target.requests[0].id;
calls.length = 0;
await rowWith(target.name).filter({ hasText: 'Đã khoá' }).getByRole('button', { name: /^Chốt phiếu/ }).click();
await reqModal().getByRole('button', { name: 'Chốt phiếu' }).click();
await page.waitForTimeout(1200);
const modalChip = clean(await reqModal().innerText()).match(/Đã chốt, chờ cấp/)?.[0] ?? '';
await reqModal().getByRole('button', { name: 'Đóng', exact: true }).click();
await page.waitForTimeout(800);
let rowText = clean(await rowWith(target.name).filter({ hasNotText: 'bổ sung' }).innerText());
let req = (await get(`/office/supply-requests/${mainId}`)).data;
check(
	'4. Chốt',
	req?.status === 'FINALIZED' && /Đã chốt, chờ cấp/.test(modalChip) && /Đã chốt, chờ cấp/.test(rowText) && calls.includes(`POST /v1/office/supply-requests/${mainId}/finalize`) && loads === 0,
	'Dòng phiếu → hộp phiếu → Chốt phiếu → API; dòng trên trang đổi trạng thái tại chỗ',
	`API ${req?.status}; dòng "${rowText.slice(0, 80)}"`,
);

calls.length = 0;
await rowWith(target.name).filter({ hasNotText: 'bổ sung' }).getByRole('button', { name: /^Cấp phiếu/ }).click();
await reqModal().getByRole('button', { name: 'Cấp hàng' }).click();
await page.waitForTimeout(1200);
await reqModal().getByRole('button', { name: 'Đóng', exact: true }).click();
await page.waitForTimeout(800);
rowText = clean(await rowWith(target.name).filter({ hasNotText: 'bổ sung' }).innerText());
req = (await get(`/office/supply-requests/${mainId}`)).data;
const stage3 = clean(await page.locator('[data-tour="period-stage"]').innerText());
check(
	'5. Cấp',
	req?.status === 'ISSUED' && /Đã cấp, chờ nhận/.test(rowText) && calls.includes(`POST /v1/office/supply-requests/${mainId}/issue`) && loads === 0,
	'Cấp hàng → API; dòng phiếu và tiến độ đầu trang cập nhật tại chỗ',
	`API ${req?.status}; "${stage3.match(/Đã chốt[^p]*/)?.[0]}"`,
);

// Ghi đã giao thay: phiếu đã cấp từ 10 ngày trước (seed lùi issuedAt).
const proxy = before3.departments.flatMap(d => d.requests.map(r => ({ ...r, name: d.name }))).find(r => r.status === 'ISSUED');
calls.length = 0;
await rowWith(proxy.name).filter({ hasText: 'Đã cấp, chờ nhận' }).getByRole('button').click();
await reqModal().getByRole('button', { name: 'Ghi đã giao thay' }).click();
await reqModal().getByPlaceholder('VD: Nguyễn Thị Huyền').fill('Lê Văn Nhận');
await page.screenshot({ path: `${SHOTS}/06-proxy-delivery.png` });
await reqModal().getByRole('button', { name: 'Ghi đã giao', exact: true }).click();
await page.waitForTimeout(1200);
await reqModal().getByRole('button', { name: 'Đóng', exact: true }).click();
await page.waitForTimeout(800);
req = (await get(`/office/supply-requests/${proxy.id}`)).data;
rowText = clean(await rowWith(proxy.name).innerText());
check(
	'6. Ghi đã giao thay',
	req?.status === 'RECEIVED' && req?.receivedByProxy === true && req?.receiverName === 'Lê Văn Nhận' && /Đã nhận/.test(rowText) && calls.includes(`POST /v1/office/supply-requests/${proxy.id}/mark-delivered`) && loads === 0,
	'Ghi đã giao thay → API; phiếu thành Đã nhận (nhận hộ) tại chỗ',
	`API ${req?.status}, nhận hộ ${req?.receivedByProxy}, người nhận ${req?.receiverName}`,
);

}
// ─── Kỳ 1: Sửa số thực nhận rồi Đóng kỳ ────────────────────────────────────
await openPeriod(1);
if (FROM <= 7) {
const before1 = await get('/office/supply-requests/1');
const firstLine = before1.data.lines[0];
await rowWith('Phòng Hành chính nhân sự').getByRole('button').click();
await reqModal().getByRole('button', { name: 'Sửa số thực nhận' }).click();
// Ô số thực nhận là `UiNumberInput`, không chuyển `aria-label` xuống ô thật: tìm theo dòng của mặt hàng.
const qtyInput = reqModal().locator('tr', { hasText: firstLine.name }).locator('input').first();
await qtyInput.fill(String(Math.max((firstLine.receivedQty ?? firstLine.finalQty) - 1, 0)));
await reqModal().getByPlaceholder('VD: Phòng gõ nhầm 2 thành 8').fill('Thiếu một cái khi giao');
await page.screenshot({ path: `${SHOTS}/07-correct-received.png` });
await reqModal().getByRole('button', { name: 'Lưu số thực nhận' }).click();
await page.waitForTimeout(1200);
const after1 = await get('/office/supply-requests/1');
const lineAfter = after1.data.lines.find(l => l.id === firstLine.id);
if (await reqModal().isVisible()) await reqModal().getByRole('button', { name: 'Đóng', exact: true }).click();
check(
	'7. Sửa số thực nhận',
	lineAfter.receivedQty === Math.max((firstLine.receivedQty ?? firstLine.finalQty) - 1, 0) && calls.includes('POST /v1/office/supply-requests/1/correct-received') && loads === 0,
	'Sửa số thực nhận kèm lý do → API; số mới lưu',
	`${firstLine.name}: ${firstLine.receivedQty ?? firstLine.finalQty} → ${lineAfter.receivedQty}`,
);

}
/** Kỳ để thử Đóng kỳ; mặc định kỳ 1, chạy lại thì truyền CLOSE_ID của một kỳ khác đã nhận hết. */
const CLOSE_ID = Number(process.env.CLOSE_ID ?? 1);
if (CLOSE_ID !== 1) await openPeriod(CLOSE_ID);
calls.length = 0;
await page.locator('[data-tour="period-next-step"]').click();
const closeDlg = page.getByRole('dialog', { name: 'Đóng kỳ?' });
await clearToasts();
await closeDlg.getByRole('button', { name: 'Đóng kỳ này' }).click();
const closeToast = await toast();
await page.waitForTimeout(1000);
const current = clean(await page.locator('[aria-current="step"]').innerText());
const inputsLeft = await page.locator('input[data-cell-col]').count();
const p1 = (await get(`/office/supply-periods/${CLOSE_ID}`)).data;
await page.screenshot({ path: `${SHOTS}/08-closed.png` });
check(
	'8. Đóng kỳ',
	/Đã đóng kỳ/.test(closeToast) && p1.period.status === 'CLOSED' && current === 'Đã đóng' && inputsLeft === 0 && (await page.getByRole('button', { name: /^Khác/ }).count()) === 0 && calls.includes(`POST /v1/office/supply-periods/${CLOSE_ID}/close`) && loads === 0,
	'Nút chính Đóng kỳ → hỏi lại → API; bước Đã đóng, ô nhập và menu biến mất tại chỗ',
	`API ${p1.period.status}; bước "${current}"; ô nhập ${inputsLeft}; tải trang ${loads}`,
);

} catch (err) {
	await page.screenshot({ path: `${SHOTS}/crash.png` }).catch(() => {});
	check('crash', false, 'Kịch bản dừng giữa chừng', String(err).slice(0, 600));
}
check('err', errors.length === 0, 'Không lỗi JS', errors.slice(0, 3).join(' | '));
await browser.close();
const bad = results.filter(r => !r.ok);
console.log(`\n=== ${results.length - bad.length}/${results.length} xanh ===`);
process.exit(bad.length ? 1 : 0);
