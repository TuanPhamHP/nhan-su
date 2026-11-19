/**
 * FE-14 tới FE-18: đặt phòng họp, trùng giờ, liền kề, lượt riêng tư, đặt hộ, sửa, huỷ và các giới
 * hạn giờ.
 *
 * Lưới mặc định là hôm nay, nhưng bài chạy vào bất cứ giờ nào trong ngày nên khung giờ của hôm
 * nay có thể đã qua — và máy chủ từ chối đúng như vậy. Vì thế bài kiểm câu "Trống đến…" trên lưới
 * HÔM NAY rồi chuyển lưới sang NGÀY MAI để đặt, nhờ đó kết quả không phụ thuộc lúc chạy.
 */
import {
	WHO,
	api,
	apiToken,
	clearToasts,
	daysFromNow,
	dialog,
	go,
	launch,
	line,
	setTime,
	shot,
	signIn,
	summary,
	text,
	toastText,
	viDate,
	ymd,
} from './helper.mjs';

/**
 * Ngày bài dùng để đặt phòng.
 *
 * Mặc định là ngày mai, nhưng sandbox giữ lượt của những lần chạy trước nên lưới có thể kín dần;
 * lúc đó bài lùi sang ngày tiếp theo thay vì gãy.
 */
let TOMORROW = daysFromNow(1);

/**
 * Chọn giờ còn trống ở CẢ hai phòng cho bài chạy.
 *
 * Sandbox giữ lượt đã đặt giữa các lần chạy, mà thanh lượt họp che ô giờ của nó (đúng như người
 * dùng thật: ô đã có người thì bấm vào là mở chi tiết, không đặt được), nên bài phải tự tìm ba
 * giờ liền nhau còn trống thay vì cắm cứng 9 giờ.
 */
async function busyHours(roomName) {
	const token = await apiToken(WHO.hr.email);
	const sites = await api(token, '/v1/office/sites');
	const siteId = sites.json?.data?.find(s => s.name.includes('Hữu Nghị'))?.id;
	const grid = await api(token, `/v1/office/room-bookings?siteId=${siteId}&date=${ymd(TOMORROW)}`);
	const busy = new Set();
	for (const row of grid.json?.data?.rooms ?? []) {
		if (roomName && row.room.name !== roomName) continue;
		for (const booking of row.bookings) {
			if (booking.status === 'CANCELLED') continue;
			// Giờ Việt Nam bằng giờ UTC cộng 7, và lượt của bài luôn nằm trong một ngày.
			const from = (new Date(booking.startAt).getUTCHours() + 7) % 24;
			const to = (new Date(booking.endAt).getUTCHours() + 7) % 24;
			for (let hour = from; hour < Math.max(to, from + 1); hour++) busy.add(hour);
		}
	}
	return busy;
}

async function pickFreeHours() {
	for (let offset = 1; offset <= 7; offset++) {
		TOMORROW = daysFromNow(offset);
		const busy = await busyHours(null);
		for (let hour = 9; hour <= 16; hour++) {
			if (!busy.has(hour - 1) && !busy.has(hour) && !busy.has(hour + 1)) return hour;
		}
	}
	throw new Error('bảy ngày tới đều không còn ba giờ liền nhau trống ở cả hai phòng');
}

/** Một giờ còn trống của đúng một phòng, để mở hộp đặt mà không bị thanh lượt họp che. */
async function freeHourOf(roomName) {
	const busy = await busyHours(roomName);
	for (let hour = 8; hour <= 18; hour++) if (!busy.has(hour)) return hour;
	throw new Error(`phòng ${roomName} kín cả ngày ${ymd(TOMORROW)}`);
}

const HOUR_A = await pickFreeHours();
const HOUR_B = HOUR_A + 1;
console.log(`giờ dùng cho bài: ${HOUR_A}:00 và ${HOUR_B}:00 ngày ${ymd(TOMORROW)}`);

const browser = await launch();

/** Đưa lưới về một ngày: ô ngày của trang là `UiDatePicker` đầu tiên trên màn. */
async function setGridDate(page, date) {
	const input = page.locator('input[placeholder="dd/mm/yyyy"]').first();
	await input.fill(viDate(date));
	await input.press('Enter');
	await page.waitForTimeout(2500);
}

