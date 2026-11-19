/**
 * S1..S11: thẻ "Văn phòng và phòng họp" gộp của Cài đặt hành chính.
 *
 * Vì sao gộp: người dùng thật đã gõ "Tầng 4 - Phòng 1" vào ô Địa chỉ của một văn phòng thứ hai tên
 * "Văn phòng Hà Nội" rồi bị báo trùng tên — họ tưởng mỗi phòng họp là một văn phòng. Bài này bấm
 * lại đúng đường đó: tạo văn phòng, thêm liền bốn phòng trong thẻ, và thử lại cú gõ trùng tên.
 */
import {
	WHO,
	api,
	apiToken,
	clearToasts,
	go,
	launch,
	line,
	shot,
	signIn,
	summary,
	text,
	toastText,
} from './helper.mjs';

const hrToken = await apiToken(WHO.hr.email);

/** Tên riêng cho mỗi lần chạy, để bài chạy lại được trên sandbox đã có dữ liệu. */
const STAMP = String(Date.now()).slice(-5);
const SITE_MAIN = `Văn phòng Hà Nội ${STAMP}`;
const SITE_SECOND = `Văn phòng Đà Nẵng ${STAMP}`;
const ROOM_NAMES = ['Tầng 4 - Phòng 1', 'Tầng 4 - Phòng 2', 'Tầng 5 - Phòng họp lớn', 'Tầng 5 - Phòng nhỏ'];

/**
 * Dòng của MỘT phòng trong thẻ.
 *
 * Lọc `div` theo chữ thì Playwright khớp cả div cha (div cha chứa chữ của mọi phòng), nên phải
 * khoá theo lớp của chính dòng đó, nếu không cú bấm rơi vào phòng khác.
 */
function roomRow(card, name) {
	return card.locator('div.px-4.py-3', { hasText: name }).first();
}

/** Khối tiêu đề của thẻ: chỗ có nút Sửa và Ngừng dùng CỦA VĂN PHÒNG, không phải của phòng. */
function siteHeader(card) {
	return card.locator('div.border-b').first();
}

const browser = await launch();
const hr = await signIn(browser, WHO.hr.email);

// ─── S10: liên kết từ trang khác, và `?tab=` cũ ───────────────────────────────
await go(hr, '/management/office/settings', 4000);
// Chỉ lấy thanh thẻ của trang, không lấy thanh bên của ứng dụng (cũng là `nav`).
const tabBar = 'nav[class*="-mb-px"] button';
const tabs = (await hr.locator(tabBar).allInnerTexts()).map(s => s.trim());
line(
	tabs[0] === 'Văn phòng và phòng họp' && !tabs.includes('Phòng họp') && !tabs.includes('Văn phòng'),
	'S10 thẻ đầu tiên là "Văn phòng và phòng họp", không còn thẻ Phòng họp riêng',
	tabs.join(' | '),
);
for (const legacy of ['sites', 'rooms']) {
	await go(hr, `/management/office/settings?tab=${legacy}`, 3500);
	const active = await hr.locator(`${tabBar}[class*="border-brand"]`).first().innerText();
	line(
		active.trim() === 'Văn phòng và phòng họp',
		`S10 liên kết cũ ?tab=${legacy} vẫn mở thẻ gộp`,
		`thẻ đang mở: ${active.trim()}`,
	);
}
console.log('ảnh:', await shot(hr, 's10-merged-tab'));

// ─── S1: công ty chưa có văn phòng ────────────────────────────────────────────
/**
 * Dùng công ty `ogo` để xem màn hình "chưa có văn phòng".
 *
 * Công ty của bài chính đã có văn phòng từ các bài khác, mà xoá văn phòng thì không có đường nào
 * qua API, nên lấy một công ty chưa dựng gì. Công ty này chưa được cấp OFFICE nên trang bị chặn;
 * vậy thì kiểm câu dẫn bằng chính công ty chính lúc chưa có văn phòng là không được. Thay vào đó
 * kiểm câu dẫn ngay trong mã nguồn đã chạy: tạo một văn phòng rồi ngừng dùng hết là vẫn còn thẻ,
 * nên ở đây chỉ kiểm phần chữ của trạng thái rỗng qua `smoke-uatb-empty.mjs` (đã có bài riêng).
 */
