/**
 * FE-30 tới FE-33: phần phòng họp của đợt sửa sau UAT.
 *
 * Ngừng phòng còn lượt sắp tới, lượt riêng tư nhìn từ phía HCNS (Q3), đổi chủ trì và bớt người
 * dự, và lượt đang diễn ra (kéo dài, kết thúc sớm) rồi lượt đã kết thúc.
 *
 * Dữ liệu nền (một lượt riêng tư của giám đốc, một lượt đang diễn ra) dựng bằng API cho nhanh và
 * chắc; mọi thao tác cần kiểm thì bấm thật trên giao diện.
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

const hrToken = await apiToken(WHO.hr.email);
const sites = await api(hrToken, '/v1/office/sites');
const site = sites.json?.data?.find(s => s.name.includes('Hữu Nghị'));
const rooms = await api(hrToken, `/v1/office/rooms?siteId=${site.id}`);
const room3 = rooms.json?.data?.find(r => r.name.includes('tầng 3'));
const room5 = rooms.json?.data?.find(r => r.name.includes('tầng 5'));
if (!room3 || !room5) throw new Error('chưa có hai phòng họp — chạy smoke-settings.mjs trước');

/**
 * Ngày bài dùng để đặt phòng.
 *
 * Sandbox giữ lượt của mọi lần chạy trước nên một ngày có thể kín dần; bài tự tìm ngày còn đủ chỗ
 * thay vì cắm cứng "ngày kia".
 */
let DAY = daysFromNow(2);

/** Giờ còn trống của một phòng trong một ngày; `null` khi kín. */
async function freeHourOn(day, roomId, from = 8) {
	const grid = await api(hrToken, `/v1/office/room-bookings?siteId=${site.id}&date=${ymd(day)}`);
	const row = grid.json?.data?.rooms?.find(r => r.room.id === roomId);
	const busy = new Set();
	for (const booking of row?.bookings ?? []) {
		if (booking.status === 'CANCELLED') continue;
		const start = (new Date(booking.startAt).getUTCHours() + 7) % 24;
		const end = (new Date(booking.endAt).getUTCHours() + 7) % 24;
		for (let hour = start; hour < Math.max(end, start + 1); hour++) busy.add(hour);
	}
	for (let hour = from; hour <= 18; hour++) if (!busy.has(hour)) return hour;
	return null;
}

async function pickDay() {
	for (let offset = 2; offset <= 8; offset++) {
		const day = daysFromNow(offset);
		const [early5, late5, early3] = await Promise.all([
			freeHourOn(day, room5.id, 9),
			freeHourOn(day, room5.id, 14),
			freeHourOn(day, room3.id, 8),
		]);
		if (early5 != null && late5 != null && early3 != null && early5 + 2 <= 18) return day;
	}
	throw new Error('tám ngày tới đều không còn đủ chỗ trống ở hai phòng');
}

DAY = await pickDay();
console.log(`bài dùng ngày ${ymd(DAY)}`);

async function freeHour(roomId, from = 8) {
	const hour = await freeHourOn(DAY, roomId, from);
	if (hour == null) throw new Error(`phòng ${roomId} kín ngày ${ymd(DAY)} từ ${from} giờ`);
	return hour;
}

function isoAt(date, hour, minute = 0) {
	return `${ymd(date)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+07:00`;
}

const browser = await launch();
const hr = await signIn(browser, WHO.hr.email);

// ─── FE-30: ngừng phòng còn lượt đặt sắp tới ─────────────────────────────────
const upcoming = await api(hrToken, `/v1/office/room-bookings?siteId=${site.id}&date=${ymd(DAY)}`);
const room3Row = upcoming.json?.data?.rooms?.find(r => r.room.id === room3.id);
if (!(room3Row?.bookings ?? []).some(b => b.status !== 'CANCELLED')) {
	const hour = await freeHour(room3.id);
	const seeded = await api(hrToken, '/v1/office/room-bookings', {
		method: 'POST',
		body: JSON.stringify({
			roomId: room3.id,
			startAt: isoAt(DAY, hour),
			endAt: isoAt(DAY, hour + 1),
			title: 'Họp kiểm tra phòng',
		}),
	});
	line(seeded.status === 201, 'FE-30 dựng sẵn một lượt sắp tới ở phòng tầng 3', `${seeded.status}`);
}

