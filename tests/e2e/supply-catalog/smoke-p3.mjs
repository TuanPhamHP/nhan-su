/**
 * Bấm thử trang Chi tiết kỳ (P3) trên sandbox (sandbox.cjs → seed-p2.cjs → smoke-p2.mjs → seed-p3.cjs).
 *
 * Kỳ trên sandbox: 1 = 11/2026 Hà Nội (đã khoá, phiếu đã nhận hết), 2 = 12/2026 Hà Nội (đang đăng ký),
 * 3 = 12/2026 Đà Nẵng (đã khoá, phiếu đủ các bước, có phiếu bổ sung), 4 = 12/2026 HCM (đã đóng),
 * 5 = 01/2027 HCM (đang đăng ký, quá hạn, 15 phòng, hơn 100 dòng), 6 = 01/2027 Đà Nẵng (đang đăng ký, rỗng).
 *
 * Khổ 1024 chạy trước, chỉ đọc. Khổ 1440 ghi thật: lưu dự trù và đơn giá ở kỳ 5, đổi hạn chót kỳ 2, khoá sớm kỳ 6.
 *
 *   node tests/e2e/supply-catalog/smoke-p3.mjs <thư mục ảnh>
 */
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const WEB = 'http://127.0.0.1:4999';
const ACC = JSON.parse(readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/p1-accounts.json', 'utf8'));
const PASSWORD = /const PASSWORD\s*=\s*['"`]([^'"`]+)['"`]/.exec(
	readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/drill-p1.cjs', 'utf8'),
)[1];
const SHOTS = process.argv[2] ?? '/tmp/supply-p3';
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(id, ok, name, detail = '') {
	results.push({ id, ok: !!ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${id} ${name}${detail ? ` — ${detail}` : ''}`);
}
const clean = s => String(s).replace(/\s+/g, ' ').trim();