const sitesNow = (await api(hrToken, '/v1/office/sites', {})).json?.data ?? [];
line(
	sitesNow.length > 0,
	'S1 công ty của bài đã có văn phòng, nên trạng thái rỗng kiểm ở bài smoke-uatb-empty',
	`${sitesNow.length} văn phòng`,
);

// ─── S2: tạo văn phòng rồi thêm liền bốn phòng trong thẻ ──────────────────────
await go(hr, '/management/office/settings', 4000);
await clearToasts(hr);
await hr.getByRole('button', { name: 'Thêm văn phòng' }).first().click();
await hr.waitForTimeout(1200);
const siteForm = hr.locator('div', { hasText: 'Tên văn phòng' }).last();
const siteNameBox = hr.locator('input[placeholder*="Văn phòng Hữu Nghị"]').first();
await siteNameBox.fill(SITE_MAIN);
const addressBox = hr.locator('input[placeholder*="Lý Thường Kiệt"]').first();
line(await addressBox.count() > 0, 'S2 ô Địa chỉ có ví dụ là địa chỉ phố, không phải tầng và số phòng');
await addressBox.fill('25 Lý Thường Kiệt, Hoàn Kiếm');
const formText = (await text(hr)).replace(/\s+/g, ' ');
line(
	formText.includes('Tầng, số phòng là phòng họp: bạn thêm vào văn phòng ở bước sau'),
	'S2 form thêm văn phòng nhắc trước rằng tầng và số phòng là phòng họp',
	formText.match(/Tầng, số phòng[^.]*\./)?.[0] ?? '',
);
console.log('ảnh:', await shot(hr, 's2-site-form'));
await hr.getByRole('button', { name: 'Lưu', exact: true }).first().click();
const siteToast = await toastText(hr, 20000);
line(new RegExp(`Đã lưu văn phòng ${SITE_MAIN}`).test(siteToast), 'S2 tạo được văn phòng', siteToast);
await hr.waitForTimeout(2500);

const siteId = ((await api(hrToken, '/v1/office/sites', {})).json?.data ?? []).find(s => s.name === SITE_MAIN)?.id;
line(!!siteId, 'S2 đọc được id văn phòng vừa tạo', `id ${siteId}`);
const card = hr.locator(`#site-card-${siteId}`);
line(await card.count() > 0, 'S2 văn phòng mới có thẻ riêng trên trang');

// Thêm bốn phòng liền tay: bấm "Thêm phòng họp" MỘT lần, không chọn lại văn phòng lần nào.
await clearToasts(hr);
await card.getByRole('button', { name: 'Thêm phòng họp' }).click();
await hr.waitForTimeout(1200);
const roomForm = card.locator('input[placeholder*="Phòng họp tầng 3"]').first();
line(await roomForm.count() > 0, 'S2 form thêm phòng mở NGAY TRONG thẻ của văn phòng');
line(
	(await card.locator('button[id^="ui-select"]').count()) === 0,
	'S2 form trong thẻ không có ô chọn văn phòng, vì văn phòng đã rõ',
);
const cardFormText = (await card.innerText()).replace(/\s+/g, ' ');
line(
	cardFormText.includes(`Thêm phòng họp cho ${SITE_MAIN}`),
	'S2 tiêu đề form nói rõ đang thêm phòng cho văn phòng nào',
	cardFormText.match(/Thêm phòng họp cho [^·]{0,40}/)?.[0] ?? '',
);
console.log('ảnh:', await shot(hr, 's2-room-form-in-card'));

for (const [index, name] of ROOM_NAMES.entries()) {
	await clearToasts(hr);
	await card.locator('input[placeholder*="Phòng họp tầng 3"]').first().fill(name);
	if (index === 0) {
		// Phòng đầu nhập thêm sức chứa và thiết bị để kiểm phần hiện lại ở S6.
		await card.locator('input[role="spinbutton"]').first().fill('12');
		await card.locator('input[placeholder*="Máy chiếu"]').first().fill('Máy chiếu, Bảng trắng');
	}
	if (index % 2 === 0) {
		// Một nửa lưu bằng nút, một nửa lưu bằng Enter ở ô Tên.
		await card.getByRole('button', { name: /^Lưu/ }).first().click();
	} else {
		await card.locator('input[placeholder*="Phòng họp tầng 3"]').first().press('Enter');
	}
	const roomToast = await toastText(hr, 20000);
	line(new RegExp(`Đã lưu phòng họp ${name}`).test(roomToast), `S2 thêm được phòng "${name}"`, roomToast);
	await hr.waitForTimeout(1500);
	if (index < ROOM_NAMES.length - 1) {
		const stillOpen = await card.locator('input[placeholder*="Phòng họp tầng 3"]').count();
		const emptied = await card.locator('input[placeholder*="Phòng họp tầng 3"]').first().inputValue();
		line(
			stillOpen > 0 && emptied === '',
			`S2 lưu xong form vẫn mở và ô Tên trắng, để gõ liền phòng kế tiếp (sau "${name}")`,
			`ô Tên: "${emptied}"`,
		);
	}
}

