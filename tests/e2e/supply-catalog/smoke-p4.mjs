/**
 * Bấm thử thẻ Văn phòng phẩm của Cài đặt hành chính (P4) trên sandbox (sau seed-p4.cjs).
 *
 * Khổ 1024 chạy trước, chỉ đọc, và giả trạng thái trống, lỗi tải bằng chặn request. Khổ 1440 ghi thật: thêm mặt hàng
 * từ nhóm đang lọc, trùng tên, sửa nhanh giá, ngừng dùng rồi dùng lại, sửa mặt hàng, thêm nhóm, nhập file Excel thử.
 *
 *   node tests/e2e/supply-catalog/smoke-p4.mjs <thư mục ảnh> <file Excel thử>
 */
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const WEB = 'http://127.0.0.1:4999';
const ACC = JSON.parse(readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/p1-accounts.json', 'utf8'));
const PASSWORD = /const PASSWORD\s*=\s*['"`]([^'"`]+)['"`]/.exec(
	readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/drill-p1.cjs', 'utf8'),
)[1];
const SHOTS = process.argv[2] ?? '/tmp/supply-p4';
const XLSX = process.argv[3];
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
async function apiList(path) {
	return (await (await fetch(`${ACC.api}${path}`, { headers: { authorization: `Bearer ${adminTok}` } })).json()).data;
}

const toolbar = page => page.locator('[data-tour="supply-toolbar"]');
const itemNames = page => page.locator('[data-catalog-list] p[title]').allInnerTexts();
const toast = async page => clean(await page.locator('div.fixed.top-4.right-4 [role="alert"]').last().innerText({ timeout: 15000 }).catch(() => ''));
async function clearToasts(page) {
	await page.evaluate(() => document.querySelectorAll('div.fixed.top-4.right-4 [role="alert"] button').forEach(b => b.click()));
	await page.waitForTimeout(300);
}
function rowOf(page, name) {
	return page.locator('[data-catalog-list] p[title]', { hasText: name }).first().locator('xpath=..');
}

async function signIn(browser, width) {
	const page = await (await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true })).newPage();
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
async function openTab(page, query = '') {
	await page.goto(`${WEB}/management/office/settings?tab=supplies${query}`);
	await toolbar(page).waitFor({ timeout: 60000 }).catch(() => {});
	await page.waitForTimeout(800);
	await page.addStyleTag({ content: '#nuxt-devtools-anchor,.nuxt-devtools-anchor{display:none !important}' }).catch(() => {});
}

async function run(browser, width) {
	const v = `w${width}`;
	const page = await signIn(browser, width);
	const items = await apiList('/office/supply-items?includeInactive=true');
	const groups = await apiList('/office/supply-groups?includeInactive=true');
	const activeItems = items.filter(i => i.isActive && groups.find(g => g.id === i.groupId)?.isActive);
	const unpriced = activeItems.filter(i => i.unitPrice == null);

	// 1. Màn đầu: danh mục ngay dưới tiêu đề, không còn ô kéo thả lớn.
	await openTab(page);
	await page.screenshot({ path: `${SHOTS}/${v}-01-first-screen.png` });
	const tb = await toolbar(page).boundingBox();
	const firstRow = await page.locator('[data-catalog-list] p[title]').first().boundingBox();
	const fileInputs = await page.locator('input[type="file"]').count();
	const addBtn = await page.getByRole('button', { name: '+ Thêm mặt hàng' }).first().boundingBox();
	const overflow = await page.evaluate(() => {
		const main = document.querySelector('main');
		return main ? main.scrollWidth - main.clientWidth : -1;
	});
	check(
		`${v}.1`,
		tb.y < 300 && firstRow.y < 600 && fileInputs === 0 && addBtn.y < 400 && overflow <= 0,
		'Thanh công cụ và mặt hàng đầu thấy ngay; không ô kéo thả; nút Thêm mặt hàng ở thanh công cụ',
		`toolbar y ${Math.round(tb.y)}, dòng đầu y ${Math.round(firstRow.y)}, ô file ${fileInputs}, nút thêm y ${Math.round(addBtn.y)}, tràn ${overflow}`,
	);

	// 2. Chip nhóm có số; bấm chip lọc đúng nhóm, lên địa chỉ trang.
	const pens = groups.find(g => g.name.startsWith('Bút'));
	const penCount = activeItems.filter(i => i.groupId === pens.id).length;
	const chip = page.getByRole('button', { name: new RegExp(`^${pens.name.replace(/[()&]/g, '.')}\\s+${penCount}$`) });
	const chipOk = (await chip.count()) === 1;
	await chip.click();
	await page.waitForTimeout(400);
	const shownAfterChip = (await itemNames(page)).length;
	const groupParam = new URL(page.url()).searchParams.get('group');
	await page.getByRole('button', { name: /^Tất cả/ }).click();
	await page.waitForTimeout(300);
	check(`${v}.2`, chipOk && shownAfterChip === penCount && groupParam === String(pens.id), 'Chip nhóm kèm số; bấm là lọc đúng nhóm, lưu lên ?group=', `chip ${chipOk}; ${shownAfterChip}/${penCount} dòng; group=${groupParam}`);

	// 3. Tìm không dấu; không ra thì Xoá bộ lọc.
	await page.getByRole('searchbox', { name: 'Tìm mặt hàng' }).fill('but chi');
	await page.waitForTimeout(300);
	const found = await itemNames(page);
	await page.getByRole('searchbox', { name: 'Tìm mặt hàng' }).fill('khong co mat hang nay');
	await page.waitForTimeout(300);
	const none = await page.getByText('Không có mặt hàng phù hợp.').isVisible();
	await page.getByRole('button', { name: 'Xoá bộ lọc' }).click();
	await page.waitForTimeout(300);
	check(`${v}.3`, found.length >= 1 && found.every(n => /bút chì/i.test(n)) && none, 'Tìm "but chi" ra Bút chì; tìm không ra có Xoá bộ lọc', found.join(', '));

	// 4. Thiếu đơn giá: đúng số, "Tẩy" giá 0 không bị tính là thiếu.
	const toggle = page.getByRole('checkbox', { name: /Thiếu đơn giá/ });
	const label = clean(await page.locator('label', { hasText: 'Thiếu đơn giá' }).innerText());
	await toggle.check();
	await page.waitForTimeout(300);
	const unpricedShown = await itemNames(page);
	await toggle.uncheck();
	check(
		`${v}.4`,
		label === `Thiếu đơn giá (${unpriced.length})` && unpricedShown.length === unpriced.length && !unpricedShown.includes('Tẩy'),
		'Thiếu đơn giá đúng số; giá 0 không bị tính là thiếu',
		`${label}; lọc ${unpricedShown.length}/${unpriced.length}`,
	);

	// 5. Đã ngừng dùng: hiện cả mặt hàng và nhóm đã ngừng.
	const beforeInactive = await itemNames(page);
	await page.getByRole('checkbox', { name: 'Đã ngừng dùng' }).check();
	await page.waitForTimeout(300);
	const withInactive = await itemNames(page);
	await page.getByRole('checkbox', { name: 'Đã ngừng dùng' }).uncheck();
	check(
		`${v}.5`,
		!beforeInactive.includes('Bút xoá nước') && withInactive.includes('Bút xoá nước') && withInactive.includes('Mực in kim cũ'),
		'Mặc định ẩn mục ngừng dùng; bật "Đã ngừng dùng" thì hiện',
		`${beforeInactive.length} → ${withInactive.length} dòng`,
	);

	// 6. Thanh công cụ và tiêu đề nhóm dính khi cuộn.
	await page.evaluate(() => document.querySelector('main')?.scrollBy(0, 1500));
	await page.waitForTimeout(300);
	const tbScrolled = await toolbar(page).boundingBox();
	const stuckHeader = await page.evaluate(() => {
		const bar = document.querySelector('[data-tour="supply-toolbar"]')?.getBoundingClientRect();
		const heads = [...document.querySelectorAll('[data-catalog-list] > section > div.sticky')];
		return heads.some(h => Math.abs(h.getBoundingClientRect().top - (bar?.bottom ?? 0)) < 2);
	});
	await page.screenshot({ path: `${SHOTS}/${v}-06-scrolled.png` });
	await page.evaluate(() => document.querySelector('main')?.scrollTo(0, 0));
	check(`${v}.6`, tbScrolled.y < 80 && stuckHeader, 'Cuộn: thanh công cụ dính dưới đầu app, tiêu đề nhóm dính ngay dưới nó', `toolbar y ${Math.round(tbScrolled.y)}`);

	// 7. Thêm mặt hàng từ nhóm đang lọc: chọn sẵn nhóm đó.
	const papers = groups.find(g => g.name.startsWith('Sổ & Giấy'));
	await page.getByRole('group', { name: 'Lọc theo nhóm' }).getByRole('button', { name: new RegExp(`^${papers.name.replace(/[()&]/g, '.')}`) }).click();
	await page.getByRole('button', { name: '+ Thêm mặt hàng' }).first().click();
	const dialog = page.getByRole('dialog', { name: 'Thêm mặt hàng' });
	await dialog.waitFor();
	const preset = clean(await dialog.innerText());
	await page.screenshot({ path: `${SHOTS}/${v}-07-add-preset.png` });
	check(`${v}.7`, preset.includes(papers.name), 'Đang lọc một nhóm thì form Thêm mặt hàng chọn sẵn nhóm đó', papers.name);

	if (width === 1440) {
		// 8. Trùng tên: lỗi ngay ở ô Tên, hộp không đóng.
		await dialog.locator('#supply-item-name').fill('Bút chì gỗ');
		await dialog.locator('#supply-item-unit').fill('Chiếc');
		await dialog.getByRole('button', { name: 'Lưu' }).click();
		await page.waitForTimeout(800);
		const dupErr = clean(await dialog.locator('#supply-item-name-error').innerText().catch(() => ''));
		check(`${v}.8`, (await dialog.isVisible()) && dupErr.length > 0, 'Trùng tên mặt hàng: lỗi của máy chủ ở ngay ô Tên, hộp vẫn mở', dupErr);

		// 9. Thêm thật vào nhóm chọn sẵn.
		await dialog.locator('#supply-item-name').fill('Kẹp giấy thử P4');
		await dialog.locator('#supply-item-unit').fill('Hộp');
		await clearToasts(page);
		await dialog.getByRole('button', { name: 'Lưu' }).click();
		const t9 = await toast(page);
		await page.waitForTimeout(800);
		const created = (await apiList('/office/supply-items?includeInactive=true')).find(i => i.name === 'Kẹp giấy thử P4');
		check(`${v}.9`, created?.groupId === papers.id && /Đã lưu mặt hàng/.test(t9) && (await itemNames(page)).includes('Kẹp giấy thử P4'), 'Thêm mặt hàng vào nhóm chọn sẵn; danh sách cập nhật tại chỗ', `nhóm ${created?.groupId}; toast "${t9}"`);
		await page.getByRole('button', { name: /^Tất cả/ }).click();

		// 10. Sửa nhanh đơn giá: Enter lưu bằng API sửa mặt hàng.
		const target = unpriced.find(i => i.groupId === pens.id) ?? unpriced[0];
		const before = Number((await page.locator('label', { hasText: 'Thiếu đơn giá' }).innerText()).match(/\d+/)?.[0]);
		await rowOf(page, target.name).getByRole('button', { name: /Chưa có đơn giá/ }).click();
		const priceInput = page.getByRole('textbox', { name: `Đơn giá gồm VAT, ${target.name}` });
		await priceInput.fill('7500');
		await clearToasts(page);
		await priceInput.press('Enter');
		await page.waitForTimeout(1000);
		const after = Number((await page.locator('label', { hasText: 'Thiếu đơn giá' }).innerText()).match(/\d+/)?.[0]);
		const saved = (await apiList('/office/supply-items?includeInactive=true')).find(i => i.id === target.id);
		const rowText = clean(await rowOf(page, target.name).innerText());
		await page.screenshot({ path: `${SHOTS}/${v}-10-price-saved.png` });
		check(`${v}.10`, saved.unitPrice === 7500 && after === before - 1 && /7\.500 đ/.test(rowText), 'Sửa nhanh giá: API lưu, số thiếu giá giảm 1, dòng hiện giá mới', `${target.name}: ${saved.unitPrice}; thiếu giá ${before}→${after}`);

		// 11. Ngừng dùng rồi dùng lại từ menu ⋯.
		await rowOf(page, 'Bút chì gỗ').getByRole('button', { name: 'Thêm việc với Bút chì gỗ' }).click();
		await page.getByRole('menuitem', { name: 'Ngừng dùng' }).click();
		await page.waitForTimeout(1000);
		const stopped = (await apiList('/office/supply-items?includeInactive=true')).find(i => i.name === 'Bút chì gỗ');
		const hidden = !(await itemNames(page)).includes('Bút chì gỗ');
		await page.getByRole('checkbox', { name: 'Đã ngừng dùng' }).check();
		await rowOf(page, 'Bút chì gỗ').getByRole('button', { name: 'Thêm việc với Bút chì gỗ' }).click();
		await page.getByRole('menuitem', { name: 'Dùng lại' }).click();
		await page.waitForTimeout(1000);
		await page.getByRole('checkbox', { name: 'Đã ngừng dùng' }).uncheck();
		const back = (await apiList('/office/supply-items?includeInactive=true')).find(i => i.name === 'Bút chì gỗ');
		check(`${v}.11`, stopped.isActive === false && hidden && back.isActive === true, 'Menu ⋯: Ngừng dùng (dòng ẩn), Dùng lại (về như cũ)', `${stopped.isActive} → ${back.isActive}`);

		// 12. Sửa mặt hàng qua hộp thoại.
		await rowOf(page, 'Kẹp giấy thử P4').getByRole('button', { name: 'Sửa Kẹp giấy thử P4' }).click();
		const edit = page.getByRole('dialog', { name: 'Sửa mặt hàng Kẹp giấy thử P4' });
		await edit.locator('#supply-item-unit').fill('Túi');
		await edit.getByRole('button', { name: 'Lưu' }).click();
		await page.waitForTimeout(1000);
		const edited = (await apiList('/office/supply-items?includeInactive=true')).find(i => i.name === 'Kẹp giấy thử P4');
		check(`${v}.12`, edited.unit === 'Túi', 'Sửa mặt hàng: đơn vị mới lưu', edited.unit);

		// 13. Nhóm: khối thu gọn, mở ra có thẻ Chỉ HCNS đặt; thêm nhóm, trùng tên báo ở ô Tên.
		const groupsHead = clean(await page.locator('#supply-groups-title').innerText());
		const listHidden = (await page.locator('#supply-groups-list').count()) === 0;
		await page.locator('#supply-groups-title').click();
		const badges = await page.locator('#supply-groups-list [data-testid="hr-only-badge"]').count();
		const badgeTitle = await page.locator('#supply-groups-list [data-testid="hr-only-badge"]').first().getAttribute('title');
		await page.getByRole('button', { name: 'Thêm nhóm' }).click();
		const gdlg = page.getByRole('dialog', { name: 'Thêm nhóm' });
		await gdlg.locator('#supply-group-name').fill(pens.name);
		await gdlg.getByRole('button', { name: 'Lưu' }).click();
		await page.waitForTimeout(800);
		const gErr = clean(await gdlg.locator('#supply-group-name-error').innerText().catch(() => ''));
		await gdlg.locator('#supply-group-name').fill('Nhóm thử P4');
		await gdlg.getByRole('button', { name: 'Lưu' }).click();
		await page.waitForTimeout(1000);
		const newChip = await page.getByRole('button', { name: /^Nhóm thử P4\s+0$/ }).count();
		await page.screenshot({ path: `${SHOTS}/${v}-13-groups.png` });
		check(
			`${v}.13`,
			/\d+ nhóm, 3 nhóm chỉ HCNS đặt/.test(groupsHead) && listHidden && badges === 3 && /không hiện trong ô chọn/.test(badgeTitle ?? '') && gErr.length > 0 && newChip === 1,
			'Khối nhóm thu gọn; thẻ Chỉ HCNS đặt có giải thích; trùng tên báo ở ô Tên; nhóm mới có chip',
			`"${groupsHead}"; ${badges} thẻ; lỗi "${gErr}"`,
		);

		// 14. Nhập Excel trong ngăn kéo: kết quả, lỗi từng dòng, ngăn giữ mở, danh sách tự làm mới.
		await page.getByRole('button', { name: 'Nhập từ Excel' }).click();
		const drawer = page.getByRole('dialog', { name: 'Nhập mặt hàng từ Excel' });
		const download = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
		await drawer.getByRole('button', { name: 'Tải file mẫu' }).click();
		const tpl = await download;
		await drawer.locator('input[type="file"]').setInputFiles(XLSX);
		await clearToasts(page);
		await drawer.getByRole('button', { name: 'Import danh mục' }).click();
		const t14 = await toast(page);
		await page.waitForTimeout(1200);
		const result = clean(await drawer.innerText());
		await page.screenshot({ path: `${SHOTS}/${v}-14-import-result.png` });
		const stillOpen = await drawer.isVisible();
		await page.keyboard.press('Escape');
		await page.waitForTimeout(300);
		const focusBack = await page.evaluate(() => document.activeElement?.textContent?.trim());
		const imported = await itemNames(page);
		check(
			`${v}.14`,
			!!tpl && /Đã nhập xong/.test(t14) && /chỗ cần bạn xem lại/.test(result) && stillOpen && imported.includes('Sổ tay nhập thử A') && focusBack === 'Nhập từ Excel',
			'Ngăn nhập: tải mẫu, nhập file, kết quả và lỗi từng dòng như cũ, ngăn giữ mở; Esc đóng, con trỏ về nút',
			`mẫu ${tpl?.suggestedFilename()}; toast "${t14.slice(0, 70)}"; ${result.match(/\d+ chỗ cần bạn xem lại/)?.[0]}`,
		);
	} else {
		await page.keyboard.press('Escape');
		await page.getByRole('button', { name: /^Tất cả/ }).click();

		// 8'. Sửa nhanh giá: Esc huỷ, không gọi API.
		let writes = 0;
		page.on('request', req => {
			if (req.method() === 'PATCH') writes++;
		});
		const target = unpriced[0];
		await rowOf(page, target.name).getByRole('button', { name: /Chưa có đơn giá/ }).click();
		await page.getByRole('textbox', { name: `Đơn giá gồm VAT, ${target.name}` }).fill('9999');
		await page.keyboard.press('Escape');
		await page.waitForTimeout(500);
		check(`${v}.8`, writes === 0 && /Chưa có đơn giá/.test(clean(await rowOf(page, target.name).innerText())), 'Sửa nhanh giá: Esc huỷ, không gọi API', `${writes} PATCH`);

		// 9'. Ngăn nhập: quy tắc nguyên văn, con trỏ trong ngăn, Esc đóng và trả con trỏ về nút.
		await page.getByRole('button', { name: 'Nhập từ Excel' }).click();
		const drawer = page.getByRole('dialog', { name: 'Nhập mặt hàng từ Excel' });
		const rules = clean(await drawer.innerText());
		const inside = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
		await page.screenshot({ path: `${SHOTS}/${v}-09-drawer.png` });
		await page.keyboard.press('Escape');
		await page.waitForTimeout(300);
		const focusBack = await page.evaluate(() => document.activeElement?.textContent?.trim());
		check(
			`${v}.9`,
			/Dòng số La Mã là tên nhóm, nhóm ghi "\(HCNS đặt\)" thành nhóm chỉ HCNS đặt/.test(rules) && inside && focusBack === 'Nhập từ Excel',
			'Ngăn nhập: quy tắc nguyên văn, focus trap, Esc trả con trỏ về nút',
			`trong ngăn ${inside}; con trỏ về "${focusBack}"`,
		);

		// 10'. Trạng thái trống và lỗi tải (giả bằng chặn request).
		await page.route('**/v1/office/supply-groups**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[]}' }));
		await page.route('**/v1/office/supply-items**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[]}' }));
		await openTab(page);
		const empty = clean(await page.locator('#supply-items-title').locator('xpath=ancestor::section[1]').innerText());
		const addDisabled = await page.getByRole('button', { name: '+ Thêm mặt hàng' }).isDisabled();
		await page.screenshot({ path: `${SHOTS}/${v}-10-empty.png` });
		await page.unroute('**/v1/office/supply-groups**');
		await page.unroute('**/v1/office/supply-items**');
		await page.route('**/v1/office/supply-items**', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false,"error":{"code":"X","message":"Lỗi giả để thử"}}' }));
		await openTab(page);
		const errorShown = await page.getByRole('alert').filter({ hasText: 'Lỗi giả để thử' }).isVisible().catch(() => false);
		await page.unroute('**/v1/office/supply-items**');
		await page.getByRole('button', { name: 'Thử lại' }).click();
		await toolbar(page).waitFor({ timeout: 20000 }).catch(() => {});
		const recovered = (await itemNames(page)).length > 0;
		check(
			`${v}.10`,
			/Chưa có nhóm nào/.test(empty) && /Tạo nhóm trước/.test(empty) && addDisabled && errorShown && recovered,
			'Chưa có nhóm: nút Thêm mặt hàng khoá kèm "Tạo nhóm trước"; lỗi tải có Thử lại',
			`khoá ${addDisabled}; lỗi ${errorShown}; thử lại ${recovered}`,
		);
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