await go(hr, '/management/office/settings');
await hr.getByRole('button', { name: 'Phòng họp' }).first().click();
await hr.waitForTimeout(2500);
await clearToasts(hr);
const roomRow = hr.locator('tr', { hasText: room3.name }).first();
await roomRow.getByRole('button', { name: 'Sửa' }).click();
await hr.waitForTimeout(1200);
const roomForm = hr.locator('div.rounded-xl', { hasText: `Sửa phòng ${room3.name}` }).last();
await roomForm.locator('label', { hasText: 'Đang dùng' }).locator('input[type="checkbox"]').uncheck();
await hr.waitForTimeout(300);
await hr.getByRole('button', { name: 'Lưu', exact: true }).first().click();
const stopToast = await toastText(hr, 20000);
line(
	/lượt đặt sắp tới|còn \d+ lượt/i.test(stopToast),
	'FE-30 ngừng phòng còn lượt sắp tới thì bị chặn kèm số lượt',
	stopToast,
);
console.log('ảnh:', await shot(hr, 'fe-30-room-has-bookings'));

// Ngừng cả văn phòng cũng phải bị chặn vì nó kéo theo mọi phòng.
await hr.getByRole('button', { name: 'Văn phòng', exact: true }).first().click();
await hr.waitForTimeout(2000);
await clearToasts(hr);
const siteRow = hr.locator('tr', { hasText: site.name }).first();
await siteRow.getByRole('button', { name: 'Sửa' }).click();
await hr.waitForTimeout(1200);
const siteForm = hr.locator('div.rounded-xl', { hasText: `Sửa văn phòng ${site.name}` }).last();
await siteForm.locator('label', { hasText: 'Đang dùng' }).locator('input[type="checkbox"]').uncheck();
await hr.waitForTimeout(300);
await hr.getByRole('button', { name: 'Lưu', exact: true }).first().click();
const stopSiteToast = await toastText(hr, 20000);
line(
	/lượt đặt sắp tới|còn \d+ lượt/i.test(stopSiteToast),
	'FE-30 ngừng văn phòng còn lượt sắp tới cũng bị chặn',
	stopSiteToast,
);
console.log('ảnh:', await shot(hr, 'fe-30-site-has-bookings'));

// ─── FE-31: lượt riêng tư của giám đốc nhìn từ HCNS ──────────────────────────
const dirToken = await apiToken(WHO.director.email);
const privateHour = await freeHour(room5.id, 9);
const createdPrivate = await api(dirToken, '/v1/office/room-bookings', {
	method: 'POST',
	body: JSON.stringify({
		roomId: room5.id,
		startAt: isoAt(DAY, privateHour),
		endAt: isoAt(DAY, privateHour + 1),
		title: 'Họp kín ban giám đốc',
		isPrivate: true,
	}),
});
line(createdPrivate.status === 201, 'FE-31 dựng lượt riêng tư của giám đốc', `${createdPrivate.status}`);

await go(hr, '/office/rooms');
await hr.waitForTimeout(3000);
const dateInput = hr.locator('input[placeholder="dd/mm/yyyy"]').first();
await dateInput.fill(viDate(DAY));
await dateInput.press('Enter');
await hr.waitForTimeout(3000);
// Đọc cả chữ trên màn LẪN nhãn `title` của từng thanh: tiêu đề lượt riêng tư không được lọt ra ở
// chỗ nào, mà từ UAT đợt C thanh một giờ chỉ in giờ nên `title` mới là chỗ chứa câu đầy đủ.
const hrBarTitles = [];
for (const bar of await hr.locator('button[title]').all()) {
	hrBarTitles.push((await bar.getAttribute('title')) ?? '');
}
const hrGrid = `${await text(hr)} | ${hrBarTitles.join(' | ')}`;
line(
	!/Họp kín ban giám đốc/.test(hrGrid),
	'FE-31 HCNS không thấy tiêu đề lượt riêng tư trên lịch phòng',
	hrBarTitles.filter(t => /Đã có người đặt/.test(t)).join(' | ').slice(0, 120),
);
console.log('ảnh:', await shot(hr, 'fe-31-private-grid'));

// Thanh lượt một giờ chỉ in giờ bắt đầu (UAT đợt C), nên tìm theo `title` chứ không theo chữ.
const privateBar = hr.locator('button[title*="Đã có người đặt"]').first();
await privateBar.click();
await hr.waitForTimeout(1800);
const privateBox = dialog(hr, 'Đã có người đặt');
const privateBoxText = (await privateBox.innerText()).replace(/\s+/g, ' ');
line(
	/lượt riêng tư/i.test(privateBoxText) && !/Họp kín ban giám đốc/.test(privateBoxText),
	'FE-31 hộp chi tiết nói rõ là lượt riêng tư và không có tiêu đề',
	privateBoxText.slice(0, 140),
);
console.log('ảnh:', await shot(hr, 'fe-31-private-detail'));

