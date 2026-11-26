/**
 * Bấm thử trang Kỳ văn phòng phẩm và hộp Mở kỳ (P2) trên sandbox (sandbox.cjs rồi seed-p2.cjs).
 *
 * Khổ 1440 có một lần ghi thật (mở kỳ 01/2027 cho Văn phòng Đà Nẵng từ gợi ý); khổ 1024 chỉ mở hộp,
 * xem và giả lỗi máy chủ bằng chặn request, không ghi gì. Ảnh chụp ra ngoài repo.
 *
 *   node tests/e2e/supply-catalog/smoke-p2.mjs <thư mục ảnh>
 */
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const WEB = 'http://127.0.0.1:4999';
const ACC = JSON.parse(readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/p1-accounts.json', 'utf8'));
const PASSWORD = /const PASSWORD\s*=\s*['"`]([^'"`]+)['"`]/.exec(
	readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/drill-p1.cjs', 'utf8'),
)[1];
const SHOTS = process.argv[2] ?? '/tmp/supply-p2';
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(id, ok, name, detail = '') {
	results.push({ id, ok: !!ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${id} ${name}${detail ? ` — ${detail}` : ''}`);
}
const clean = s => String(s).replace(/\s+/g, ' ').trim();

async function signIn(browser, width) {
	const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
	page.errors = [];
	page.on('pageerror', err => page.errors.push(String(err)));
	await page.goto(`${WEB}/login`);
	await page.locator('#email').first().waitFor({ timeout: 120000 });
	await page.locator('#email').first().fill(ACC.people.admin);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 120000 });
	return page;
}

async function openList(page, query = '') {
	await page.goto(`${WEB}/management/office/supply-periods${query}`);
	await page.locator('article, [aria-busy="true"]').first().waitFor({ timeout: 60000 });
	await page.locator('[aria-busy="true"]').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
	await page.addStyleTag({ content: '#nuxt-devtools-anchor,.nuxt-devtools-anchor{display:none !important}' }).catch(() => {});
	await page.waitForTimeout(500);
}

const dialog = page => page.getByRole('dialog', { name: 'Mở kỳ đăng ký văn phòng phẩm' });
const submitBtn = page => dialog(page).getByRole('button', { name: /^Mở kỳ cho/ });

async function pickSelect(page, id, label) {
	await page.locator(`#${id}`).click();
	const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	await page.locator('button').filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) }).last().click();
	await page.waitForTimeout(300);
}

