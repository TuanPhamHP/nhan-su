/**
 * Bấm thử form danh mục Văn phòng phẩm (P1) trên sandbox: API 3176, web 4999 (xem sandbox.cjs).
 *
 * Chạy hai khổ 1440 và 1024; mỗi khổ dùng mặt hàng riêng để lần chạy sau không vấp dữ liệu lần trước.
 * Mật khẩu đọc lúc chạy từ drill-p1.cjs, không ghi ở đây.
 *
 *   node tests/e2e/supply-catalog/smoke.mjs
 */
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const WEB = 'http://127.0.0.1:4999';
const ACC = JSON.parse(readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/p1-accounts.json', 'utf8'));
const API = ACC.api;
const PASSWORD = /const PASSWORD\s*=\s*['"`]([^'"`]+)['"`]/.exec(
	readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/drill-p1.cjs', 'utf8'),
)[1];
const SHOTS = '/home/tuanpham/work/hr-system/nhan-su/tests/e2e/__shots__/supply-catalog';
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(id, ok, name, detail = '') {
	results.push({ id, ok: !!ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${id} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function token(email) {
	const res = await fetch(`${API}/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ identifier: email, password: PASSWORD }),
	});
	return (await res.json()).data.accessToken;
}
async function api(tok, method, url, body) {
	const res = await fetch(`${API}${url}`, {
		method,
		headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	});
	return { status: res.status, body: await res.json().catch(() => null) };
}

const REQ = ACC.requests.nov;
const itemId = name => ACC.items[name];
async function lineOf(tok, name) {
	const r = await api(tok, 'GET', `/me/office/supply-requests/${REQ}`);
	return r.body.data.lines.find(l => l.name === name) ?? null;
}

async function signIn(browser, email, width) {
	const ctx = await browser.newContext({ viewport: { width, height: 900 } });
	const page = await ctx.newPage();
	page.errors = [];
	page.on('pageerror', err => page.errors.push(String(err)));
	await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
	await page.locator('#email').first().waitFor({ timeout: 120000 });
	await page.locator('#email').first().fill(email);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 120000 });
	return page;
}

async function openSupplies(page) {
	await page.goto(`${WEB}/office/supplies`, { waitUntil: 'domcontentloaded' });
	await page.locator('input[data-supply-qty]').first().waitFor({ timeout: 60000 });
	await page.addStyleTag({ content: '#nuxt-devtools-anchor,.nuxt-devtools-anchor{display:none !important}' }).catch(() => {});
	await page.waitForTimeout(600);
}

const qty = (page, name) => page.locator(`input[data-supply-qty][aria-label="Phần của bạn, ${name}"]`);
const row = (page, name) => qty(page, name).locator('xpath=ancestor::div[contains(@class,"py-1.5")][1]');
async function shot(page, name, locator) {
	const path = `${SHOTS}/${name}.png`;
	if (locator) await locator.screenshot({ path });
	else await page.screenshot({ path });
	return path;
}
async function waitSaved(page) {
	await page.waitForFunction(() => /Đã lưu \d\d:\d\d/.test(document.querySelector('[role="status"][aria-live="polite"]')?.textContent ?? ''), null, {
		timeout: 15000,
	});
}
/** Đóng mọi toast, để toast cũ không che menu góc phải hay bị đọc nhầm là toast mới. */
async function clearToasts(page) {
	await page.evaluate(() => {
		document.querySelectorAll('div.fixed.top-4.right-4 [role="alert"] button').forEach(b => b.click());
	});
	await page.waitForTimeout(400);
}
/** Đếm lệnh ghi dòng phiếu trong lúc chạy `fn`. */
async function countWrites(page, fn) {
	let n = 0;
	const on = req => {
		if (/\/supply-requests\/\d+\/lines/.test(req.url()) && req.method() !== 'GET') n++;
	};
	page.on('request', on);
	await fn();
	page.off('request', on);
	return n;
}