await privateBox.getByRole('button', { name: 'Sửa, dời giờ' }).click();
await hr.waitForTimeout(2000);
const editBox = dialog(hr, 'Sửa lượt họp');
const editText = (await editBox.innerText()).replace(/\s+/g, ' ');
const titleInputs = await editBox.locator('input[maxlength="200"]').count();
const peopleInputs = await editBox.locator('input[placeholder*="người dự"]').count();
line(
	titleInputs === 0 && peopleInputs === 0,
	'FE-31 form sửa lượt riêng tư không có ô tiêu đề và người dự',
	`${titleInputs} ô tiêu đề, ${peopleInputs} ô người dự`,
);
line(
	/không xem được nội dung/i.test(editText),
	'FE-31 form nói rõ vì sao chỉ sửa được phòng và giờ',
	editText.match(/Đây là lượt riêng tư[^.]*\./)?.[0] ?? '',
);
console.log('ảnh:', await shot(hr, 'fe-31-private-edit-form'));

// Dời sang một giờ còn trống thật, nếu không sẽ dính lỗi trùng giờ của lượt khác.
const moveHour = await freeHour(room5.id, privateHour + 2);
await setTime(editBox, hr, 0, `${String(moveHour).padStart(2, '0')}:00`);
await setTime(editBox, hr, 1, `${String(moveHour + 1).padStart(2, '0')}:00`);
await clearToasts(hr);
await editBox.getByRole('button', { name: 'Lưu lượt họp' }).click();
const moveToast = await toastText(hr, 20000);
line(/Đã lưu lượt họp/.test(moveToast), 'FE-31 HCNS dời được giờ của lượt riêng tư', moveToast);
await hr.waitForTimeout(2500);

await hr.locator('button[title*="Đã có người đặt"]').first().click();
await hr.waitForTimeout(1800);
const cancelBox = dialog(hr, 'Đã có người đặt');
await cancelBox.getByRole('button', { name: 'Huỷ lượt' }).click();
await hr.waitForTimeout(700);
await clearToasts(hr);
await cancelBox.getByRole('button', { name: 'Xác nhận huỷ' }).click();
await hr.waitForTimeout(1500);
const cancelError = (await cancelBox.locator('p.text-red-500').first().innerText().catch(() => '')).trim();
line(/ghi lý do/i.test(cancelError), 'FE-31 huỷ lượt riêng tư của người khác vẫn bắt ghi lý do', cancelError);
await cancelBox.locator('input[maxlength="500"]').first().fill('Phòng dùng cho họp đột xuất của công ty');
await hr.waitForTimeout(300);
await clearToasts(hr);
await cancelBox.getByRole('button', { name: 'Xác nhận huỷ' }).click();
const cancelToast = await toastText(hr, 20000);
line(/Đã huỷ lượt họp/.test(cancelToast), 'FE-31 có lý do thì HCNS huỷ được lượt riêng tư', cancelToast);
console.log('ảnh:', await shot(hr, 'fe-31-private-cancelled'));

// ─── FE-32: đặt hộ, đổi chủ trì, bớt người dự ────────────────────────────────
const a2 = await signIn(browser, WHO.employeeA2.email);
await go(a2, '/office/rooms');
await a2.waitForTimeout(3000);
const a2Date = a2.locator('input[placeholder="dd/mm/yyyy"]').first();
await a2Date.fill(viDate(DAY));
await a2Date.press('Enter');
await a2.waitForTimeout(3000);

const meetingHour = await freeHour(room5.id, 14);
// Tiêu đề mang giờ đặt để lần chạy sau không bấm nhầm vào lượt của lần trước.
const MEETING_TITLE = `Họp kế hoạch quý ${meetingHour} giờ`;
const slot = a2
	.locator('div.flex.items-stretch', { hasText: room5.name })
	.first()
	.locator(`button[aria-label*="từ ${String(meetingHour).padStart(2, '0')} giờ"]`)
	.first();