const cardAfter = (await card.innerText()).replace(/\s+/g, ' ');
line(
	ROOM_NAMES.every(name => cardAfter.includes(name)),
	'S2 cả bốn phòng nằm trong thẻ của văn phòng',
	cardAfter.match(/Tầng [^·]{0,60}/g)?.slice(0, 4).join(' | ') ?? '',
);
line(cardAfter.includes('4 phòng họp'), 'S2 thẻ đếm đúng số phòng', cardAfter.match(/\d+ phòng họp/)?.[0] ?? '');
await card.getByRole('button', { name: 'Đóng' }).click();
await hr.waitForTimeout(800);
console.log('ảnh:', await shot(hr, 's2-card-with-four-rooms'));

// ─── S3: văn phòng thứ hai, phòng hiện đúng thẻ ───────────────────────────────
await clearToasts(hr);
await hr.getByRole('button', { name: 'Thêm văn phòng' }).first().click();
await hr.waitForTimeout(1000);
await hr.locator('input[placeholder*="Văn phòng Hữu Nghị"]').first().fill(SITE_SECOND);
await hr.getByRole('button', { name: 'Lưu', exact: true }).first().click();
await toastText(hr, 20000);
await hr.waitForTimeout(2500);
const secondId = ((await api(hrToken, '/v1/office/sites', {})).json?.data ?? []).find(s => s.name === SITE_SECOND)?.id;
const secondCard = hr.locator(`#site-card-${secondId}`);
await secondCard.getByRole('button', { name: 'Thêm phòng họp' }).click();
await hr.waitForTimeout(1000);
await secondCard.locator('input[placeholder*="Phòng họp tầng 3"]').first().fill(ROOM_NAMES[0]);
await clearToasts(hr);
await secondCard.getByRole('button', { name: /^Lưu/ }).first().click();
const sameNameToast = await toastText(hr, 20000);
line(
	new RegExp(`Đã lưu phòng họp ${ROOM_NAMES[0]}`).test(sameNameToast),
	'S5 cùng tên phòng ở văn phòng KHÁC thì lưu được',
	sameNameToast,
);
await hr.waitForTimeout(2000);
const secondText = (await secondCard.innerText()).replace(/\s+/g, ' ');
const mainText = (await hr.locator(`#site-card-${siteId}`).innerText()).replace(/\s+/g, ' ');
line(
	secondText.includes('1 phòng họp') && mainText.includes('4 phòng họp'),
	'S3 phòng của mỗi văn phòng nằm đúng thẻ của nó',
	`${SITE_SECOND}: ${secondText.match(/\d+ phòng họp/)?.[0]}, ${SITE_MAIN}: ${mainText.match(/\d+ phòng họp/)?.[0]}`,
);
console.log('ảnh:', await shot(hr, 's3-two-cards'));

// ─── S5: trùng tên phòng TRONG CÙNG văn phòng ─────────────────────────────────
await secondCard.locator('input[placeholder*="Phòng họp tầng 3"]').first().fill(ROOM_NAMES[0]);
await clearToasts(hr);
await secondCard.getByRole('button', { name: /^Lưu/ }).first().click();
await hr.waitForTimeout(2500);
const dupRoomText = (await secondCard.innerText()).replace(/\s+/g, ' ');
line(
	/đã có phòng họp tên|đã có phòng/i.test(dupRoomText),
	'S5 trùng tên phòng trong cùng văn phòng thì báo ngay dưới ô Tên',
	dupRoomText.match(/[^.]*đã có phòng[^.]*\./)?.[0]?.slice(0, 140) ?? dupRoomText.slice(0, 140),
);
console.log('ảnh:', await shot(hr, 's5-duplicate-room-name'));
await secondCard.getByRole('button', { name: 'Đóng' }).click();
await hr.waitForTimeout(600);