async function run(browser, width) {
	const v = `w${width}`;
	const page = await signIn(browser, width);
	await openList(page);
	await page.screenshot({ path: `${SHOTS}/${v}-01-list.png`, fullPage: false });

	// 1. Danh sách: nhóm, thẻ, tiến độ, đếm ngược, quá hạn, gợi ý.
	const overflow = await page.evaluate(() => {
		const main = document.querySelector('main');
		return main ? main.scrollWidth - main.clientWidth : -1;
	});
	const active = await page.locator('section[aria-labelledby="periods-active"] article').allInnerTexts();
	const closedHeader = clean(await page.locator('#periods-closed').innerText());
	const closedVisible = await page.locator('#periods-closed-list article').first().isVisible().catch(() => false);
	const bars = await page.locator('[role="progressbar"]').count();
	const suggest = clean(await page.locator('[data-tour="period-suggest"]').innerText().catch(() => ''));
	check(`${v}.1a`, overflow <= 0, 'Không tràn ngang', `${overflow}`);
	check(
		`${v}.1b`,
		active.length === 4 && /Đã đóng \(1\)/iu.test(closedHeader) && !closedVisible && bars >= 4,
		'Đang diễn ra ở trên, Đã đóng thu gọn có số đếm, thẻ có thanh tiến độ',
		`${active.length} thẻ đang diễn ra, "${closedHeader}", nhóm đóng ${closedVisible ? 'đang mở' : 'thu gọn'}, ${bars} thanh tiến độ`,
	);
	const months = active.map(t => clean(t).match(/Tháng \d+\/\d+/)?.[0]);
	check(`${v}.1c`, months.join(',') === 'Tháng 1/2027,Tháng 12/2026,Tháng 12/2026,Tháng 11/2026', 'Sắp theo tháng giảm dần', months.join(', '));
	const hcmJan = clean(active.find(t => /Tháng 1\/2027/.test(t)) ?? '');
	const hnDec = clean(active.find(t => /Tháng 12\/2026/.test(t) && /Hà Nội/.test(t)) ?? '');
	const locked = clean(active.find(t => /Tháng 11\/2026/.test(t)) ?? '');
	check(`${v}.1d`, /Đã quá hạn/.test(hcmJan) && /Đang đăng ký/.test(hcmJan), 'Kỳ quá hạn chưa khoá ghi "Đã quá hạn"', hcmJan.slice(0, 160));
	check(`${v}.1e`, /Còn \d+ ngày/.test(hnDec) && /\d+\/\d+ phòng đã đăng ký/.test(hnDec) && /Mở bởi/.test(hnDec), 'Kỳ đang mở: tiến độ, còn bao lâu, người mở', hnDec.slice(0, 200));
	check(`${v}.1f`, /Đã khoá/.test(locked) && !/Còn \d+/.test(locked), 'Kỳ đã khoá không đếm ngược, kèm bước tiếp theo', locked.slice(0, 200));
	if (width === 1440) {
		check(`${v}.1g`, /Chưa có kỳ tháng 1\/2027 · Văn phòng Đà Nẵng/.test(suggest) && !/Hà Nội|Hồ Chí Minh/.test(suggest), 'Gợi ý chỉ văn phòng có kỳ gần nhất đã khoá', suggest);
	}

	// 2. Bộ lọc lên địa chỉ trang, nhóm đóng tự mở khi lọc Đã đóng, lọc không ra thì Xoá bộ lọc.
	await openList(page, '?status=CLOSED');
	const closedCards = await page.locator('#periods-closed-list article').count();
	const closedShown = await page.locator('#periods-closed-list article').first().isVisible();
	await page.goto(`${WEB}/management/office/supply-periods?status=OPEN&office=999`);
	await page.getByText('Không có kỳ phù hợp').waitFor({ timeout: 30000 }).catch(() => {});
	const empty = await page.getByText('Không có kỳ phù hợp').isVisible().catch(() => false);
	await page.screenshot({ path: `${SHOTS}/${v}-02-filter-empty.png` });
	await page.getByRole('button', { name: 'Xoá bộ lọc' }).click().catch(() => {});
	await page.waitForTimeout(500);
	const urlAfter = new URL(page.url());
	check(
		`${v}.2`,
		closedCards === 1 && closedShown && empty && !urlAfter.searchParams.has('status'),
		'Lọc theo query string, nhóm Đã đóng mở khi lọc, Xoá bộ lọc',
		`đóng: ${closedCards} thẻ, ${closedShown ? 'hiện' : 'ẩn'}; rỗng ${empty}; sau xoá: ${urlAfter.search || '(trống)'}`,
	);

	// 3. Bấm thân thẻ là vào chi tiết; bàn phím dừng ở "Xem chi tiết".
	await openList(page);
	const card = page.locator('section[aria-labelledby="periods-active"] article').first();
	const box = await card.boundingBox();
	await page.mouse.click(box.x + box.width / 2, box.y + 20);
	await page.waitForURL(/supply-periods\/\d+/, { timeout: 20000 }).catch(() => {});
	const wentDetail = /supply-periods\/\d+/.test(page.url());
	await openList(page);
	const links = await page.locator('article a').count();
	const articles = await page.locator('article').count();
	check(`${v}.3`, wentDetail && links === articles, 'Bấm thân thẻ vào chi tiết, mỗi thẻ đúng một liên kết', `${page.url().includes('supply-periods') ? 'đã vào chi tiết' : 'không vào'}; ${links} liên kết / ${articles} thẻ`);

	// 4. Hộp Mở kỳ: điền sẵn theo kỳ gần nhất.
	await page.getByRole('button', { name: 'Mở kỳ mới' }).click();
	await dialog(page).waitFor();
	await page.waitForTimeout(800);
	await page.screenshot({ path: `${SHOTS}/${v}-04-modal-default.png` });
	let text = clean(await dialog(page).innerText());
	const focusInside = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
	check(
		`${v}.4a`,
		/Tháng 2\/2027/.test(text) && /Thứ|Chủ nhật/.test(text) && /Phiếu tự khoá lúc 00:00 ngày 21\/12\/2026 · còn \d+ ngày/.test(text) && /Tất cả 9 phòng/.test(text) && /Mở kỳ cho 9 phòng/.test(text) && /Sẽ tạo 9 phiếu trống/.test(text),
		'Mặc định: văn phòng của kỳ gần nhất (HCM), tháng 2/2027, hạn chót 20/12 (giữ lệch 2 tháng), giờ khoá, 9 phòng',
		text.slice(0, 400),
	);
	check(`${v}.4b`, /Chủ nhật · cuối tuần/.test(text), 'Hạn chót rơi Chủ nhật thì cảnh báo nhẹ', text.match(/(Thứ \S+|Chủ nhật)( · cuối tuần)?/)?.[0] ?? '');
	check(`${v}.4c`, focusInside, 'Mở hộp thì con trỏ nằm trong hộp');

	// 5. Đổi văn phòng sang Hà Nội: tháng, hạn chót, phòng tính lại.
	await pickSelect(page, 'period-site', 'Văn phòng Hà Nội');
	text = clean(await dialog(page).innerText());
	check(
		`${v}.5`,
		/Tháng 1\/2027/.test(text) && /27\/12\/2026|28\/12\/2026/.test(text) && /2\/9 phòng · bỏ:/.test(text) && /Mở kỳ cho 2 phòng/.test(text),
		'Đổi văn phòng: tháng 1/2027, hạn chót theo kỳ HN, phòng theo kỳ HN',
		text.slice(0, 420),
	);

	// 6. Chọn tháng đã có kỳ: báo trùng ngay dưới ô tháng, nút khoá kèm lý do.
	await pickSelect(page, 'period-month', 'Tháng 12/2026 · đã có kỳ');
	text = clean(await dialog(page).innerText());
	const disabled = await submitBtn(page).isDisabled();
	await page.screenshot({ path: `${SHOTS}/${v}-06-duplicate.png` });
	check(`${v}.6`, /Đã có kỳ tháng 12\/2026 của Văn phòng Hà Nội · Xem kỳ/.test(text) && disabled, 'Trùng kỳ: báo dưới ô tháng, nút khoá kèm lý do', `nút ${disabled ? 'khoá' : 'bấm được'}; ${text.match(/Đã có kỳ[^.]*\./g)?.join(' | ')}`);
	await pickSelect(page, 'period-month', 'Tháng 1/2027');

	// 7. Tự sửa hạn chót rồi đổi văn phòng: không bị ghi đè.
	const dateInput = page.locator('#period-deadline');
	await dateInput.click();
	await dateInput.press('Control+A');
	await dateInput.pressSequentially('15012027');
	await page.locator('#period-create-title').click();
	await page.waitForTimeout(300);
	await pickSelect(page, 'period-site', 'Văn phòng Đà Nẵng');
	const kept = await dateInput.inputValue();
	text = clean(await dialog(page).innerText());
	check(`${v}.7`, kept === '15/01/2027' && /00:00 ngày 16\/01\/2027/.test(text), 'Hạn chót tự sửa giữ nguyên khi đổi văn phòng, giờ khoá đổi theo', `ô "${kept}"; ${text.match(/Phiếu tự khoá[^·]*· còn \d+ ngày/)?.[0]}`);

	// 8. Bỏ hết phòng rồi bấm Mở kỳ: lỗi tại chỗ, con trỏ tới phần phòng, nút nói thiếu gì.
	await dialog(page).getByRole('button', { name: 'Chỉnh sửa' }).click();
	const selectAll = dialog(page).getByRole('button', { name: 'Chọn tất cả', exact: true });
	if (await selectAll.count()) await selectAll.click();
	await dialog(page).getByRole('button', { name: 'Bỏ chọn tất cả', exact: true }).click();
	await submitBtn(page).click();
	await page.waitForTimeout(400);
	text = clean(await dialog(page).innerText());
	const focusedId = await page.evaluate(() => document.activeElement?.id ?? '');
	await page.screenshot({ path: `${SHOTS}/${v}-08-missing.png` });
	check(
		`${v}.8`,
		/Bạn chọn ít nhất một phòng tham gia/.test(text) && /Thiếu: Phòng tham gia/.test(text) && focusedId === 'period-departments',
		'Thiếu phòng: lỗi inline, dòng "Thiếu: …", con trỏ tới đúng chỗ',
		`focus #${focusedId}`,
	);
	await dialog(page).getByRole('button', { name: 'Chọn tất cả', exact: true }).click();

	// 9. Tiêu đề thu gọn: Sửa mới hiện ô, Dùng tên tự động trả về.
	await dialog(page).getByRole('button', { name: 'Sửa', exact: true }).click();
	const titleShown = await page.locator('#period-title').isVisible();
	await page.locator('#period-title').fill('Kỳ thử');
	await dialog(page).getByRole('button', { name: 'Dùng tên tự động' }).click();
	text = clean(await dialog(page).innerText());
	check(`${v}.9`, titleShown && /Tháng 1\/2027 \(tự động\)/.test(text), 'Tiêu đề: Sửa hiện ô nhập, Dùng tên tự động quay lại', text.match(/Tiêu đề[^S]*/)?.[0] ?? '');

	// 10. Tab không thoát ra ngoài hộp.
	let escaped = false;
	for (let i = 0; i < 25; i++) {
		await page.keyboard.press('Tab');
		if (!(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')))) escaped = true;
	}
	check(`${v}.10`, !escaped, 'Focus trap: 25 lần Tab vẫn trong hộp');

	if (width === 1024) {
		// 11. Máy chủ từ chối (giả bằng chặn request): báo trong hộp, giữ dữ liệu, không đóng.
		await page.route('**/v1/office/supply-periods', route =>
			route.request().method() === 'POST'
				? route.fulfill({
						status: 409,
						contentType: 'application/json',
						body: JSON.stringify({ success: false, error: { code: 'OFFICE_SUPPLY_PERIOD_EXISTS', message: 'Văn phòng Đà Nẵng đã có kỳ đăng ký Tháng 1/2027.' } }),
					})
				: route.continue(),
		);
		await submitBtn(page).click();
		await page.waitForTimeout(800);
		text = clean(await dialog(page).innerText());
		const stillOpen = await dialog(page).isVisible();
		const deadlineKept = await dateInput.inputValue();
		await page.screenshot({ path: `${SHOTS}/${v}-11-server-error.png` });
		check(`${v}.11`, stillOpen && /đã có kỳ đăng ký Tháng 1\/2027/.test(text) && deadlineKept === '15/01/2027', 'Lỗi máy chủ hiện trong hộp, giữ dữ liệu', `hộp ${stillOpen ? 'còn mở' : 'đã đóng'}, hạn chót "${deadlineKept}"`);
		await page.unroute('**/v1/office/supply-periods');
	}

	// 12. Esc đóng hộp.
	await page.keyboard.press('Escape');
	await page.waitForTimeout(300);
	check(`${v}.12`, (await dialog(page).count()) === 0, 'Esc đóng hộp');

	if (width === 1440) {
		// 13. Gợi ý → hộp điền sẵn → mở kỳ thật → toast, danh sách cập nhật, gợi ý biến mất.
		await page.getByRole('button', { name: /^Mở kỳ tháng 1\/2027$/ }).click();
		await dialog(page).waitFor();
		await page.waitForTimeout(800);
		text = clean(await dialog(page).innerText());
		const presetOk = /Tháng 1\/2027/.test(text) && /00:00 ngày 21\/01\/2027/.test(text) && /Mở kỳ cho 4 phòng/.test(text);
		await page.screenshot({ path: `${SHOTS}/${v}-13a-suggest-modal.png` });
		await submitBtn(page).click();
		const toast = clean(await page.locator('div.fixed.top-4.right-4 [role="alert"]').first().innerText({ timeout: 15000 }).catch(() => ''));
		await page.waitForTimeout(1200);
		const cards = await page.locator('section[aria-labelledby="periods-active"] article').count();
		const suggestLeft = await page.locator('[data-tour="period-suggest"]').count();
		await page.screenshot({ path: `${SHOTS}/${v}-13b-after-create.png` });
		check(
			`${v}.13`,
			presetOk && /Đã mở kỳ tháng 1\/2027 cho 4 phòng/.test(toast) && cards === 5 && suggestLeft === 0 && (await dialog(page).count()) === 0,
			'Gợi ý mở hộp điền sẵn; mở kỳ xong có toast, danh sách thêm thẻ, gợi ý biến mất',
			`điền sẵn ${presetOk}; toast "${toast}"; ${cards} thẻ; gợi ý còn ${suggestLeft}`,
		);
	}

	check(`${v}.err`, page.errors.length === 0, 'Không lỗi JS', page.errors.slice(0, 3).join(' | '));
	await page.context().close();
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
// 1024 chạy trước vì chỉ đọc; 1440 có một lần mở kỳ thật nên để sau, hai khổ thấy cùng dữ liệu ban đầu.
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