async function run(browser, width) {
	const v = width === 1440 ? 'w1440' : 'w1024';
	const it = width === 1440
		? { enter: 'Bút bi (Note màu đỏ)', bump: 'Gọt bút chì', shared: 'Bút bi (Note màu xanh)', quota: 'Giấy A4 Double A 80gsm', net: 'Bút lông viết bảng', solo: 'Sổ lò xo A4', custom: 'Pin sạc AA' }
		: { enter: 'Bút highlight', bump: 'Bút xoá nước', shared: 'Kẹp sắt size nhỏ (19mm)', quota: 'Bút bi (Note màu xanh)', net: 'Ghim cài', solo: 'Sổ bìa da A5', custom: 'Pin cúc áo' };
	const hanh = await token(ACC.people.hanh);
	const quynh = await token(ACC.people.quynh);
	const page = await signIn(browser, ACC.people.hanh, width);
	await openSupplies(page);

	// 0. Tổng quan, không tràn ngang.
	await shot(page, `${v}-01-overview`);
	const overflow = await page.evaluate(() => {
		const main = document.querySelector('main');
		return main ? main.scrollWidth - main.clientWidth : -1;
	});
	check(`${v}.0`, overflow <= 0, 'Không tràn ngang', `scrollWidth - clientWidth = ${overflow}`);
	const groups = await page.locator('section h3').allInnerTexts();
	check(`${v}.0b`, groups.length >= 2 && groups.some(g => /Bút \(Note màu\)/i.test(g)), 'Thấy đủ nhóm, không cần gõ', groups.map(g => g.replace(/\s+/g, ' ')).join(' | '));

	// 1. Gõ số + Enter: lưu và nhảy ô kế.
	await qty(page, it.enter).click();
	await page.keyboard.type('5');
	await page.keyboard.press('Enter');
	const nextLabel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
	await waitSaved(page);
	const l1 = await lineOf(hanh, it.enter);
	check(`${v}.1`, l1?.myQty === 5 && nextLabel && !nextLabel.includes(it.enter), 'Gõ 5 + Enter lưu và nhảy ô kế', `myQty=${l1?.myQty}, ô đang focus: ${nextLabel}`);
	await shot(page, `${v}-02-enter-saved`, row(page, it.enter));

	// 2. Bấm + ba lần liền: một request.
	const plus = row(page, it.bump).getByRole('button', { name: `Thêm một, Phần của bạn, ${it.bump}` });
	const writes = await countWrites(page, async () => {
		await plus.click();
		await plus.click();
		await plus.click();
		await page.waitForTimeout(1500);
	});
	const l2 = await lineOf(hanh, it.bump);
	check(`${v}.2`, writes === 1 && l2?.myQty === 3, 'Bấm + ba lần chỉ một lần lưu', `${writes} request, myQty=${l2?.myQty}`);

	// 3. Nhiều người một dòng: thấy "Phòng: N" khi phần của mình là 0, đăng ký thêm thì cộng.
	const before = await lineOf(hanh, it.shared);
	const roomBtn = row(page, it.shared).getByRole('button', { name: /Phòng:/ });
	const roomText0 = await roomBtn.innerText();
	await shot(page, `${v}-03a-shared-mine-0`, row(page, it.shared));
	await qty(page, it.shared).click();
	await page.keyboard.type('3');
	await page.keyboard.press('Tab');
	await waitSaved(page);
	const roomText1 = await roomBtn.innerText();
	await roomBtn.click();
	await page.waitForTimeout(300);
	await shot(page, `${v}-03b-room-popover`, row(page, it.shared).locator('xpath=..'));
	const dialog = row(page, it.shared).locator('[role="dialog"]');
	const popText = await dialog.innerText();
	// Hạnh là trưởng phòng nên phần từng người là ô sửa được; đọc số trong ô.
	const shareValues = await dialog.locator('li input').evaluateAll(els => els.map(e => e.value));
	await page.keyboard.press('Escape');
	check(
		`${v}.3a`,
		roomText0.includes(String(before.requestedQty)) &&
			roomText1.includes(String(before.requestedQty + 3)) &&
			/Bạn/.test(popText) &&
			/Quỳnh/.test(popText) &&
			shareValues.includes('3'),
		'Phòng: N đúng khi 0 và sau khi thêm, popover chia theo người',
		`${roomText0.replace(/\s+/g, ' ')} → ${roomText1.replace(/\s+/g, ' ')}; popover: ${popText.replace(/\s+/g, ' ').slice(0, 60)} [${shareValues.join(', ')}]`,
	);
	// Quỳnh thêm phần của mình qua API, Hạnh tải lại thì thấy ngay số mới.
	const lq = await lineOf(quynh, it.shared);
	const myShare = lq.shares.find(s => s.isMine)?.qty ?? 0;
	await api(quynh, 'PUT', `/me/office/supply-requests/${REQ}/lines/${lq.id}/shares/${lq.shares.find(s => s.isMine).employee.id}`, {
		qty: myShare + 1,
		overQuotaReason: 'Bổ sung cho nhân viên mới',
	});
	await openSupplies(page);
	const roomText2 = await row(page, it.shared).getByRole('button', { name: /Phòng:/ }).innerText();
	check(`${v}.3b`, roomText2.includes(String(before.requestedQty + 4)), 'Người khác vừa thêm, tải lại thấy số mới', roomText2.replace(/\s+/g, ' '));

	// 6d. Lấy số tháng trước: toast và dòng đổi được tô.
	await clearToasts(page);
	await page.getByRole('button', { name: 'Lấy số tháng trước' }).click();
	const toast = await page
		.locator('div.fixed.top-4.right-4 [role="alert"]')
		.filter({ hasText: /Đã lấy|đã có đủ|chưa có kỳ trước/ })
		.first()
		.innerText({ timeout: 10000 })
		.catch(() => '');
	const lit = await page.locator('div.bg-amber-100').count();
	await shot(page, `${v}-06f-copy-previous`);
	check(`${v}.6d`, /Đã lấy \d+ mặt hàng|đã có đủ/.test(toast), 'Lấy số tháng trước', `toast "${toast.replace(/\s+/g, ' ')}", ${lit} dòng được tô`);

	// 4. Định mức: chip hiện ngay khi gõ vượt, thiếu lý do không lưu, ghi lý do + Enter thì lưu.
	const qBefore = await lineOf(hanh, it.quota);
	const quotaHint = await row(page, it.quota).innerText();
	await qty(page, it.quota).click();
	await page.keyboard.type(width === 1440 ? '7' : '25');
	await page.waitForTimeout(200);
	const chipLive = await row(page, it.quota).getByText('Vượt định mức', { exact: true }).isVisible();
	const w4 = await countWrites(page, async () => {
		await page.keyboard.press('Tab');
		await page.waitForTimeout(800);
	});
	const msg = await row(page, it.quota).locator('[role="alert"]').innerText().catch(() => '');
	await shot(page, `${v}-04a-quota-need-reason`, row(page, it.quota));
	await row(page, it.quota).locator('input[id^="supply-reason-"]').fill('Tháng này quyết toán, in nhiều');
	await row(page, it.quota).locator('input[id^="supply-reason-"]').press('Enter');
	await waitSaved(page);
	const qAfter = await lineOf(hanh, it.quota);
	await shot(page, `${v}-04b-quota-saved`, row(page, it.quota));
	check(
		`${v}.4`,
		/Định mức \d+/.test(quotaHint) && chipLive && w4 === 0 && /lý do/.test(msg) && qAfter?.overQuota && qAfter.overQuotaReason === 'Tháng này quyết toán, in nhiều',
		'Định mức cạnh ô, chip hiện khi gõ, thiếu lý do không gửi, có lý do thì lưu',
		`gợi ý "${quotaHint.match(/Định mức \d+/)?.[0]}", chip=${chipLive}, ${w4} request khi thiếu lý do, câu "${msg.slice(0, 60)}", sau lưu overQuota=${qAfter?.overQuota} (trước ${qBefore?.overQuota ?? 'chưa có dòng'})`,
	);

	// 5. Lỗi mạng: dòng lỗi, giữ số đã gõ, Thử lại thì lưu.
	await page.route(/\/supply-requests\/\d+\/lines/, route => (route.request().method() === 'GET' ? route.continue() : route.abort()));
	await qty(page, it.net).click();
	await page.keyboard.type('4');
	await page.keyboard.press('Enter');
	await row(page, it.net).getByRole('button', { name: 'Thử lại' }).waitFor({ timeout: 10000 });
	const kept = await qty(page, it.net).inputValue();
	await shot(page, `${v}-05a-network-error`, row(page, it.net));
	const footer = await page.locator('[data-tour="supply-footer"]').innerText();
	await page.unroute(/\/supply-requests\/\d+\/lines/);
	await row(page, it.net).getByRole('button', { name: 'Thử lại' }).click();
	await waitSaved(page);
	const l5 = await lineOf(hanh, it.net);
	check(`${v}.5`, kept === '4' && /Lưu lỗi/.test(footer) && l5?.myQty === 4, 'Lỗi mạng giữ số, Thử lại lưu được', `ô giữ "${kept}", thanh dưới "${footer.replace(/\s+/g, ' ')}", sau thử lại myQty=${l5?.myQty}`);
	await shot(page, `${v}-05b-footer-saved`, page.locator('[data-tour="supply-footer"]'));

	// 6a. Ô số gõ sai hoặc để trống: trả về số đã lưu, không gọi API, không coi là 0.
	const badCases = ['', 'abc', '-3', '2,5', '2.5', '99999999999'];
	const outcomes = [];
	let badWrites = 0;
	for (const text of badCases) {
		badWrites += await countWrites(page, async () => {
			await qty(page, it.enter).click();
			await page.keyboard.press('Control+A');
			if (text) await page.keyboard.type(text);
			else await page.keyboard.press('Backspace');
			await page.keyboard.press('Tab');
			await page.waitForTimeout(400);
		});
		outcomes.push(`"${text}"→"${await qty(page, it.enter).inputValue()}"`);
	}
	const notice = await row(page, it.enter).locator('p[role="status"]').innerText().catch(() => '');
	await qty(page, it.enter).click();
	await page.keyboard.press('Control+A');
	await page.keyboard.type('x');
	await page.keyboard.press('Tab');
	await page.waitForTimeout(200);
	await shot(page, `${v}-06a-invalid-restored`, row(page, it.enter));
	const l6a = await lineOf(hanh, it.enter);
	check(
		`${v}.6a`,
		badWrites === 0 && outcomes.every(o => o.endsWith('"5"')) && l6a?.myQty === 5,
		'Rỗng / chữ / âm / thập phân / quá lớn: trả về số đã lưu',
		`${outcomes.join(', ')}; ${badWrites} request; câu báo "${notice}"`,
	);

	// 6b. Về 0 khi chỉ mình có phần (dòng bị xoá) rồi Hoàn tác: khôi phục cả ghi chú.
	await qty(page, it.solo).click();
	await page.keyboard.type('2');
	await page.keyboard.press('Enter');
	await waitSaved(page);
	await row(page, it.solo).getByRole('button', { name: `Ghi chú cho ${it.solo}` }).click();
	await row(page, it.solo).locator('textarea').fill('Loại 100 trang, kẻ ngang');
	await shot(page, `${v}-06b-note-popover`, row(page, it.solo).locator('xpath=..'));
	await row(page, it.solo).getByRole('button', { name: 'Lưu' }).click();
	await waitSaved(page);
	await page.waitForTimeout(400);
	await qty(page, it.solo).click();
	await page.keyboard.press('Control+A');
	await page.keyboard.type('0');
	await page.keyboard.press('Tab');
	await row(page, it.solo).getByRole('button', { name: /Hoàn tác/ }).waitFor({ timeout: 10000 });
	const gone = await lineOf(hanh, it.solo);
	await shot(page, `${v}-06c-undo`, row(page, it.solo));
	await row(page, it.solo).getByRole('button', { name: /Hoàn tác/ }).click();
	await waitSaved(page);
	await page.waitForTimeout(300);
	const back = await lineOf(hanh, it.solo);
	check(`${v}.6b`, gone === null && back?.myQty === 2 && back?.note === 'Loại 100 trang, kẻ ngang', 'Về 0 xoá dòng, Hoàn tác khôi phục số và ghi chú', `sau khi về 0: ${gone ? 'còn dòng' : 'dòng đã xoá'}; sau hoàn tác: ${back?.myQty} / "${back?.note}"`);

	// 6c. Mặt hàng ngoài danh mục từ ô tìm không ra; về 0 rồi Hoàn tác vẫn còn dòng.
	await page.getByRole('searchbox', { name: 'Tìm mặt hàng' }).fill(it.custom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
	await page.waitForTimeout(300);
	await shot(page, `${v}-06d-no-result`);
	await page.getByRole('button', { name: /Thêm mặt hàng ngoài danh mục/ }).first().click();
	const prefilled = await page.locator('#supply-custom-name').inputValue();
	await page.locator('#supply-custom-name').fill(it.custom);
	await page.locator('#supply-custom-unit').fill('Đôi');
	await page.locator('[role="dialog"] input[data-supply-qty], [role="dialog"] input[inputmode="numeric"]').first().fill('2');
	await page.locator('#supply-custom-note').fill('Loại sạc được');
	await shot(page, `${v}-06e-custom-modal`, page.locator('form').filter({ hasText: 'Thêm mặt hàng ngoài danh mục' }));
	await page.getByRole('button', { name: 'Thêm vào phiếu' }).click();
	await page.waitForTimeout(800);
	await page.getByRole('searchbox', { name: 'Tìm mặt hàng' }).fill('');
	await waitSaved(page);
	const c1 = await lineOf(hanh, it.custom);
	await qty(page, it.custom).click();
	await page.keyboard.press('Control+A');
	await page.keyboard.type('0');
	await page.keyboard.press('Tab');
	await row(page, it.custom).getByRole('button', { name: /Hoàn tác/ }).waitFor({ timeout: 10000 });
	await row(page, it.custom).getByRole('button', { name: /Hoàn tác/ }).click();
	await waitSaved(page);
	await page.waitForTimeout(300);
	const c2 = await lineOf(hanh, it.custom);
	check(`${v}.6c`, prefilled && c1?.isCustom && c2?.myQty === 2 && c2?.note === 'Loại sạc được', 'Ngoài danh mục: thêm từ ô tìm, Hoàn tác giữ ghi chú', `điền sẵn "${prefilled}", sau hoàn tác ${c2?.myQty} / "${c2?.note}"`);

	// 6e. Đổi đầu mối: hộp nổi, không đẩy trang.
	await clearToasts(page);
	// Về đầu trang trước khi đo, kẻo Playwright tự cuộn tới nút Đổi và vị trí đổi vì cuộn chứ không vì hộp.
	await page.evaluate(() => document.querySelector('main')?.scrollTo(0, 0));
	await page.waitForTimeout(200);
	const toolbarY0 = (await page.locator('[data-tour="supply-toolbar"]').boundingBox()).y;
	await page.locator('[data-tour="supply-contact-pick"]').click();
	await page.waitForTimeout(300);
	const toolbarY1 = (await page.locator('[data-tour="supply-toolbar"]').boundingBox()).y;
	await shot(page, `${v}-06g-contact-popover`, page.locator('[data-tour="supply-period-bar"]').locator('xpath=..'));
	if (width === 1440) {
		await page.locator('[data-tour="supply-contact-form"]').getByText('Chọn nhân viên của phòng').click();
		await page.getByText('Nguyễn Thị Hương Quỳnh', { exact: true }).last().click();
		await page.getByRole('button', { name: 'Lưu đầu mối' }).click();
		await page.waitForTimeout(1200);
	} else {
		await page.getByRole('button', { name: 'Thôi' }).first().click();
	}
	const contactLine = await page.locator('[data-tour="supply-contact"]').innerText();
	check(`${v}.6e`, toolbarY0 === toolbarY1, 'Mở chọn đầu mối không đẩy trang', `thanh công cụ y ${toolbarY0} → ${toolbarY1}; "${contactLine.replace(/\s+/g, ' ')}"`);

	// 6f. Thanh công cụ và tiêu đề nhóm dính khi cuộn; "Chỉ đã chọn".
	await page.evaluate(() => document.querySelector('main')?.scrollBy(0, 900));
	await page.waitForTimeout(300);
	await shot(page, `${v}-06h-scrolled-sticky`);
	await page.getByText(/Chỉ đã chọn/).click();
	await page.waitForTimeout(300);
	await page.evaluate(() => document.querySelector('main')?.scrollTo(0, 0));
	await shot(page, `${v}-06i-only-selected`);
	const visibleRows = await page.locator('input[data-supply-qty]').count();
	const chosen = Number((await page.getByText(/Chỉ đã chọn/).innerText()).match(/\((\d+)\)/)?.[1] ?? -1);
	const values = await page.locator('input[data-supply-qty]').evaluateAll(els => els.map(e => Number(e.value)));
	check(
		`${v}.6f`,
		visibleRows === chosen && values.every(x => x > 0),
		'"Chỉ đã chọn" chỉ còn dòng có phần của tôi',
		`${visibleRows} dòng hiện, nhãn đếm ${chosen}, số nhỏ nhất ${Math.min(...values)}`,
	);
	await page.getByText(/Chỉ đã chọn/).click();

	// 6g. Phiếu khoá chỉ xem: kỳ trước, đã chốt.
	await clearToasts(page);
	await page.getByRole('button', { name: 'Phiếu khác' }).click();
	await page.getByRole('menuitem').filter({ hasNotText: 'đang xem' }).first().click();
	await page.getByText('Phiếu đã khoá, chỉ xem').waitFor({ timeout: 15000 });
	const disabled = await page.locator('input[data-supply-qty]:not(:disabled)').count();
	const finals = await page.getByText('Đã chốt', { exact: false }).count();
	await shot(page, `${v}-06j-readonly`);
	check(`${v}.6g`, disabled === 0 && finals > 0, 'Phiếu khoá: ô khoá, có cột Đã chốt', `${disabled} ô còn sửa được, ${finals} chỗ "Đã chốt"`);

	check(`${v}.err`, page.errors.length === 0, 'Không có lỗi JS', page.errors.slice(0, 3).join(' | '));
	await page.context().close();
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
for (const width of [1440, 1024]) {
	try {
		await run(browser, width);
	} catch (err) {
		check(`w${width}.crash`, false, 'Kịch bản dừng giữa chừng', String(err).slice(0, 400));
	}
}
await browser.close();
const bad = results.filter(r => !r.ok);
console.log(`\n=== ${results.length - bad.length}/${results.length} xanh ===`);
for (const r of bad) console.log(`  ✗ ${r.id} ${r.name} — ${r.detail}`);
process.exit(bad.length ? 1 : 0);