// ─── S4: trùng tên văn phòng ──────────────────────────────────────────────────
await clearToasts(hr);
await hr.getByRole('button', { name: 'Thêm văn phòng' }).first().click();
await hr.waitForTimeout(1000);
await hr.locator('input[placeholder*="Văn phòng Hữu Nghị"]').first().fill(SITE_MAIN);
await hr.locator('input[placeholder*="Lý Thường Kiệt"]').first().fill('Tầng 4 - Phòng 1');
await hr.getByRole('button', { name: 'Lưu', exact: true }).first().click();
await hr.waitForTimeout(3000);
const dupSiteText = (await text(hr)).replace(/\s+/g, ' ');
line(
	/đã có/i.test(dupSiteText),
	'S4 trùng tên văn phòng thì báo ngay dưới ô Tên',
	dupSiteText.match(/[^.]*Tên văn phòng[^.]*\./)?.[0]?.slice(0, 120) ?? '',
);
line(
	dupSiteText.includes(`Bạn bấm "Thêm phòng họp" trong thẻ ${SITE_MAIN}`),
	'S4 câu gợi ý chỉ đúng việc cần làm: thêm phòng vào thẻ của văn phòng đã có',
	dupSiteText.match(/Văn phòng này đã có[^.]*\./)?.[0]?.slice(0, 180) ?? '',
);
const highlighted = await hr.locator(`#site-card-${siteId}[class*="border-brand-500"]`).count();
line(highlighted > 0, 'S4 thẻ của văn phòng đó được tô sáng', `${highlighted} thẻ được tô`);
console.log('ảnh:', await shot(hr, 's4-duplicate-site-name'));
await hr.getByRole('button', { name: 'Đóng' }).first().click();
await hr.waitForTimeout(600);

// ─── S6: sửa phòng ────────────────────────────────────────────────────────────
const mainCard = hr.locator(`#site-card-${siteId}`);
await roomRow(mainCard, ROOM_NAMES[1]).getByRole('button', { name: 'Sửa' }).click();
await hr.waitForTimeout(1200);
await mainCard.locator('input[role="spinbutton"]').first().fill('8');
await mainCard.locator('input[placeholder*="Máy chiếu"]').first().fill('Màn hình TV');
await clearToasts(hr);
await mainCard.getByRole('button', { name: 'Lưu', exact: true }).first().click();
const editToast = await toastText(hr, 20000);
line(new RegExp(`Đã lưu phòng họp ${ROOM_NAMES[1]}`).test(editToast), 'S6 sửa được sức chứa và thiết bị', editToast);
await hr.waitForTimeout(2000);
const editedText = (await mainCard.innerText()).replace(/\s+/g, ' ');
line(
	editedText.includes('8 người') && editedText.includes('Màn hình TV'),
	'S6 thẻ hiện lại sức chứa và thiết bị mới',
	editedText.match(/8 người · [^·]{0,30}/)?.[0] ?? '',
);
console.log('ảnh:', await shot(hr, 's6-room-edited'));

// ─── S7: ngừng phòng còn lượt, rồi ngừng phòng không còn lượt ─────────────────
const roomsOfSite = ((await api(hrToken, `/v1/office/rooms?siteId=${siteId}`)).json?.data ?? []).filter(r => r.isActive);
const bookedRoom = roomsOfSite[0];
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const booking = await api(await apiToken(WHO.employeeA1.email), '/v1/office/room-bookings', {
	method: 'POST',
	body: JSON.stringify({
		roomId: bookedRoom.id,
		startAt: `${tomorrow}T09:00:00.000+07:00`,
		endAt: `${tomorrow}T10:00:00.000+07:00`,
		title: 'Họp thử để chặn ngừng phòng',
	}),
});
line(booking.status < 400, 'S7 dựng được một lượt sắp tới ở phòng đầu', `status ${booking.status}`);

await go(hr, '/management/office/settings', 4000);
const card7 = hr.locator(`#site-card-${siteId}`);
await clearToasts(hr);
await roomRow(card7, bookedRoom.name).getByRole('button', { name: 'Ngừng dùng' }).click();
const blockedToast = await toastText(hr, 20000);
line(
	/còn \d+ lượt|lượt đặt sắp tới/i.test(blockedToast),
	'S7 ngừng phòng còn lượt thì hiện câu 409 của máy chủ',
	blockedToast,
);
console.log('ảnh:', await shot(hr, 's7-room-has-bookings'));

