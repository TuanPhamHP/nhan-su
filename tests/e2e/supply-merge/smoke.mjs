/**
 * Bấm thử F1–F13 của bàn giao "cộng số vào dòng đã có" trên sandbox 3176 / web 4999.
 *
 * Chạy MỘT lần trên dữ liệu gốc của sandbox: các bước nối tiếp nhau (Bút bi 14 → 17 → 18, Bút chì
 * gỗ 3 → 6) và F13 khoá kỳ, nên chạy lại phải dựng lại sandbox.
 */
import {
	WHO,
	addSection,
	api,
	apiToken,
	clean,
	clearToasts,
	launch,
	line,
	openSupplies,
	shot,
	signIn,
	summary,
	toastText,
} from './helper.mjs';

const shots = {};
const nv1Token = await apiToken(WHO.nv1);
const adminToken = await apiToken(WHO.admin);
const me = await api(nv1Token, '/v1/employees/me');
const nv1Name = me.json?.data?.fullName;
const list = await api(nv1Token, '/v1/me/office/supply-requests');
const requestId = list.json.data[0].id;
const periodId = list.json.data[0].period.id;

async function lines() {
	const res = await api(nv1Token, `/v1/me/office/supply-requests/${requestId}`);
	return res.json.data.lines;
}
const byName = (ls, re) => ls.filter(l => re.test(l.name));

/** Mở ô chọn mặt hàng, gõ tìm, trả nhãn các option rồi chọn option đầu bằng phím. */
async function pickCatalog(page, query) {
	const section = addSection(page);
	const trigger = section.locator('div.grid').first().locator('[tabindex="0"]').first();
	await trigger.click();
	const search = trigger.locator('input');
	await search.fill(query);
	await page.waitForTimeout(400);
	const labels = await section
		.locator('div.grid')
		.first()
		.locator('span[class*="optionLabel"]')
		.allInnerTexts();
	await search.press('ArrowDown');
	await search.press('Enter');
	await page.waitForTimeout(400);
	return labels.map(clean);
}

async function fillAdd(page, qty) {
	const section = addSection(page);
	const qtyInput = section.locator('div.grid').first().locator('input[aria-label="Số lượng cần xin"]');
	await qtyInput.fill(String(qty));
	await page.waitForTimeout(300);
}

async function clickAdd(page) {
	await clearToasts(page);
	await addSection(page).locator('div.grid').first().getByRole('button', { name: 'Thêm', exact: true }).click();
	return toastText(page);
}

const browser = await launch();
const page = await signIn(browser, WHO.nv1);
await openSupplies(page);
const section = addSection(page);

// ── F1, F11 ────────────────────────────────────────────────────────────────────
await section.getByRole('button', { name: 'Mặt hàng không có trong danh mục' }).click();
await page.waitForTimeout(400);
const heights = await section.evaluate(root =>
	[...root.querySelectorAll('div.grid')].map(grid =>
		[...grid.children].map(child => {
			const control = child.matches('input,button') ? child : child.querySelector('input,button,[tabindex="0"]');
			return Math.round((control ?? child).getBoundingClientRect().height * 100) / 100;
		}),
	),
);
const flat = heights.flat();
line('F1', flat.length === 8 && new Set(flat).size === 1, 'Cao bằng nhau ở 1440px', JSON.stringify(heights));
shots.F1 = await shot(page, 'F1-desktop-heights', { locator: section });
const btnText = clean(await section.locator('div.grid').first().locator('button').last().innerText());
line('F11', btnText === 'Thêm', 'Nút đổi tên', `nút: "${btnText}"`);
await section.getByRole('button', { name: /Thôi, không thêm/ }).click();

// ── F2 ─────────────────────────────────────────────────────────────────────────
{
	const phone = await signIn(browser, WHO.nv1, { phone: true });
	await openSupplies(phone);
	const ps = addSection(phone);
	await ps.getByRole('button', { name: 'Mặt hàng không có trong danh mục' }).click();
	await phone.waitForTimeout(400);
	const ph = await ps.evaluate(root =>
		[...root.querySelectorAll('div.grid')].map(grid =>
			[...grid.children].map(child => {
				const control = child.matches('input,button') ? child : child.querySelector('input,button,[tabindex="0"]');
				return Math.round((control ?? child).getBoundingClientRect().height * 100) / 100;
			}),
		),
	);
	const sw = await phone.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
	line('F2', new Set(ph.flat()).size === 1 && sw[0] <= sw[1], 'Điện thoại 390px', `${JSON.stringify(ph)} scrollWidth ${sw[0]}/${sw[1]}`);
	shots.F2 = await shot(phone, 'F2-phone-form', { locator: ps });
	await phone.context().close();
}