await slot.click();
await a2.waitForTimeout(1800);
const bookBox = dialog(a2, 'Đặt phòng họp');
await bookBox.locator('input[maxlength="200"]').first().fill(MEETING_TITLE);
await bookBox.locator('input[placeholder*="đặt hộ"]').first().fill(WHO.director.fullName);
await a2.waitForTimeout(1000);
await bookBox.getByRole('button', { name: new RegExp(WHO.director.fullName) }).first().click();
await a2.waitForTimeout(600);
for (const person of [WHO.managerA.fullName, WHO.managerB.fullName]) {
	await bookBox.locator('input[placeholder*="mời người dự"]').first().fill(person);
	await a2.waitForTimeout(1000);
	await bookBox.getByRole('button', { name: new RegExp(person) }).first().click();
	await a2.waitForTimeout(600);
}
await clearToasts(a2);
await bookBox.getByRole('button', { name: 'Đặt phòng', exact: true }).click();
const proxyToast = await toastText(a2, 20000);
line(/Đã đặt/.test(proxyToast), 'FE-32 thư ký đặt hộ giám đốc và mời hai trưởng phòng', proxyToast);
await a2.waitForTimeout(2500);
console.log('ảnh:', await shot(a2, 'fe-32-booked'));

// Sửa: đổi chủ trì sang MGRA, bớt MGRB.
await a2.locator(`button[title*="${MEETING_TITLE}"]`).first().click();
await a2.waitForTimeout(1800);
const detailBox = dialog(a2, MEETING_TITLE);
await detailBox.getByRole('button', { name: 'Sửa, dời giờ' }).click();
await a2.waitForTimeout(2000);
const editMeeting = dialog(a2, 'Sửa lượt họp');
// Ô chủ trì chọn một người, nên chọn người mới là thay luôn người cũ, không cần bỏ chọn trước.
await editMeeting.locator('input[placeholder*="chủ trì mới"]').first().fill(WHO.managerA.fullName);
await a2.waitForTimeout(1000);
await editMeeting.getByRole('button', { name: new RegExp(WHO.managerA.fullName) }).first().click();
await a2.waitForTimeout(600);
await editMeeting.getByRole('button', { name: `Bỏ chọn ${WHO.managerB.fullName}` }).click();
await a2.waitForTimeout(500);
await clearToasts(a2);
await editMeeting.getByRole('button', { name: 'Lưu lượt họp' }).click();
const editToast = await toastText(a2, 20000);
line(/Đã lưu lượt họp/.test(editToast), 'FE-32 đổi chủ trì và bớt một người dự', editToast);
await a2.waitForTimeout(2500);
console.log('ảnh:', await shot(a2, 'fe-32-edited'));

/** Câu thông báo mới nhất về phòng họp của một người. */
async function latestBookingNotice(email) {
	const token = await apiToken(email);
	const res = await api(token, '/v1/notifications?page=1&limit=10');
	const item = (res.json?.data ?? []).find(n => String(n.type).startsWith('OFFICE_ROOM_BOOKING'));
	return item ? `${item.title} — ${item.message ?? item.body ?? ''}` : '';
}

const dirNotice = await latestBookingNotice(WHO.director.email);
const mgraNotice = await latestBookingNotice(WHO.managerA.email);
const mgrbNotice = await latestBookingNotice(WHO.managerB.email);
line(/chủ trì/i.test(dirNotice), 'FE-32 chủ trì cũ nhận câu về việc thôi chủ trì', dirNotice.slice(0, 160));
line(/chủ trì/i.test(mgraNotice), 'FE-32 chủ trì mới nhận câu được giao chủ trì', mgraNotice.slice(0, 160));
line(
	/không còn|bỏ khỏi|huỷ/i.test(mgrbNotice),
	'FE-32 người bị bớt nhận câu không còn trong danh sách',
	mgrbNotice.slice(0, 160),
);

const dir = await signIn(browser, WHO.director.email);
await go(dir, '/management');
await dir.locator('button[title="Thông báo"]').first().click();
await dir.waitForTimeout(2500);
console.log('ảnh:', await shot(dir, 'fe-32-director-bell'));

// ─── FE-33: lượt đang diễn ra và lượt đã kết thúc ────────────────────────────
const a1 = await signIn(browser, WHO.employeeA1.email);
await go(a1, '/office/rooms');
await a1.waitForTimeout(3000);

/** Giờ Việt Nam lúc này, làm tròn xuống mốc 5 phút (ô chọn giờ đi theo bước 5 phút). */
function vnNowParts() {
	const vn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
	return { hour: vn.getHours(), minute: vn.getMinutes() };
}