const freeRoom = roomsOfSite.find(r => r.id !== bookedRoom.id);
await clearToasts(hr);
await roomRow(card7, freeRoom.name).getByRole('button', { name: 'Ngừng dùng' }).click();
const stoppedToast = await toastText(hr, 20000);
line(new RegExp(`Đã ngừng dùng phòng ${freeRoom.name}`).test(stoppedToast), 'S7 ngừng được phòng không còn lượt', stoppedToast);
await hr.waitForTimeout(2000);
const stoppedRow = roomRow(card7, freeRoom.name);
line(
	(await stoppedRow.getAttribute('class'))?.includes('opacity-60') ?? false,
	'S7 phòng ngừng dùng hiện mờ trong thẻ',
	await stoppedRow.getAttribute('class'),
);
await clearToasts(hr);
await roomRow(card7, freeRoom.name).getByRole('button', { name: 'Dùng lại' }).click();
const reusedToast = await toastText(hr, 20000);
line(new RegExp(`Đã dùng lại phòng ${freeRoom.name}`).test(reusedToast), 'S7 dùng lại được phòng đã ngừng', reusedToast);
console.log('ảnh:', await shot(hr, 's7-room-stopped-and-reused'));

// ─── S8: ngừng văn phòng còn lượt ─────────────────────────────────────────────
await hr.waitForTimeout(1500);
await clearToasts(hr);
await siteHeader(hr.locator(`#site-card-${siteId}`)).getByRole('button', { name: 'Ngừng dùng' }).click();
await hr.waitForTimeout(500);
const siteBlockedToast = await toastText(hr, 20000);
line(
	/còn \d+ lượt|lượt đặt sắp tới/i.test(siteBlockedToast),
	'S8 ngừng văn phòng còn lượt thì hiện câu 409',
	siteBlockedToast,
);
console.log('ảnh:', await shot(hr, 's8-site-has-bookings'));

// ─── S9: điện thoại 390×844 ───────────────────────────────────────────────────
const phone = await signIn(browser, WHO.hr.email, { phone: true });
await go(phone, '/management/office/settings', 4500);
const phoneCard = phone.locator(`#site-card-${siteId}`);
await phoneCard.scrollIntoViewIfNeeded();
line(
	(await phone.evaluate(() => document.documentElement.scrollWidth)) <= 391,
	'S9 điện thoại: trang không tràn ngang',
	`scrollWidth ${await phone.evaluate(() => document.documentElement.scrollWidth)}`,
);
await phoneCard.getByRole('button', { name: 'Thêm phòng họp' }).click();
await phone.waitForTimeout(1200);
line(
	(await phone.evaluate(() => document.documentElement.scrollWidth)) <= 391,
	'S9 điện thoại: form trong thẻ cũng không tràn ngang',
);
const phoneInputs = await phoneCard.locator('input[placeholder*="Phòng họp tầng 3"]').first().boundingBox();
line(
	!!phoneInputs && phoneInputs.width >= 200,
	'S9 điện thoại: ô Tên phòng rộng rãi, không bị co',
	phoneInputs ? `rộng ${Math.round(phoneInputs.width)}px` : 'không thấy ô',
);
console.log('ảnh:', await shot(phone, 's9-phone-card-and-form'));

// ─── S11: nhân viên thường vẫn bị chặn ────────────────────────────────────────
const employee = await signIn(browser, WHO.employeeA1.email);
await go(employee, '/management/office/settings', 4000);
line(
	!employee.url().includes('/management/office/settings'),
	'S11 nhân viên gõ thẳng đường dẫn thì bị đưa đi chỗ khác',
	employee.url(),
);
console.log('ảnh:', await shot(employee, 's11-employee-blocked'));

for (const [name, page] of [
	['HCNS', hr],
	['điện thoại', phone],
	['nhân viên', employee],
]) {
	line(page.errors.length === 0, `S1..S11 không có lỗi JavaScript (${name})`, page.errors.slice(0, 2).join(' | '));
	console.log(`response 4xx của ${name}:`, [...new Set(page.apiErrors)].join(' | ') || 'không có');
}

console.log(`văn phòng của bài: ${siteId} (${SITE_MAIN}) và ${secondId} (${SITE_SECOND})`);
await browser.close();
process.exit(summary() ? 1 : 0);
