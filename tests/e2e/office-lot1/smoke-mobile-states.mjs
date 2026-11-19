/**
 * FE-21, FE-22: điện thoại 390×844, và ba trạng thái đang tải, rỗng, lỗi mạng.
 *
 * Lỗi mạng được dựng bằng cách chặn request NGAY TRONG trình duyệt (`page.route`), không tắt
 * sandbox: sandbox là của session BE, tắt đi là phá việc của người khác.
 */
import { WHO, api, apiToken, go, launch, line, selectAt, shot, signIn, summary, text, toastText } from './helper.mjs';

const browser = await launch();

// ─── FE-21: điện thoại 390×844 ────────────────────────────────────────────────
const hrPhone = await signIn(browser, WHO.hr.email, { phone: true });
const empPhone = await signIn(browser, WHO.employeeA1.email, { phone: true });

/** Trang có tràn ngang không: so bề rộng cuộn của tài liệu với bề rộng khung nhìn. */
async function overflow(page) {
	return page.evaluate(() => ({
		scrollWidth: document.documentElement.scrollWidth,
		clientWidth: document.documentElement.clientWidth,
	}));
}

const PHONE_PAGES = [
	{ page: empPhone, path: '/office/supplies', name: 'phiếu văn phòng phẩm', shotName: 'fe-21-supplies' },
	{ page: empPhone, path: '/office/rooms', name: 'lưới phòng họp', shotName: 'fe-21-rooms' },
	{ page: hrPhone, path: '/management/office/settings', name: 'cài đặt hành chính', shotName: 'fe-21-settings' },
	{
		page: hrPhone,
		path: '/management/office/supply-periods',
		name: 'danh sách kỳ',
		shotName: 'fe-21-periods',
	},
];

for (const target of PHONE_PAGES) {
	await go(target.page, target.path, 4000);
	const size = await overflow(target.page);
	// Cho sai số 2 pixel vì viền và thanh cuộn của trình duyệt.
	line(
		size.scrollWidth <= size.clientWidth + 2,
		`FE-21 ${target.name} không tràn ngang trên điện thoại`,
		`scrollWidth ${size.scrollWidth} so với khung ${size.clientWidth}`,
	);
	console.log('ảnh:', await shot(target.page, target.shotName));
}

// Trang kỳ (ma trận) là trang rộng nhất, nên kiểm riêng cả tràn ngang lẫn chỗ cuộn. Phải mở kỳ
// ĐÃ CÓ DỮ LIỆU: kỳ rỗng thì không có bảng nào để cuộn.
await go(hrPhone, '/management/office/supply-periods', 4000);
await hrPhone.locator('a', { hasText: 'Tháng 12/2026' }).first().click();
await hrPhone.waitForTimeout(4500);
const periodSize = await overflow(hrPhone);
line(
	periodSize.scrollWidth <= periodSize.clientWidth + 2,
	'FE-21 trang kỳ không tràn ngang trên điện thoại',
	`scrollWidth ${periodSize.scrollWidth} so với khung ${periodSize.clientWidth}`,
);
const matrixScroll = await hrPhone.evaluate(() => {
	const boxes = [...document.querySelectorAll('div.overflow-x-auto')];
	const scrollable = boxes.find(b => b.scrollWidth > b.clientWidth + 2);
	return scrollable ? { scrollWidth: scrollable.scrollWidth, clientWidth: scrollable.clientWidth } : null;
});
line(
	!!matrixScroll,
	'FE-21 bảng tổng hợp cuộn ngang trong khung của nó',
	matrixScroll ? `${matrixScroll.scrollWidth} trong khung ${matrixScroll.clientWidth}` : 'không thấy khung cuộn',
);
console.log('ảnh:', await shot(hrPhone, 'fe-21-period-matrix'));

// FE-34: tổng tiền kỳ không được nằm dưới nút trợ lý nổi.
const overlap = await hrPhone.evaluate(() => {
	// Nút trợ lý nổi: `button.fixed.rounded-full` ở góc dưới phải (xem AppAgentFab.vue).
	const fab = [...document.querySelectorAll('button')].find(
		el => el.className.includes('fixed') && el.className.includes('rounded-full'),
	);
	const nodes = [...document.querySelectorAll('h2, td, p, span')].filter(el =>
		(el.textContent ?? '').includes('Tổng tiền kỳ'),
	);
	if (!fab || !nodes.length) return { found: nodes.length > 0, hasFab: !!fab, covered: false };
	const fabBox = fab.getBoundingClientRect();
	const covered = nodes.some(el => {
		const box = el.getBoundingClientRect();
		return !(box.right < fabBox.left || box.left > fabBox.right || box.bottom < fabBox.top || box.top > fabBox.bottom);
	});
	return { found: true, hasFab: true, covered };
});
line(
	overlap.found && !overlap.covered,
	'FE-34 tổng tiền kỳ không bị nút trợ lý nổi che',
	JSON.stringify(overlap),
);