async function token(email) {
	const res = await fetch(`${ACC.api}/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ identifier: email, password: PASSWORD }),
	});
	return (await res.json()).data.accessToken;
}
async function summaryOf(tok, id) {
	const res = await fetch(`${ACC.api}/office/supply-periods/${id}`, { headers: { authorization: `Bearer ${tok}` } });
	return (await res.json()).data;
}

async function signIn(browser, email, width) {
	const page = await (await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true })).newPage();
	page.errors = [];
	page.on('pageerror', err => page.errors.push(String(err)));
	await page.goto(`${WEB}/login`);
	await page.locator('#email').first().waitFor({ timeout: 120000 });
	await page.locator('#email').first().fill(email);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 120000 });
	return page;
}

async function openPeriod(page, id) {
	await page.goto(`${WEB}/management/office/supply-periods/${id}`);
	await page.locator('[aria-busy="true"]').first().waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
	await page.waitForTimeout(800);
	await page.addStyleTag({ content: '#nuxt-devtools-anchor,.nuxt-devtools-anchor{display:none !important}' }).catch(() => {});
}

const bar = page => page.locator('[data-tour="period-save-bar"]');
const toastText = async page => clean(await page.locator('div.fixed.top-4.right-4 [role="alert"]').first().innerText({ timeout: 15000 }).catch(() => ''));
async function clearToasts(page) {
	await page.evaluate(() => document.querySelectorAll('div.fixed.top-4.right-4 [role="alert"] button').forEach(b => b.click()));
	await page.waitForTimeout(300);
}

async function run(browser, width) {
	const v = `w${width}`;
	const page = await signIn(browser, ACC.people.admin, width);

	// 1. Kỳ 5: màn đầu thấy đầu trang, dải phòng và đầu bảng; giai đoạn, quá hạn.
	await openPeriod(page, 5);
	await page.screenshot({ path: `${SHOTS}/${v}-01-period5-first-screen.png` });
	const theadTop = (await page.locator('thead').boundingBox())?.y ?? 9999;
	const current = clean(await page.locator('[aria-current="step"]').innerText());
	const stage = clean(await page.locator('[data-tour="period-stage"]').innerText());
	const deptTitle = clean(await page.locator('#period-departments-title').innerText());
	const chips = await page.locator('[data-dept-chip] > button').allInnerTexts();
	const overflow = await page.evaluate(() => {
		const main = document.querySelector('main');
		return main ? main.scrollWidth - main.clientWidth : -1;
	});
	check(`${v}.1a`, theadTop < 900 && overflow <= 0, 'Màn đầu thấy tới tiêu đề bảng, trang không tràn ngang', `thead y=${Math.round(theadTop)}, tràn ${overflow}`);
	check(
		`${v}.1b`,
		current === 'Đang đăng ký' && /Dự kiến 00:00 ngày 21\/11\/2026/.test(stage) && /Đã quá hạn/.test(stage),
		'Giai đoạn đúng enum, dự kiến khoá, quá hạn chưa khoá',
		stage.slice(0, 200),
	);
	check(
		`${v}.1c`,
		/8\/15 đã đăng ký/.test(deptTitle) && chips.length === 15 && chips.filter(c => c.includes('✓')).length === 8,
		'Phòng 8/15 đã đăng ký, mỗi phòng một chip',
		`${deptTitle}; ${chips.length} chip, ${chips.filter(c => c.includes('✓')).length} đã đăng ký`,
	);

	// 2. Bảng: cột tên dính khi cuộn ngang, tiêu đề dính khi cuộn dọc, số 0 mờ.
	const box = page.locator('[data-tour="period-summary"]');
	const nameX0 = (await page.locator('tr[data-summary-item] th[scope="row"]').first().boundingBox()).x;
	await box.evaluate(el => (el.scrollLeft = 3000));
	await page.waitForTimeout(200);
	const nameX1 = (await page.locator('tr[data-summary-item] th[scope="row"]').first().boundingBox()).x;
	const headY0 = (await page.locator('thead th').first().boundingBox()).y;
	await box.evaluate(el => (el.scrollTop = 1500));
	await page.waitForTimeout(200);
	const headY1 = (await page.locator('thead th').first().boundingBox()).y;
	await page.screenshot({ path: `${SHOTS}/${v}-02-table-scrolled.png` });
	await box.evaluate(el => {
		el.scrollLeft = 0;
		el.scrollTop = 0;
	});
	const zeroEl = page.locator('tbody td span[aria-label="0"]').first();
	const zero = (await zeroEl.count()) ? await zeroEl.evaluate(el => getComputedStyle(el).color) : 'không có ô 0';
	const strong = await page.locator('tbody td span.font-semibold').first().evaluate(el => getComputedStyle(el).fontWeight);
	check(
		`${v}.2`,
		Math.abs(nameX0 - nameX1) < 2 && Math.abs(headY0 - headY1) < 2 && Number(strong) >= 600,
		'Cuộn ngang vẫn thấy tên mặt hàng, cuộn dọc vẫn thấy tiêu đề cột, số khác 0 đậm',
		`tên x ${Math.round(nameX0)}→${Math.round(nameX1)}, tiêu đề y ${Math.round(headY0)}→${Math.round(headY1)}, ô 0 màu ${zero}, đậm ${strong}`,
	);

	// 2b. Không có cột cho từng phòng: số cột cố định; mặt hàng nhiều phòng xin mở ra dòng con đúng số phòng.
	const s5 = await summaryOf(await token(ACC.people.admin), 5);
	const headCount = await page.locator('thead th').count();
	const multiRow = s5.rows.find(r => r.cells.filter(c => c.qty > 0).length > 1);
	const multiRowDepts = multiRow ? multiRow.cells.filter(c => c.qty > 0) : [];
	const toggleBtn = page.getByRole('button', { name: `Số theo phòng của ${multiRow?.name}`, exact: true });
	await toggleBtn.click();
	await page.waitForTimeout(200);
	const subRows = await page.locator('tr[data-summary-department]').allInnerTexts();
	const subSum = subRows.reduce((sum, t) => sum + Number(clean(t).match(/(\d+)$/)?.[1] ?? 0), 0);
	const expanded = await toggleBtn.getAttribute('aria-expanded');
	await page.screenshot({ path: `${SHOTS}/${v}-02b-expanded.png` });
	await toggleBtn.click();
	await page.waitForTimeout(200);
	const afterClose = await page.locator('tr[data-summary-department]').count();
	await page.getByRole('button', { name: 'Mở rộng tất cả' }).click();
	await page.waitForTimeout(200);
	const allSub = await page.locator('tr[data-summary-department]').count();
	await page.getByRole('button', { name: 'Thu gọn tất cả' }).click();
	await page.waitForTimeout(200);
	const expectAll = s5.rows.filter(r => r.cells.filter(c => c.qty > 0).length > 1).reduce((n, r) => n + r.cells.filter(c => c.qty > 0).length, 0);
	check(
		`${v}.2b`,
		headCount === 8 &&
			expanded === 'true' &&
			subRows.length === multiRowDepts.length &&
			subSum === multiRow?.totalQty &&
			afterClose === 0 &&
			allSub === expectAll &&
			(await page.locator('tr[data-summary-department]').count()) === 0,
		'Bảng 8 cột dù kỳ 15 phòng; mở một mặt hàng ra đúng các phòng có xin, cộng lại bằng Tổng; mở/thu tất cả',
		`${headCount} cột; "${multiRow?.name}" ${subRows.length}/${multiRowDepts.length} phòng, cộng ${subSum}/${multiRow?.totalQty}; tất cả ${allSub}/${expectAll}`,
	);

	// 2c. Rê chuột tô cả dòng, kể cả ô tên dính trái.
	const firstItem = page.locator('tr[data-summary-item]').first();
	const bgOf = () => firstItem.locator('th').evaluate(el => getComputedStyle(el).backgroundColor);
	const rowBgOf = () => firstItem.evaluate(el => getComputedStyle(el).backgroundColor);
	await page.mouse.move(0, 0);
	const thBefore = await bgOf();
	await firstItem.locator('td').nth(1).hover();
	await page.waitForTimeout(150);
	const thHover = await bgOf();
	const rowHover = await rowBgOf();
	check(
		`${v}.2c`,
		thBefore !== thHover && thHover === rowHover,
		'Rê chuột lên dòng thì cả dòng đổi nền, ô tên cùng màu với dòng',
		`ô tên ${thBefore} → ${thHover}, dòng ${rowHover}`,
	);

	// 2d. Toàn màn hình: mở từ nút cuối thanh công cụ, vẫn nhập được, Esc và nút đóng đều đóng, số đang gõ còn nguyên.
	const fsBtn = page.getByRole('button', { name: 'Xem bảng toàn màn hình' });
	await fsBtn.click();
	await page.waitForTimeout(300);
	const fsDialog = page.getByRole('dialog', { name: /^Bảng tổng hợp · / });
	const fsBox = await fsDialog.boundingBox();
	const closeFocused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
	await fsDialog.locator('input[data-cell-col="reserve"]').first().fill('3');
	await page.waitForTimeout(200);
	const fsBar = clean(await fsDialog.locator('[data-tour="period-save-bar"]').innerText());
	// Esc trong popover ⓘ chỉ đóng popover, khung vẫn mở.
	await fsDialog.getByRole('button', { name: 'Cách tính của bảng tổng hợp' }).click();
	await page.keyboard.press('Escape');
	await page.waitForTimeout(200);
	const stillOpen = await fsDialog.isVisible();
	await page.keyboard.press('Escape');
	await page.waitForTimeout(300);
	const closedByEsc = (await page.getByRole('dialog', { name: /^Bảng tổng hợp · / }).count()) === 0;
	const backFocus = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
	const keptDraft = await page.locator('input[data-cell-col="reserve"]').first().inputValue();
	await fsBtn.click();
	await page.waitForTimeout(300);
	await page.screenshot({ path: `${SHOTS}/${v}-02d-fullscreen.png` });
	await page.getByRole('button', { name: 'Đóng chế độ toàn màn hình' }).click();
	await page.waitForTimeout(300);
	const closedByBtn = (await page.getByRole('dialog', { name: /^Bảng tổng hợp · / }).count()) === 0;
	await bar(page).getByRole('button', { name: 'Huỷ thay đổi' }).click();
	await page.waitForTimeout(200);
	check(
		`${v}.2d`,
		// Từ md trở lên khung là 95vw × 95vh, căn giữa.
		fsBox &&
			Math.abs(fsBox.width - width * 0.95) <= 1 &&
			Math.abs(fsBox.height - 900 * 0.95) <= 1 &&
			Math.abs(fsBox.x - width * 0.025) <= 1 &&
			Math.abs(fsBox.y - 900 * 0.025) <= 1 &&
			closeFocused === 'Đóng chế độ toàn màn hình' &&
			/1 thay đổi chưa lưu/.test(fsBar) &&
			stillOpen && closedByEsc && backFocus === 'Xem bảng toàn màn hình' && keptDraft === '3' && closedByBtn,
		'Khung lớn 95vw × 95vh giữa màn, nhập và thấy thanh lưu; Esc ở popover chỉ đóng popover; Esc và nút đóng đều đóng, con trỏ về nút mở, số đang gõ còn',
		`khung ${Math.round(fsBox?.width ?? 0)}×${Math.round(fsBox?.height ?? 0)}; con trỏ "${closeFocused}" → "${backFocus}"; thanh "${fsBar.slice(0, 80)}"; popover Esc giữ khung ${stillOpen}; giữ số "${keptDraft}"`,
	);

	// 3. Thiếu đơn giá: công tắc lọc đúng số, "Đến mặt hàng đầu tiên" đặt con trỏ vào ô đơn giá.
	await page.getByRole('checkbox', { name: /Thiếu đơn giá/ }).check();
	await page.waitForTimeout(300);
	const unpricedShown = await page.locator('tr[data-summary-item] th[scope="row"]').count();
	await page.getByRole('checkbox', { name: /Thiếu đơn giá/ }).uncheck();
	await page.getByRole('button', { name: 'Đến mặt hàng đầu tiên' }).click();
	await page.waitForTimeout(800);
	const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
	const firstUnpriced = s5.rows.find(r => r.purchaseQty > 0 && r.amount === null && r.itemId != null);
	check(
		`${v}.3`,
		unpricedShown === s5.unpricedRows && focused === `Đơn giá, ${firstUnpriced?.name}`,
		'Lọc "Thiếu đơn giá" đúng số; nhảy tới ô đơn giá thiếu đầu tiên',
		`lọc ${unpricedShown} dòng / máy chủ ${s5.unpricedRows}; con trỏ "${focused}"`,
	);

	// 4. Tìm không ra: "Không có mặt hàng phù hợp" + Xoá bộ lọc.
	await page.getByRole('searchbox', { name: 'Tìm mặt hàng' }).fill('khong co mat hang nay');
	await page.waitForTimeout(300);
	const noMatch = await page.getByText('Không có mặt hàng phù hợp.').isVisible();
	await page.getByRole('button', { name: 'Xoá bộ lọc' }).click();
	await page.waitForTimeout(300);
	check(`${v}.4`, noMatch && (await page.locator('tr[data-summary-item] th[scope="row"]').count()) > 100, 'Tìm không ra có Xoá bộ lọc; bảng hơn 100 dòng', `${await page.locator('tr[data-summary-item] th[scope="row"]').count()} dòng`);

	// 5. Sửa ô: đánh dấu chưa lưu, Enter xuống ô cùng cột, thanh dưới đếm thay đổi, ô sai chặn lưu, Huỷ thay đổi.
	const reserveInputs = page.locator('input[data-cell-col="reserve"]');
	await reserveInputs.nth(0).click();
	await page.keyboard.type('7');
	await page.keyboard.press('Enter');
	const nextLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
	const secondLabel = await reserveInputs.nth(1).getAttribute('aria-label');
	await page.keyboard.type('abc');
	await page.waitForTimeout(200);
	let barText = clean(await bar(page).innerText());
	await bar(page).getByRole('button', { name: 'Lưu dự trù và đơn giá' }).click();
	await page.waitForTimeout(400);
	const blocked = clean(await bar(page).innerText());
	await page.screenshot({ path: `${SHOTS}/${v}-05-dirty-invalid.png` });
	check(
		`${v}.5a`,
		nextLabel === secondLabel && /thay đổi chưa lưu/.test(barText) && /Còn 1 ô gõ sai/.test(blocked),
		'Enter xuống ô cùng cột; thanh dưới đếm thay đổi; ô gõ sai chặn lưu',
		`con trỏ "${nextLabel}"; "${barText.slice(0, 120)}"; sau bấm lưu: "${blocked.slice(0, 120)}"`,
	);

	// 6. Rời trang khi chưa lưu: hỏi lại; Ở lại thì vẫn ở trang.
	await page.getByRole('link', { name: 'Kỳ đăng ký văn phòng phẩm' }).click();
	const leaveDialog = page.getByRole('dialog', { name: 'Rời trang khi chưa lưu?' });
	await leaveDialog.waitFor({ timeout: 10000 }).catch(() => {});
	const asked = await leaveDialog.isVisible().catch(() => false);
	if (asked) await leaveDialog.getByRole('button', { name: 'Ở lại' }).click();
	await page.waitForTimeout(400);
	const stayed = /supply-periods\/5/.test(page.url());

	// 7. Xuất Excel khi còn thay đổi: hỏi Lưu rồi xuất / Xuất bản đã lưu / Huỷ.
	await page.getByRole('button', { name: 'Xuất Excel' }).click();
	const exportDialog = page.getByRole('dialog', { name: 'Còn thay đổi chưa lưu' });
	const exportAsked = await exportDialog.isVisible({ timeout: 5000 }).catch(() => false);
	const exportButtons = exportAsked ? clean(await exportDialog.innerText()) : '';
	if (exportAsked) await exportDialog.getByRole('button', { name: 'Huỷ' }).click();
	check(`${v}.6`, asked && stayed, 'Rời trang khi chưa lưu thì hỏi lại, Ở lại giữ nguyên trang', page.url());
	check(`${v}.7`, exportAsked && /Lưu rồi xuất/.test(exportButtons) && /Xuất bản đã lưu/.test(exportButtons), 'Xuất Excel khi còn thay đổi chưa lưu thì hỏi', exportButtons.slice(-80));

	// Huỷ thay đổi: ô về số đã lưu.
	await bar(page).getByRole('button', { name: 'Huỷ thay đổi' }).click();
	await page.waitForTimeout(300);
	barText = clean(await bar(page).innerText());
	const reverted = await reserveInputs.nth(0).inputValue();
	check(`${v}.8`, !/thay đổi chưa lưu/.test(barText) && reverted === String(s5.rows.find(r => r.itemId != null)?.reserveQty ?? 0), 'Huỷ thay đổi trả các ô về số đã lưu', `ô đầu "${reverted}"`);

	// 9. Kỳ 3 (đã khoá): tiến độ phiếu, danh sách phiếu mở sẵn, phiếu bổ sung, nút chính theo giai đoạn.
	await openPeriod(page, 3);
	await page.screenshot({ path: `${SHOTS}/${v}-09-period3-locked.png` });
	const stage3 = clean(await page.locator('[data-tour="period-stage"]').innerText());
	const list3 = clean(await page.locator('#period-request-list').innerText().catch(() => ''));
	const primary3 = clean(await page.locator('[data-tour="period-next-step"]').innerText().catch(() => ''));
	check(
		`${v}.9a`,
		clean(await page.locator('[aria-current="step"]').innerText()) === 'Đã khoá' && /Đã chốt 2\/5 · Đã cấp 1\/5 · Đã nhận 0\/5/.test(stage3),
		'Kỳ đã khoá: bước hiện tại, giờ khoá, tiến độ phiếu bằng nhãn ngắn',
		stage3.slice(0, 220),
	);
	check(`${v}.9b`, /Phiếu chính/.test(list3) && /Phiếu bổ sung 1/.test(list3) && /Thiếu giấy in/.test(list3), 'Danh sách phiếu mở sẵn, phân biệt phiếu chính và bổ sung', list3.slice(0, 200));
	check(`${v}.9c`, /^Chốt phiếu .+\(bổ sung 1\)$/.test(primary3), 'Nút chính là việc kế tiếp: chốt phiếu chưa chốt đầu tiên', primary3);
	await page.locator('[data-tour="period-next-step"]').click();
	const reqModal = page.getByRole('button', { name: 'Đóng phiếu' });
	const opened = await reqModal.isVisible({ timeout: 15000 }).catch(() => false);
	if (opened) await reqModal.click();
	check(`${v}.9d`, opened, 'Nút chính mở đúng hộp phiếu như trước');
	// Thu gọn danh sách: chip phòng có 2 phiếu mở menu chọn phiếu.
	await page.getByRole('button', { name: 'Thu gọn danh sách phiếu' }).click();
	const multi = page.locator('[data-dept-chip] > button').filter({ hasText: '2 phiếu' });
	await multi.click();
	const items = await page.getByRole('menuitem').count();
	await page.screenshot({ path: `${SHOTS}/${v}-09e-chip-two-requests.png` });
	check(`${v}.9e`, items === 2, 'Chip phòng có phiếu bổ sung ghi "2 phiếu" và mở danh sách phiếu', `${items} phiếu`);
	await page.keyboard.press('Escape');

	// 10. Menu Khác: Khoá sớm chỉ ở đây và phải xác nhận, nói đúng hệ quả.
	await openPeriod(page, 5);
	const lockOutside = await page.getByRole('button', { name: 'Khoá sớm', exact: true }).count();
	await page.getByRole('button', { name: /^Khác/ }).click();
	const inMenu = await page.getByText('Khoá sớm', { exact: true }).isVisible();
	await page.getByText('Khoá sớm', { exact: true }).click();
	const lockDialog = page.getByRole('dialog', { name: 'Khoá kỳ ngay bây giờ?' });
	const lockText = clean(await lockDialog.innerText().catch(() => ''));
	await page.screenshot({ path: `${SHOTS}/${v}-10-lock-confirm.png` });
	await lockDialog.getByRole('button', { name: 'Thôi' }).click();
	check(
		`${v}.10`,
		lockOutside === 0 && inMenu && /không mở lại được/.test(lockText) && /Trưởng phòng và đầu mối/.test(lockText) && /7 phòng chưa đăng ký/.test(lockText),
		'Khoá sớm nằm trong menu Khác, hộp xác nhận nêu đúng hệ quả',
		`nút ngoài menu ${lockOutside}, trong menu ${inMenu}; ${lockText.slice(0, 160)}`,
	);

	// 11. Kỳ 4 đã đóng: không ô nhập, không nút ghi.
	await openPeriod(page, 4);
	const inputs4 = await page.locator('input[data-cell-col]').count();
	const write4 = await page.getByRole('button', { name: /Đổi hạn chót|Khác/ }).count();
	check(`${v}.11`, clean(await page.locator('[aria-current="step"]').innerText()) === 'Đã đóng' && inputs4 === 0 && write4 === 0, 'Kỳ đã đóng: bước Đã đóng, ô thành chữ, không nút ghi', `${inputs4} ô, ${write4} nút ghi`);

	// 12. Kỳ 1: mọi phiếu đã nhận → nút chính Đóng kỳ, mở hộp xác nhận.
	await openPeriod(page, 1);
	const primary1 = clean(await page.locator('[data-tour="period-next-step"]').innerText().catch(() => ''));
	await page.locator('[data-tour="period-next-step"]').click();
	const closeOpen = await page.getByRole('dialog', { name: 'Đóng kỳ?' }).isVisible({ timeout: 5000 }).catch(() => false);
	await page.keyboard.press('Escape');
	check(`${v}.12`, primary1 === 'Đóng kỳ' && closeOpen, 'Phiếu đã nhận hết thì nút chính là Đóng kỳ, có hỏi lại', primary1);

	// 13. Kỳ không có: báo rõ và nút về danh sách.
	await openPeriod(page, 9999);
	check(`${v}.13`, await page.getByText('Kỳ này không còn').isVisible() && (await page.getByRole('button', { name: 'Về danh sách kỳ' }).count()) === 1, 'Kỳ không tồn tại: báo rõ, có nút về danh sách');

	if (width === 1440) {
		const admin = await token(ACC.people.admin);

		// 14. Lưu dự trù và đơn giá ở kỳ 5: thanh dưới, refetch tổng tiền.
		await openPeriod(page, 5);
		const before = await summaryOf(admin, 5);
		const target = before.rows.find(r => r.itemId != null && r.unitPrice == null && r.purchaseQty > 0);
		await page.locator(`#price-cell-${target.itemId} input`).fill('12000');
		await page.locator('input[data-cell-col="reserve"]').first().fill('4');
		await page.waitForTimeout(200);
		barText = clean(await bar(page).innerText());
		await page.screenshot({ path: `${SHOTS}/${v}-14a-two-changes.png` });
		await clearToasts(page);
		await bar(page).getByRole('button', { name: 'Lưu dự trù và đơn giá' }).click();
		const toast14 = await toastText(page);
		await page.waitForTimeout(1200);
		const after = await summaryOf(admin, 5);
		const afterBar = clean(await bar(page).innerText());
		const saved = after.rows.find(r => r.itemId === target.itemId);
		check(
			`${v}.14`,
			/2 thay đổi chưa lưu/.test(barText) && /Đã lưu dự trù và đơn giá/.test(toast14) && saved?.unitPrice === 12000 && after.unpricedRows === before.unpricedRows - 1 && /Đã lưu \d\d:\d\d/.test(afterBar) && afterBar.includes(after.totalAmount.toLocaleString('vi-VN')),
			'Lưu: máy chủ có giá mới, thiếu giá giảm 1, thanh dưới "Đã lưu hh:mm" với tổng tiền mới',
			`trước "${barText.slice(0, 80)}"; sau "${afterBar.slice(0, 120)}"; thiếu giá ${before.unpricedRows}→${after.unpricedRows}`,
		);

		// 15. Đổi hạn chót kỳ 2: xem trước giờ khoá, ngày đã qua bị chặn, lưu xong cập nhật tại chỗ.
		await openPeriod(page, 2);
		await page.getByRole('button', { name: 'Đổi hạn chót' }).click();
		const dlg = page.getByRole('dialog', { name: 'Đổi hạn chót' });
		const dateInput = dlg.locator('#period-new-deadline');
		await dateInput.click();
		await dateInput.press('Control+A');
		await dateInput.pressSequentially('29112026');
		await dlg.getByText('Hạn chót hiện tại').click();
		await page.waitForTimeout(300);
		const preview = clean(await dlg.innerText());
		await page.screenshot({ path: `${SHOTS}/${v}-15-deadline-dialog.png` });
		await clearToasts(page);
		await dlg.getByRole('button', { name: 'Lưu hạn chót' }).click();
		const toast15 = await toastText(page);
		await page.waitForTimeout(1000);
		const stage2 = clean(await page.locator('[data-tour="period-stage"]').innerText());
		check(
			`${v}.15`,
			/Phiếu sẽ khoá lúc 00:00 ngày 30\/11\/2026 · còn \d+ ngày/.test(preview) && /Chủ nhật · cuối tuần/.test(preview) && /Đã đổi hạn chót thành ngày 29\/11\/2026/.test(toast15) && /Hạn chót 29\/11\/2026/.test(stage2),
			'Đổi hạn chót: xem trước giờ khoá và cuối tuần, lưu xong đầu trang đổi ngay',
			`${preview.match(/Phiếu sẽ khoá[^.]*/)?.[0]}; toast "${toast15.slice(0, 60)}"`,
		);

		// 16. Khoá sớm kỳ 6 (rỗng): xác nhận, đầu trang đổi sang Đã khoá không cần tải lại.
		await openPeriod(page, 6);
		await page.getByRole('button', { name: /^Khác/ }).click();
		await page.getByText('Khoá sớm', { exact: true }).click();
		await clearToasts(page);
		await page.getByRole('dialog', { name: 'Khoá kỳ ngay bây giờ?' }).getByRole('button', { name: 'Khoá kỳ ngay' }).click();
		const toast16 = await toastText(page);
		await page.waitForTimeout(1000);
		const current6 = clean(await page.locator('[aria-current="step"]').innerText());
		check(`${v}.16`, /Đã khoá kỳ/.test(toast16) && current6 === 'Đã khoá' && (await page.getByRole('button', { name: 'Đổi hạn chót' }).count()) === 0, 'Khoá sớm xong: bước Đã khoá, nút Đổi hạn chót biến mất, không tải lại trang', `toast "${toast16.slice(0, 60)}"`);

		// 17. Xuất Excel khi không có thay đổi: tải file.
		await openPeriod(page, 3);
		const download = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
		await page.getByRole('button', { name: 'Xuất Excel' }).click();
		const file = await download;
		check(`${v}.17`, !!file && /\.xlsx$/.test(file.suggestedFilename()), 'Xuất Excel tải file', file?.suggestedFilename() ?? 'không có file');
	}

	check(`${v}.err`, page.errors.length === 0, 'Không lỗi JS', page.errors.slice(0, 3).join(' | '));
	await page.context().close();
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
for (const width of [1024, 1440]) {
	try {
		await run(browser, width);
	} catch (err) {
		check(`w${width}.crash`, false, 'Kịch bản dừng giữa chừng', String(err).slice(0, 500));
	}
}
await browser.close();
const bad = results.filter(r => !r.ok);
console.log(`\n=== ${results.length - bad.length}/${results.length} xanh ===`);
process.exit(bad.length ? 1 : 0);