/**
 * Nhãn đầy đủ của mọi thanh lượt trên lịch, đọc từ `title`.
 *
 * Từ UAT đợt C, thanh một giờ chỉ in GIỜ BẮT ĐẦU bên trong (in tiêu đề vào bốn mươi pixel chỉ ra
 * "Giao ba…"), còn câu đầy đủ nằm ở `title` và ở hộp chi tiết. Vậy nên kiểm tiêu đề lượt thì phải
 * đọc `title`, không đọc chữ trên màn.
 */
async function barLabels(page) {
	const bars = await page.locator('button[title]').all();
	const labels = [];
	for (const bar of bars) labels.push((await bar.getAttribute('title')) ?? '');
	return labels.join(' | ');
}

/** Mở hộp đặt phòng bằng cách bấm đúng ô giờ của một phòng trên lưới. */
async function clickSlot(page, roomName, hour) {
	const row = page.locator('div.flex.items-stretch', { hasText: roomName }).first();
	const slot = row.locator(`button[aria-label*="từ ${String(hour).padStart(2, '0')} giờ"]`).first();
	await slot.scrollIntoViewIfNeeded();
	await slot.click();
	await page.waitForTimeout(1800);
	return dialog(page, 'Đặt phòng họp');
}

async function fillBooking(box, page, { title, start, end, date, isPrivate = false }) {
	await box.locator('input[maxlength="200"]').first().fill(title);
	if (date) {
		const input = box.locator('input[placeholder="dd/mm/yyyy"]').first();
		await input.fill(viDate(date));
		await input.press('Enter');
		await page.waitForTimeout(400);
	}
	if (start) await setTime(box, page, 0, start);
	if (end) await setTime(box, page, 1, end);
	if (isPrivate) {
		await box.locator('input[type="checkbox"]').last().check();
		await page.waitForTimeout(200);
	}
}

/**
 * Bấm Đặt phòng rồi trả về cả câu toast và câu lỗi ở ô giờ, để bài tự xét.
 *
 * Đọc toast NGAY sau cú bấm: toast tự tắt sau vài giây, nên chờ xong rồi mới đọc thì có lúc bắt
 * được, có lúc không — đúng kiểu bài thử lúc xanh lúc đỏ mà không ai hiểu vì sao.
 */
async function submitBooking(box, page) {
	await clearToasts(page);
	await box.getByRole('button', { name: 'Đặt phòng', exact: true }).click();
	const toast = await toastText(page, 15000);
	await page.waitForTimeout(1500);
	const error = (await box.locator('p.text-red-500').first().innerText().catch(() => '')).trim();
	return { error, toast };
}

/** Chọn một người trong ô chọn người (`EmployeePicker`). */
async function pickPerson(box, page, placeholderPart, fullName) {
	const input = box.locator(`input[placeholder*="${placeholderPart}"]`).first();
	await input.fill(fullName);
	await page.waitForTimeout(1000);
	await box.getByRole('button', { name: new RegExp(fullName) }).first().click();
	await page.waitForTimeout(600);
}

// ─── FE-14: đặt phòng, trùng giờ, liền kề ─────────────────────────────────────
const a1 = await signIn(browser, WHO.employeeA1.email);
await go(a1, '/office/rooms');
await a1.waitForTimeout(3000);
const todayGrid = await text(a1);
line(
	/Phòng họp tầng 3/.test(todayGrid),
	'FE-14 lưới hiện phòng của văn phòng đã chọn',
	todayGrid.match(/Phòng họp tầng \d/g)?.join(', ') ?? '',
);
line(
	/Trống đến|Trống cả ngày|Đang họp tới/.test(todayGrid),
	'FE-14 lưới hôm nay nói trạng thái phòng lúc này',
	todayGrid.match(/(Trống đến|Trống cả ngày|Đang họp tới)[^P]{0,16}/)?.[0]?.trim() ?? '',
);
console.log('ảnh:', await shot(a1, 'fe-14-grid-today'));

await setGridDate(a1, TOMORROW);
let box = await clickSlot(a1, 'Phòng họp tầng 3', HOUR_A);
await fillBooking(box, a1, { title: 'Họp giao ban phòng A' });
const booked = await submitBooking(box, a1);
line(/Đã đặt Phòng họp tầng 3/.test(booked.toast), 'FE-14 EMPA1 đặt được phòng', booked.toast || booked.error);
await a1.waitForTimeout(2000);
const afterBook = await text(a1);
line(/Họp giao ban phòng A/.test(await barLabels(a1)), 'FE-14 lượt vừa đặt hiện trên lưới');
console.log('ảnh:', await shot(a1, 'fe-14-booked'));