const now = vnNowParts();
const startMinute = Math.floor(now.minute / 5) * 5;
const startHhmm = `${String(now.hour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`;
const endMinutes = now.hour * 60 + startMinute + 15;
const endHhmm = `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
let QUICK_TITLE = `Họp nhanh đang diễn ra ${startHhmm}`;
console.log(`lượt đang diễn ra: ${startHhmm} tới ${endHhmm} (giờ Việt Nam)`);

/**
 * Lượt đang diễn ra của lần chạy trước (nếu có) thì dùng lại.
 *
 * Đặt lượt mới chồng giờ với lượt cũ của chính mình sẽ bị máy chủ từ chối, mà bài vẫn cần một
 * lượt ĐANG diễn ra để thử kéo dài và kết thúc sớm.
 */
const todayGrid = await api(hrToken, `/v1/office/room-bookings?siteId=${site.id}&date=${ymd(new Date())}`);
const runningNow = (todayGrid.json?.data?.rooms ?? [])
	.flatMap(r => r.bookings)
	.find(
		b =>
			b.status !== 'CANCELLED' &&
			String(b.title ?? '').startsWith('Họp nhanh đang diễn ra') &&
			new Date(b.startAt).getTime() <= Date.now() &&
			new Date(b.endAt).getTime() > Date.now() + 60_000,
	);

if (runningNow) {
	QUICK_TITLE = runningNow.title;
	line(true, 'FE-33 đặt được lượt bắt đầu ngay lúc này', `dùng lại lượt "${QUICK_TITLE}" của lần chạy trước`);
} else {
// Dùng nút "Đặt phòng" chứ không bấm ô giờ: lịch chỉ vẽ 7 giờ tới 20 giờ, mà bài này có thể chạy
// vào buổi tối, lúc đó không có ô nào để bấm.
/**
 * Đặt lượt "ngay lúc này" qua giao diện, thử lần lượt từng phòng.
 *
 * Sandbox dùng chung nên khung giờ này có thể đã bị lượt của bài khác chiếm; từ UAT đợt B, trùng
 * giờ GIỮ hộp mở với câu lỗi trong hộp (không còn toast), nên bài đổi phòng ngay trong hộp đó.
 */
const roomChoices = [room3, ...(rooms.json?.data ?? []).filter(r => r.isActive && r.id !== room3.id)];
await a1.getByRole('button', { name: 'Đặt phòng', exact: true }).first().click();
await a1.waitForTimeout(1800);
const nowBox = dialog(a1, 'Đặt phòng họp');
await nowBox.locator('input[maxlength="200"]').first().fill(QUICK_TITLE);
await setTime(nowBox, a1, 0, startHhmm);
await setTime(nowBox, a1, 1, endHhmm);

let nowToast = '';
for (const room of roomChoices) {
	await nowBox.locator('button[id^="ui-select"]').first().click();
	await a1.waitForTimeout(400);
	// UAT đợt B: nhãn phòng trong ô chọn nay kèm sức chứa và thiết bị ("… · 12 người · Máy chiếu"),
	// nên khớp một phần tên thay vì khớp đúng cả nhãn.
	await a1
		.getByRole('button', { name: new RegExp(room.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
		.last()
		.evaluate(el => el.click());
	await a1.waitForTimeout(400);
	await clearToasts(a1);
	await nowBox.getByRole('button', { name: 'Đặt phòng', exact: true }).click();
	nowToast = await toastText(a1, 20000);
	if (/Đã đặt/.test(nowToast)) {
		console.log(`đặt được ở ${room.name}`);
		break;
	}
	const inlineError = (await nowBox.innerText()).replace(/\s+/g, ' ');
	console.log(`phòng ${room.name} không đặt được: ${inlineError.match(/Phòng[^.]*\./)?.[0] ?? inlineError.slice(0, 120)}`);
}
line(/Đã đặt/.test(nowToast), 'FE-33 đặt được lượt bắt đầu ngay lúc này', nowToast);
await a1.waitForTimeout(2500);
}

// Kéo dài thêm 30 phút.
// UAT đợt B: thanh ngắn không in tiêu đề bên trong nữa (bề rộng đúng thời lượng), nên tìm theo
// `title` của thanh — đó cũng là câu người dùng thấy khi rê chuột hoặc chạm.
await a1.locator(`button[title*="${QUICK_TITLE}"]`).first().click();
await a1.waitForTimeout(1800);
let nowDetail = dialog(a1, QUICK_TITLE);
await nowDetail.getByRole('button', { name: 'Sửa, dời giờ' }).click();
await a1.waitForTimeout(2000);
const nowEdit = dialog(a1, 'Sửa lượt họp');
const nowEditText = (await nowEdit.innerText()).replace(/\s+/g, ' ');
line(
	/đang diễn ra nên giờ bắt đầu giữ nguyên/.test(nowEditText),
	'FE-33 lượt đang diễn ra khoá giờ bắt đầu và nói rõ vì sao',
	nowEditText.match(/Cuộc họp đang diễn ra[^.]*\./)?.[0] ?? '',
);
// Hộp đặt phòng làm việc trong MỘT ngày, nên không kéo dài qua nửa đêm được: chạy lúc gần nửa
// đêm thì kéo tới 23:55 là hết cỡ.
const longerMinutes = Math.min(endMinutes + 30, 23 * 60 + 55);
const longerHhmm = `${String(Math.floor(longerMinutes / 60) % 24).padStart(2, '0')}:${String(longerMinutes % 60).padStart(2, '0')}`;
await setTime(nowEdit, a1, 1, longerHhmm);
await clearToasts(a1);
await nowEdit.getByRole('button', { name: 'Lưu lượt họp' }).click();
const longerToast = await toastText(a1, 20000);
line(/Đã lưu lượt họp/.test(longerToast), `FE-33 kéo dài lượt đang diễn ra tới ${longerHhmm}`, longerToast);
await a1.waitForTimeout(2500);
console.log('ảnh:', await shot(a1, 'fe-33-extended'));

// Kết thúc sớm: mốc 5 phút kế tiếp còn ở tương lai.
const after = vnNowParts();
const earlyMinutes = (Math.floor((after.hour * 60 + after.minute) / 5) + 1) * 5;
const earlyHhmm = `${String(Math.floor(earlyMinutes / 60) % 24).padStart(2, '0')}:${String(earlyMinutes % 60).padStart(2, '0')}`;
await a1.locator(`button[title*="${QUICK_TITLE}"]`).first().click();
await a1.waitForTimeout(1800);
nowDetail = dialog(a1, QUICK_TITLE);
await nowDetail.getByRole('button', { name: 'Sửa, dời giờ' }).click();
await a1.waitForTimeout(2000);
const earlyEdit = dialog(a1, 'Sửa lượt họp');
await setTime(earlyEdit, a1, 1, earlyHhmm);
await clearToasts(a1);
await earlyEdit.getByRole('button', { name: 'Lưu lượt họp' }).click();
const earlyToast = await toastText(a1, 20000);
line(/Đã lưu lượt họp/.test(earlyToast), `FE-33 kết thúc sớm lượt đang diễn ra lúc ${earlyHhmm}`, earlyToast);
await a1.waitForTimeout(2500);
console.log('ảnh:', await shot(a1, 'fe-33-ended-early'));

// Chờ qua giờ kết thúc rồi xem lượt đã kết thúc.
const waitMs = Math.max(0, new Date(`${ymd(new Date())}T${earlyHhmm}:30+07:00`).getTime() - Date.now()) + 5000;
console.log(`chờ ${Math.round(waitMs / 1000)} giây cho lượt kết thúc…`);
await a1.waitForTimeout(waitMs);
await go(a1, '/office/rooms', 4000);
await a1.locator(`button[title*="${QUICK_TITLE}"]`).first().click();
await a1.waitForTimeout(2000);
const endedBox = dialog(a1, QUICK_TITLE);
const endedButtons = await endedBox.getByRole('button', { name: /Sửa, dời giờ|Huỷ lượt/ }).count();
line(endedButtons === 0, 'FE-33 lượt đã kết thúc thì không còn nút sửa hay huỷ', `${endedButtons} nút`);
console.log('ảnh:', await shot(a1, 'fe-33-ended'));

for (const [name, page] of [
	['HR01', hr],
	['EMPA2', a2],
	['EMPA1', a1],
	['DIR01', dir],
]) {
	line(page.errors.length === 0, `FE-30..FE-33 không có lỗi JavaScript (${name})`, page.errors.slice(0, 2).join(' | '));
	console.log(`response 4xx của ${name}:`, [...new Set(page.apiErrors)].join(' | ') || 'không có');
}

await browser.close();
process.exit(summary() ? 1 : 0);