// ── F3 ─────────────────────────────────────────────────────────────────────────
{
	const labels = await pickCatalog(page, 'but bi');
	const label = labels.find(l => /Bút bi/.test(l)) ?? '';
	const hint = clean(await section.locator('p.text-xs.text-gray-500').first().innerText().catch(() => ''));
	const warnTexts = await section.locator('.text-amber-600, .text-amber-700, .text-red-500').allInnerTexts();
	const picked = clean(await section.locator('div.grid').first().locator('[tabindex="0"]').first().innerText());
	line(
		'F3',
		/phiếu đang có 14/.test(label) && /Bút bi/.test(picked) && /Phiếu đang có 14 chiếc, bấm Thêm sẽ cộng/.test(hint) && warnTexts.every(t => !clean(t)),
		'Chọn Bút bi đã có',
		`nhãn "${label}" · đã chọn "${picked}" · gợi ý "${hint}" · chữ cam/đỏ: ${JSON.stringify(warnTexts)}`,
	);
	shots.F3 = await shot(page, 'F3-pick-existing', { locator: section });
}

// ── F4 ─────────────────────────────────────────────────────────────────────────
{
	await fillAdd(page, 3);
	const toast = await clickAdd(page);
	await page.waitForTimeout(800);
	const ls = await lines();
	const pens = byName(ls, /^Bút bi/);
	line(
		'F4',
		pens.length === 1 && pens[0].requestedQty === 17 && pens[0].updatedBy.fullName === nv1Name && /Đã cộng thêm 3 chiếc vào Bút bi .*, nay 17 chiếc/.test(toast),
		'Bút bi +3 (nv1)',
		`số dòng Bút bi ${pens.length}, số ${pens[0]?.requestedQty}, sửa cuối ${pens[0]?.updatedBy.fullName} · toast "${toast}"`,
	);
	shots.F4 = await shot(page, 'F4-merged-17', { fullPage: true });
}

// ── F5 ─────────────────────────────────────────────────────────────────────────
{
	await pickCatalog(page, 'but chi');
	await fillAdd(page, 3);
	const toast = await clickAdd(page);
	await page.waitForTimeout(800);
	const ls = await lines();
	const pencils = byName(ls, /^Bút chì gỗ/);
	line('F5', pencils.length === 1 && pencils[0].requestedQty === 3 && toast.includes('Đã thêm vào phiếu.'), 'Bút chì gỗ ×3 mới', `dòng ${pencils.length}, số ${pencils[0]?.requestedQty}, ${ls.length} dòng · toast "${toast}"`);
}

// ── F6 ─────────────────────────────────────────────────────────────────────────
{
	await pickCatalog(page, 'but chi');
	await fillAdd(page, 3);
	const reasonVisible = await section.getByPlaceholder('VD: Tháng này quyết toán, in nhiều').isVisible();
	await clickAdd(page);
	const err = clean(await section.locator('p.text-sm.text-red-500').first().innerText().catch(() => ''));
	const before = (await lines()).find(l => /^Bút chì gỗ/.test(l.name))?.requestedQty;
	shots.F6 = await shot(page, 'F6-reason-total', { locator: section });
	await section.getByPlaceholder('VD: Tháng này quyết toán, in nhiều').fill('Phòng thêm người mới');
	const toast = await clickAdd(page);
	await page.waitForTimeout(800);
	const pencil = (await lines()).find(l => /^Bút chì gỗ/.test(l.name));
	line(
		'F6',
		reasonVisible && /là 6/.test(err) && before === 3 && pencil?.requestedQty === 6 && pencil?.overQuotaReason === 'Phòng thêm người mới',
		'Bút chì gỗ ×3 lần nữa (6 > 5)',
		`ô lý do hiện trước khi gửi: ${reasonVisible} · câu "${err}" · trước khi nhập lý do vẫn ${before} · sau: ${pencil?.requestedQty}, lý do "${pencil?.overQuotaReason}" · toast "${toast}"`,
	);
}

// ── F7 ─────────────────────────────────────────────────────────────────────────
{
	await pickCatalog(page, 'giay a4');
	await fillAdd(page, 1);
	const reasonVisible = await section.getByPlaceholder('VD: Tháng này quyết toán, in nhiều').isVisible().catch(() => false);
	const toast = await clickAdd(page);
	await page.waitForTimeout(800);
	const paper = (await lines()).find(l => /^Giấy A4/.test(l.name));
	line(
		'F7',
		!reasonVisible && paper?.requestedQty === 13 && paper?.overQuotaReason === 'Tháng này quyết toán',
		'Giấy A4 ×1 (đã có lý do)',
		`ô lý do hiện: ${reasonVisible} · số ${paper?.requestedQty}, lý do "${paper?.overQuotaReason}" · toast "${toast}"`,
	);
}