const b1 = await signIn(browser, WHO.employeeB1.email);
await go(b1, '/office/rooms');
await b1.waitForTimeout(3000);
await setGridDate(b1, TOMORROW);
// Ô giờ đã có lượt thì bị thanh lượt họp che, nên bấm vào đó là mở chi tiết lượt chứ không đặt
// được — đúng như người dùng thật gặp. Vì vậy mở hộp từ ô 08 giờ rồi đổi giờ bắt đầu sang 09 giờ
// để tạo đúng tình huống trùng giờ.
box = await clickSlot(b1, 'Phòng họp tầng 3', HOUR_A - 1);
await fillBooking(box, b1, {
	title: 'Họp phòng B trùng giờ',
	start: `${String(HOUR_A).padStart(2, '0')}:00`,
});
const conflict = await submitBooking(box, b1);
// UAT đợt B: trùng giờ KHÔNG còn đóng hộp và toast nữa; câu của máy chủ hiện ngay trong hộp, ở
// chỗ ô giờ, để người dùng sửa giờ mà không mất tiêu đề và người dự đã gõ.
line(
	new RegExp(`đã có người đặt|trùng|đã được|${WHO.employeeA1.fullName}`, 'i').test(
		`${conflict.error} ${conflict.toast}`,
	),
	'FE-14 đặt trùng giờ bị chặn, câu lỗi nêu người đã đặt',
	conflict.error || conflict.toast,
);
line(
	(await dialog(b1, 'Đặt phòng họp').count()) > 0,
	'FE-14 hộp đặt phòng vẫn mở sau khi trùng giờ, không mất dữ liệu đã gõ',
);
await b1.waitForTimeout(1500);
console.log('ảnh:', await shot(b1, 'fe-14-conflict'));

// Đóng hộp để các bước sau còn bấm được ô giờ trên lưới.
await dialog(b1, 'Đặt phòng họp').getByRole('button', { name: 'Đóng', exact: true }).first().click();
await b1.waitForTimeout(2500);
const b1AfterConflict = await text(b1);
line(
	/Họp giao ban phòng A/.test(await barLabels(b1)),
	'FE-14 lưới tải lại nên thấy lượt đang giữ phòng',
);

box = await clickSlot(b1, 'Phòng họp tầng 3', HOUR_B);
await fillBooking(box, b1, { title: 'Họp phòng B liền kề' });
const adjacent = await submitBooking(box, b1);
line(/Đã đặt Phòng họp tầng 3/.test(adjacent.toast), 'FE-14 đặt liền kề thì được', adjacent.toast || adjacent.error);
await b1.waitForTimeout(2000);
console.log('ảnh:', await shot(b1, 'fe-14-adjacent'));

// ─── FE-15: lượt riêng tư ─────────────────────────────────────────────────────
box = await clickSlot(a1, 'Phòng họp tầng 5', HOUR_A);
await fillBooking(box, a1, { title: 'Họp kín về lương', isPrivate: true });
await pickPerson(box, a1, 'mời người dự', WHO.employeeB1.fullName);
const privateBooked = await submitBooking(box, a1);
line(
	/Đã đặt Phòng họp tầng 5/.test(privateBooked.toast),
	'FE-15 đặt được lượt riêng tư có mời người dự',
	privateBooked.toast || privateBooked.error,
);
await a1.waitForTimeout(2000);
console.log('ảnh:', await shot(a1, 'fe-15-private-owner'));

const c1 = await signIn(browser, WHO.employeeC1.email);
await go(c1, '/office/rooms');
await c1.waitForTimeout(3000);
await setGridDate(c1, TOMORROW);
const c1Text = await barLabels(c1);
line(
	/Đã có người đặt/.test(c1Text) && !/Họp kín về lương/.test(c1Text),
	'FE-15 người không liên quan thấy khung bận mà không thấy tiêu đề',
	c1Text.match(/Đã có người đặt[^P]{0,40}/)?.[0]?.trim() ?? '',
);
line(
	new RegExp(WHO.employeeA1.fullName).test(c1Text),
	'FE-15 người không liên quan vẫn thấy tên người đặt',
	c1Text.slice(0, 160),
);
console.log('ảnh:', await shot(c1, 'fe-15-private-other'));