// FE-34: dấu hỏi cạnh tiêu đề mở được bằng một cú chạm trên điện thoại.
await go(empPhone, '/office/rooms', 4000);
const infoButton = empPhone.locator('button[aria-label^="Trang này dùng để làm gì"]').first();
line((await infoButton.count()) > 0, 'FE-34 tiêu đề trang có dấu hỏi giải thích');
await infoButton.click();
await empPhone.waitForTimeout(600);
const tipText = await empPhone.locator('[role="tooltip"]').first().innerText().catch(() => '');
line(
	/khung giờ còn trống/.test(tipText),
	'FE-34 chạm vào dấu hỏi thì hiện câu giải thích của trang',
	tipText.replace(/\s+/g, ' ').slice(0, 120),
);
console.log('ảnh:', await shot(empPhone, 'fe-34-page-header-tooltip'));

// Lưới phòng họp cũng phải cuộn trong khung của nó.
await go(empPhone, '/office/rooms', 4000);
const gridScroll = await empPhone.evaluate(() => {
	const boxes = [...document.querySelectorAll('div.overflow-x-auto')];
	const scrollable = boxes.find(b => b.scrollWidth > b.clientWidth + 2);
	return scrollable ? { scrollWidth: scrollable.scrollWidth, clientWidth: scrollable.clientWidth } : null;
});
line(
	!!gridScroll,
	'FE-21 lưới phòng cuộn ngang trong khung của nó',
	gridScroll ? `${gridScroll.scrollWidth} trong khung ${gridScroll.clientWidth}` : 'không thấy khung cuộn',
);

// Ô bấm trên điện thoại phải đủ lớn: nút chính của trang phiếu cao ít nhất 36 pixel.
await go(empPhone, '/office/supplies', 4000);
const buttonHeights = await empPhone.evaluate(() =>
	[...document.querySelectorAll('button')]
		.filter(b => b.offsetParent !== null && (b.textContent ?? '').trim().length > 2)
		.map(b => Math.round(b.getBoundingClientRect().height)),
);
const tooSmall = buttonHeights.filter(h => h > 0 && h < 32);
line(
	tooSmall.length === 0,
	'FE-21 các nút trên trang phiếu đủ cao để bấm bằng ngón tay',
	tooSmall.length ? `nút cao: ${tooSmall.join(', ')}` : `thấp nhất ${Math.min(...buttonHeights)} pixel`,
);

// ─── FE-22: đang tải, rỗng, lỗi mạng ──────────────────────────────────────────
const hr = await signIn(browser, WHO.hr.email);

// Đang tải: giữ response lại vài giây rồi chụp lúc còn khung xương.
await hr.route('**/v1/office/supply-periods**', async route => {
	await new Promise(resolve => setTimeout(resolve, 5000));
	// Bài có thể đã bỏ chặn trước khi hẹn giờ chạy xong, lúc đó `continue` báo lỗi: bỏ qua.
	await route.continue().catch(() => {});
});
await hr.goto('http://localhost:4030/management/office/supply-periods', { waitUntil: 'domcontentloaded' });
await hr.waitForTimeout(2500);
const skeletons = await hr.locator('div.animate-pulse').count();
line(skeletons > 0, 'FE-22 trang kỳ có khung xương trong lúc tải', `${skeletons} khung`);
console.log('ảnh:', await shot(hr, 'fe-22-loading'));
await hr.unroute('**/v1/office/supply-periods**');

/**
 * Rỗng: lọc theo một văn phòng CHƯA có kỳ nào.
 *
 * Trước đây bài cắm cứng "Văn phòng Lạng Sơn", nhưng các bài khác cũng mở kỳ ở đó khi Hữu Nghị
 * hết tháng trống, nên phải tìm theo dữ liệu thật; không còn văn phòng nào trống thì dựng tạm một
 * văn phòng rồi ngừng dùng nó ngay sau khi kiểm.
 */
const hrTokenStates = await apiToken(WHO.hr.email);
const sitesForEmpty = ((await api(hrTokenStates, '/v1/office/sites')).json?.data ?? []).filter(s => s.isActive);
const periodsForEmpty = (await api(hrTokenStates, '/v1/office/supply-periods')).json?.data ?? [];
const usedSiteIds = new Set(periodsForEmpty.map(p => p.officeSite.id));
let emptySite = sitesForEmpty.find(s => !usedSiteIds.has(s.id)) ?? null;
let temporarySiteId = null;
if (!emptySite) {
	const created = await api(hrTokenStates, '/v1/office/sites', {
		method: 'POST',
		body: JSON.stringify({ name: `Văn phòng trống ${Date.now().toString().slice(-5)}` }),
	});
	if (created.status >= 400) throw new Error(`không dựng được văn phòng trống: ${created.text.slice(0, 160)}`);
	emptySite = created.json.data;
	temporarySiteId = emptySite.id;
}
console.log(`văn phòng chưa có kỳ: ${emptySite.name}`);