// ── F8 ─────────────────────────────────────────────────────────────────────────
{
	const countBefore = (await lines()).length;
	await section.getByRole('button', { name: 'Mặt hàng không có trong danh mục' }).click();
	await page.waitForTimeout(300);
	await section.getByPlaceholder('Tên mặt hàng, VD: Pin 3A').fill('pin tieu 3a');
	await section.getByPlaceholder('Đơn vị, VD: Đôi').fill('đôi');
	await section.locator('input[aria-label="Số lượng mặt hàng ngoài danh mục"]').fill('2');
	await clearToasts(page);
	await section.locator('div.grid').nth(1).getByRole('button', { name: 'Thêm', exact: true }).click();
	const toast = await toastText(page);
	await page.waitForTimeout(800);
	const ls = await lines();
	const pins = byName(ls, /pin/i);
	line(
		'F8',
		pins.length === 1 && pins[0].name === 'Pin tiểu 3A' && pins[0].requestedQty === 5 && ls.length === countBefore && /nay 5 đôi/.test(toast),
		'Ngoài danh mục "pin tieu 3a"/"đôi" ×2',
		`dòng pin ${pins.length} "${pins[0]?.name}" số ${pins[0]?.requestedQty} · ${countBefore}→${ls.length} dòng · toast "${toast}"`,
	);
	shots.F8 = await shot(page, 'F8-custom-merged', { fullPage: true });
}

// ── F9 ─────────────────────────────────────────────────────────────────────────
{
	// "Gõ dở" là chữ chưa lưu được: số hợp lệ thì rời ô là trang tự lưu (đúng hành vi đang có),
	// nên gõ "2,5" để chắc chắn ô giữ chữ chưa lưu khi người dùng chuyển sang form thêm.
	const lineInput = page.locator('input[aria-label^="Số xin của Bút bi"]');
	await lineInput.fill('2,5');
	await page.waitForTimeout(300);
	await pickCatalog(page, 'but bi');
	await fillAdd(page, 1);
	const toast = await clickAdd(page);
	await page.waitForTimeout(800);
	const pen = (await lines()).find(l => /^Bút bi/.test(l.name));
	const shown = await lineInput.inputValue();
	line('F9', pen?.requestedQty === 18 && shown === '18', 'Ô số dòng Bút bi hiện tổng mới', `máy chủ ${pen?.requestedQty}, ô dòng hiện "${shown}" · toast "${toast}"`);
}

// ── F10 ────────────────────────────────────────────────────────────────────────
{
	await pickCatalog(page, 'but bi');
	await fillAdd(page, 100000);
	const toast = await clickAdd(page);
	await page.waitForTimeout(500);
	const err = clean(await section.locator('p.text-sm.text-red-500').first().innerText().catch(() => ''));
	const alive = await page.getByText('Thêm mặt hàng').first().isVisible();
	const pen = (await lines()).find(l => /^Bút bi/.test(l.name));
	line('F10', !!err && alive && pen?.requestedQty === 18 && !page.errors.length, 'Bút bi ×100000', `câu dưới form "${err}" · toast "${toast}" · số vẫn ${pen?.requestedQty} · lỗi JS ${page.errors.length}`);
	shots.F10 = await shot(page, 'F10-line-invalid', { locator: section });
	await section.locator('input[aria-label="Số lượng cần xin"]').fill('');
}

// ── F12 ────────────────────────────────────────────────────────────────────────
{
	const nv2 = await signIn(browser, WHO.nv2);
	await openSupplies(nv2);
	const body = clean(await nv2.locator('body').innerText());
	const penInput = await nv2.locator('input[aria-label^="Số xin của Bút bi"]').inputValue();
	const penBlock = clean(
		await nv2.locator('div.p-4', { has: nv2.locator('input[aria-label^="Số xin của Bút bi"]') }).first().innerText(),
	);
	line(
		'F12',
		penInput === '18' && penBlock.includes(`sửa cuối bởi ${nv1Name}`) && body.includes('Pin tiểu 3A'),
		'nv2 tải lại thấy số mới',
		`Bút bi ${penInput} · "${penBlock.slice(0, 140)}"`,
	);
	await nv2.context().close();
}

// ── F13 ────────────────────────────────────────────────────────────────────────
{
	// Tab cũ của nv1 vẫn đang mở form; admin khoá kỳ qua API rồi nv1 bấm Thêm từ tab cũ.
	const lock = await api(adminToken, `/v1/office/supply-periods/${periodId}/lock`, { method: 'POST', body: {} });
	await pickCatalog(page, 'but bi');
	await fillAdd(page, 1);
	const toast = await clickAdd(page);
	await page.waitForTimeout(1500);
	const formAfterToast = await page.getByRole('heading', { name: 'Thêm mặt hàng' }).count();
	await openSupplies(page).catch(() => {});
	await page.reload({ waitUntil: 'domcontentloaded' });
	await page.waitForTimeout(4000);
	const formAfterReload = await page.getByRole('heading', { name: 'Thêm mặt hàng' }).count();
	const detail = await api(nv1Token, `/v1/me/office/supply-requests/${requestId}`);
	line(
		'F13',
		lock.status < 300 && /khoá|khóa|đóng/i.test(toast) && formAfterReload === 0 && detail.json.data.canEdit === false,
		'Khoá kỳ rồi thêm từ tab cũ',
		`lock HTTP ${lock.status} · toast "${toast}" · form sau toast ${formAfterToast}, sau tải lại ${formAfterReload} · canEdit ${detail.json.data.canEdit}`,
	);
}

console.log('\nẢnh:', JSON.stringify(shots, null, 1));
console.log('Lỗi JS trên trang nv1:', JSON.stringify(page.errors));
await browser.close();
process.exitCode = summary() ? 1 : 0;