// Tải lại trang chứ không gán lại cùng một ngày: ngày không đổi thì trang không gọi lại API, nên
// lượt vừa tạo ở tab khác sẽ không xuất hiện.
await go(b1, '/office/rooms');
await b1.waitForTimeout(3000);
await setGridDate(b1, TOMORROW);
const b1Private = await barLabels(b1);
line(/Họp kín về lương/.test(b1Private), 'FE-15 người được mời thấy tiêu đề lượt riêng tư', b1Private.slice(0, 160));
console.log('ảnh:', await shot(b1, 'fe-15-private-invited'));

const hr = await signIn(browser, WHO.hr.email);
await go(hr, '/office/rooms');
await hr.waitForTimeout(3000);
await setGridDate(hr, TOMORROW);
const hrPrivate = await barLabels(hr);
// Từ đợt sửa sau UAT (Q3): HCNS cũng KHÔNG đọc được nội dung lượt riêng tư, chỉ thấy khung bận.
line(
	!/Họp kín về lương/.test(hrPrivate) && /Đã có người đặt/.test(hrPrivate),
	'FE-15 người quản lý phòng họp cũng không thấy tiêu đề lượt riêng tư',
	hrPrivate.match(/Đã có người đặt[^P]{0,30}/)?.[0]?.trim() ?? '',
);
console.log('ảnh:', await shot(hr, 'fe-15-private-hr'));

// ─── FE-16: EMPA2 đặt hộ giám đốc ─────────────────────────────────────────────
const a2 = await signIn(browser, WHO.employeeA2.email);
await go(a2, '/office/rooms');
await a2.waitForTimeout(3000);
await setGridDate(a2, TOMORROW);
box = await clickSlot(a2, 'Phòng họp tầng 5', HOUR_B);
await fillBooking(box, a2, { title: 'Họp ban giám đốc' });
await pickPerson(box, a2, 'đặt hộ', WHO.director.fullName);
await pickPerson(box, a2, 'mời người dự', WHO.managerA.fullName);
const proxyBooked = await submitBooking(box, a2);
line(
	/Đã đặt Phòng họp tầng 5/.test(proxyBooked.toast),
	'FE-16 thư ký đặt hộ được cho giám đốc',
	proxyBooked.toast || proxyBooked.error,
);
await a2.waitForTimeout(2000);
console.log('ảnh:', await shot(a2, 'fe-16-proxy-booking'));

const dir = await signIn(browser, WHO.director.email);
await go(dir, '/office/rooms');
await dir.waitForTimeout(3000);
await dir.getByRole('button', { name: 'Lịch của tôi' }).first().click();
await dir.waitForTimeout(3000);
const dirMine = await text(dir);
line(
	/Họp ban giám đốc/.test(dirMine),
	'FE-16 giám đốc thấy lượt trong Lịch của tôi',
	dirMine.match(/Họp ban giám đốc[^C]{0,60}/)?.[0]?.trim() ?? '',
);
console.log('ảnh:', await shot(dir, 'fe-16-director-mine'));

// Lịch của tôi giữ cả lượt đã huỷ của lần chạy trước, nên phải chọn lượt còn hiệu lực.
await dir
	.locator('button', { hasText: 'Họp ban giám đốc' })
	.filter({ hasNotText: 'Đã huỷ' })
	.first()
	.click();
await dir.waitForTimeout(1800);
const dirBox = dialog(dir, 'Họp ban giám đốc');
await dirBox.getByRole('button', { name: 'Huỷ lượt' }).click();
await dir.waitForTimeout(800);
const dirHint = (await dirBox.innerText()).replace(/\s+/g, ' ');
line(
	/lý do không bắt buộc/.test(dirHint),
	'FE-16 chủ trì tự huỷ thì lý do không bắt buộc',
	dirHint.match(/Lượt này của bạn[^.]*/)?.[0] ?? '',
);
await clearToasts(dir);
await dirBox.getByRole('button', { name: 'Xác nhận huỷ' }).click();
const dirCancel = await toastText(dir, 20000);
line(/Đã huỷ lượt họp/.test(dirCancel), 'FE-16 chủ trì huỷ được lượt của mình không cần lý do', dirCancel);
await dir.waitForTimeout(2000);
console.log('ảnh:', await shot(dir, 'fe-16-director-cancel'));