await go(hr, '/management/office/supply-periods', 4000);
await selectAt(hr, hr, 0, emptySite.name);
await hr.waitForTimeout(3000);
const emptyPeriods = await text(hr);
line(
	/Chưa có kỳ đăng ký nào/.test(emptyPeriods),
	'FE-22 chưa có kỳ nào thì nói rõ bằng câu, không để trống',
	emptyPeriods.match(/Chưa có kỳ đăng ký nào[^.]*/)?.[0] ?? '',
);
console.log('ảnh:', await shot(hr, 'fe-22-empty-periods'));

await go(hr, '/office/rooms', 4000);
await selectAt(hr, hr, 0, emptySite.name);
await hr.waitForTimeout(3000);
const emptyRooms = await text(hr);
line(
	/chưa có phòng họp nào/i.test(emptyRooms),
	'FE-22 văn phòng chưa có phòng họp thì nói rõ và chỉ chỗ liên hệ',
	emptyRooms.match(/[^.]*chưa có phòng họp nào[^.]*/i)?.[0]?.trim() ?? '',
);
console.log('ảnh:', await shot(hr, 'fe-22-empty-rooms'));

// Lỗi mạng: chặn mọi request của module ngay trong trình duyệt.
await hr.route('**/v1/office/**', route => route.abort('failed'));
await hr.goto('http://localhost:4030/management/office/supply-periods', { waitUntil: 'domcontentloaded' });
await hr.waitForTimeout(4000);
const errorText = await text(hr);
const retryCount = await hr.getByRole('button', { name: 'Thử lại' }).count();
line(
	/mạng|Chưa tải được/i.test(errorText),
	'FE-22 mất mạng thì trang nói rõ chưa tải được, không trắng trang',
	errorText.match(/[^.]*(mạng|Chưa tải được)[^.]*/i)?.[0]?.trim().slice(0, 140) ?? '',
);
line(retryCount > 0, 'FE-22 có nút Thử lại để tải lại sau khi có mạng', `${retryCount} nút`);
console.log('ảnh:', await shot(hr, 'fe-22-network-error'));

// Trang phiếu của phòng gọi nhóm route `/v1/me/office/...`, nên phải chặn riêng nhóm đó, và phải
// dùng người CÓ phiếu — HR01 không thuộc phòng nào nên trang của họ vốn đã rỗng.
const empDesktop = await signIn(browser, WHO.employeeA1.email);
await empDesktop.route('**/v1/me/office/**', route => route.abort('failed'));
await empDesktop.goto('http://localhost:4030/office/supplies', { waitUntil: 'domcontentloaded' });
await empDesktop.waitForTimeout(4000);
const suppliesError = await text(empDesktop);
const suppliesToast = await toastText(empDesktop, 5000);
line(
	suppliesError.length > 200,
	'FE-22 trang phiếu mất mạng vẫn còn khung trang, không trắng',
	`${suppliesError.length} ký tự`,
);
const suppliesReason = suppliesError.match(/[^.]*(mạng|Chưa tải được)[^.]*/i)?.[0]?.trim().slice(0, 140) ?? '';
line(
	/mạng|Chưa tải được/i.test(`${suppliesError} ${suppliesToast}`),
	'FE-22 trang phiếu nói rõ vì sao chưa có dữ liệu',
	suppliesToast || suppliesReason,
);
console.log('ảnh:', await shot(empDesktop, 'fe-22-network-error-supplies'));
await hr.unroute('**/v1/office/**');
await empDesktop.unroute('**/v1/me/office/**');

for (const [name, page] of [
	['HR01 điện thoại', hrPhone],
	['EMPA1 điện thoại', empPhone],
	['HR01 máy tính', hr],
	['EMPA1 máy tính', empDesktop],
]) {
	// Lỗi mạng dựng bằng `route.abort` làm Chrome in "net::ERR_FAILED" ra console, đó là do bài
	// chặn chứ không phải lỗi của trang, nên lọc ra.
	const real = page.errors.filter(e => !/ERR_FAILED|Failed to fetch|NetworkError/i.test(e));
	line(real.length === 0, `FE-21/FE-22 không có lỗi JavaScript (${name})`, real.slice(0, 2).join(' | '));
}

// Văn phòng dựng tạm cho phần "rỗng" thì ngừng dùng ngay, khỏi để lại rác trên sandbox.
if (temporarySiteId) {
	await api(hrTokenStates, `/v1/office/sites/${temporarySiteId}`, {
		method: 'PATCH',
		body: JSON.stringify({ isActive: false }),
	});
	console.log(`đã ngừng dùng văn phòng tạm ${temporarySiteId}`);
}

await browser.close();
process.exit(summary() ? 1 : 0);