// ─── FE-17: người ngoài không sửa được, HR huỷ phải có lý do ───────────────────
await b1.locator('button[title*="Họp giao ban phòng A"]').first().click();
await b1.waitForTimeout(1800);
const b1Box = dialog(b1, 'Họp giao ban phòng A');
const b1Edit = await b1Box.getByRole('button', { name: 'Sửa, dời giờ' }).count();
const b1Cancel = await b1Box.getByRole('button', { name: 'Huỷ lượt' }).count();
line(
	b1Edit === 0 && b1Cancel === 0,
	'FE-17 người ngoài không có nút sửa hay huỷ',
	`${b1Edit} nút sửa, ${b1Cancel} nút huỷ`,
);
console.log('ảnh:', await shot(b1, 'fe-17-no-edit'));
await b1Box.getByRole('button', { name: 'Đóng', exact: true }).first().click();
await b1.waitForTimeout(600);

await hr.locator('button[title*="Họp giao ban phòng A"]').first().click();
await hr.waitForTimeout(1800);
const hrBox = dialog(hr, 'Họp giao ban phòng A');
await hrBox.getByRole('button', { name: 'Huỷ lượt' }).click();
await hr.waitForTimeout(700);
await clearToasts(hr);
await hrBox.getByRole('button', { name: 'Xác nhận huỷ' }).click();
await hr.waitForTimeout(1500);
const hrReasonError = (await hrBox.locator('p.text-red-500').first().innerText().catch(() => '')).trim();
line(/ghi lý do/i.test(hrReasonError), 'FE-17 HR huỷ lượt người khác mà thiếu lý do thì bị chặn', hrReasonError);
console.log('ảnh:', await shot(hr, 'fe-17-reason-required'));

await hrBox.locator('input[maxlength="500"]').first().fill('Phòng dùng cho họp ban giám đốc');
await hr.waitForTimeout(300);
await clearToasts(hr);
await hrBox.getByRole('button', { name: 'Xác nhận huỷ' }).click();
const hrCancel = await toastText(hr, 20000);
line(/Đã huỷ lượt họp/.test(hrCancel), 'FE-17 có lý do thì HR huỷ được lượt của người khác', hrCancel);
await hr.waitForTimeout(2000);
console.log('ảnh:', await shot(hr, 'fe-17-cancelled'));

// ─── FE-18: ba giới hạn giờ ───────────────────────────────────────────────────
const TIME_CASES = [
	{
		name: 'FE-18 đặt giờ đã qua thì lỗi hiện ở ô giờ bằng câu của máy chủ',
		shotName: 'fe-18-past-time',
		fill: { title: 'Họp giờ đã qua', date: daysFromNow(-1), start: '08:00', end: '09:00' },
	},
	{
		name: 'FE-18 lượt dài quá 12 giờ thì lỗi hiện ở ô giờ',
		shotName: 'fe-18-too-long',
		fill: { title: 'Họp cả ngày', date: daysFromNow(2), start: '08:00', end: '21:00' },
	},
	{
		name: 'FE-18 đặt quá 180 ngày tới thì lỗi hiện ở ô giờ',
		shotName: 'fe-18-too-far',
		fill: { title: 'Họp sang năm', date: daysFromNow(200), start: '09:00', end: '10:00' },
	},
];

// Mở hộp từ một ô còn trống của phòng tầng 3; bài này đổi ngày giờ ngay trong hộp nên ô nào cũng được.
const freeHour = await freeHourOf('Phòng họp tầng 3');

for (const testCase of TIME_CASES) {
	const caseBox = await clickSlot(a1, 'Phòng họp tầng 3', freeHour);
	await fillBooking(caseBox, a1, testCase.fill);
	const { error, toast } = await submitBooking(caseBox, a1);
	line(error.length > 0, testCase.name, error || `không thấy lỗi ở ô giờ, toast: ${toast}`);
	console.log('ảnh:', await shot(a1, testCase.shotName));
	await caseBox.getByRole('button', { name: 'Đóng', exact: true }).first().click();
	await a1.waitForTimeout(800);
}

for (const [name, page] of [
	['EMPA1', a1],
	['EMPA2', a2],
	['EMPB1', b1],
	['EMPC1', c1],
	['DIR01', dir],
	['HR01', hr],
]) {
	line(page.errors.length === 0, `FE-14..FE-18 không có lỗi JavaScript (${name})`, page.errors.slice(0, 2).join(' | '));
	console.log(`response 4xx của ${name}:`, [...new Set(page.apiErrors)].join(' | ') || 'không có');
}

await browser.close();
process.exit(summary() ? 1 : 0);
