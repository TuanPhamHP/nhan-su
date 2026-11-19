/**
 * FE-35, FE-41, FE-42, FE-43, FE-49: phòng họp sau UAT đợt B.
 *
 * Lỗi nặng của đợt này là hộp "Sửa lượt họp" điền ô Ngày bằng hôm nay, nên chỉ đổi giờ rồi Lưu là
 * cuộc họp nhảy sang hôm nay và người dự nhận thông báo ghi sai ngày. FE-35 dựng đúng tình huống
 * đó bằng một lượt của NGÀY MAI, rồi chỉ sửa giờ kết thúc.
 */
import {
	WHO,
	api,
	apiToken,
	clearToasts,
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
} from './helper.mjs';

const hrToken = await apiToken(WHO.hr.email);
const a1Token = await apiToken(WHO.employeeA1.email);

const sites = (await api(hrToken, '/v1/office/sites')).json?.data ?? [];
const site = sites[0];
if (!site) throw new Error('sandbox chưa có văn phòng — chạy smoke-settings.mjs trước');

const rooms = ((await api(hrToken, '/v1/office/rooms')).json?.data ?? []).filter(
	r => r.officeSiteId === site.id && r.isActive,
);
if (rooms.length < 2) throw new Error('cần ít nhất hai phòng họp đang dùng');
console.log(`bài dùng văn phòng ${site.name}, phòng ${rooms.map(r => r.name).join(', ')}`);

/**
 * Ngày và giờ theo GIỜ VIỆT NAM, không theo giờ của máy.
 *
 * Máy chạy bài đặt múi giờ UTC, nên `new Date().getHours()` lệch bảy tiếng so với giờ mà máy chủ
 * và người dùng đang dùng: lấy giờ máy rồi dựng lượt "đang diễn ra" sẽ ra một lượt đã qua, và máy
 * chủ từ chối với câu "Không đặt được giờ đã qua".
 */
const VN_PARTS = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'Asia/Ho_Chi_Minh',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
});

/** `HH:mm` giờ Việt Nam của một mốc ISO. */
function vnTimeOf(iso) {
	const parts = Object.fromEntries(VN_PARTS.formatToParts(new Date(iso)).map(p => [p.type, p.value]));
	return `${parts.hour}:${parts.minute}`;
}

function vnNow() {
	const parts = Object.fromEntries(VN_PARTS.formatToParts(new Date()).map(p => [p.type, p.value]));
	return {
		date: `${parts.year}-${parts.month}-${parts.day}`,
		hour: Number(parts.hour) % 24,
		minute: Number(parts.minute),
	};
}

/** Ngày mai theo giờ Việt Nam, dạng `YYYY-MM-DD`. Đi qua mốc giữa trưa nên không lệch ngày. */
function vnTomorrow() {
	const noonToday = new Date(`${vnNow().date}T12:00:00+07:00`);
	noonToday.setUTCDate(noonToday.getUTCDate() + 1);
	const parts = Object.fromEntries(VN_PARTS.formatToParts(noonToday).map(p => [p.type, p.value]));
	return `${parts.year}-${parts.month}-${parts.day}`;
}

const tomorrow = vnTomorrow();

/** Giờ ISO có múi giờ Việt Nam, như hợp đồng yêu cầu. */
function vnIso(dateYmd, hhmm) {
	return `${dateYmd}T${hhmm}:00.000+07:00`;
}

async function createBooking(token, body) {
	const res = await api(token, '/v1/office/room-bookings', { method: 'POST', body: JSON.stringify(body) });
	if (res.status >= 400) throw new Error(`không dựng được lượt: ${res.status} ${res.text.slice(0, 200)}`);
	return res.json.data;
}

/**
 * Dựng lượt, tự tránh lượt cũ còn sót của những lần chạy trước.
 *
 * Sandbox dùng chung cho nhiều bài nên phòng và giờ hay bị chiếm; gặp trùng giờ thì đổi phòng,
 * hết phòng thì dịch giờ, thay vì để cả bài gãy vì một lượt rác.
 */
async function createBookingSomewhere(token, { startHhmm, endHhmm, dateYmd, title, shiftMinutes = 20 }) {
	let start = startHhmm;
	let end = endHhmm;
	for (let attempt = 0; attempt < 6; attempt++) {
		for (const room of rooms) {
			const res = await api(token, '/v1/office/room-bookings', {
				method: 'POST',
				body: JSON.stringify({ roomId: room.id, startAt: vnIso(dateYmd, start), endAt: vnIso(dateYmd, end), title }),
			});
			if (res.status < 400) return res.json.data;
			if (res.json?.error?.code !== 'OFFICE_ROOM_BOOKING_CONFLICT') {
				throw new Error(`không dựng được lượt: ${res.status} ${res.text.slice(0, 200)}`);
			}
		}
		start = addMinutes(start, shiftMinutes);
		end = addMinutes(end, shiftMinutes);
	}
	throw new Error('không tìm được phòng và giờ còn trống để dựng lượt');
}

/** Cộng phút vào `HH:mm`, chặn ở 23:55 để không nhảy sang ngày khác. */
function addMinutes(hhmm, minutes) {
	const [h, m] = hhmm.split(':').map(Number);
	const total = Math.min(h * 60 + m + minutes, 23 * 60 + 55);
	return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Dọn lượt cũ của ngày mai để giờ trong bài không trùng lượt của lần chạy trước. */
async function clearTomorrow() {
	for (const token of [hrToken]) {
		const grid = await api(token, `/v1/office/room-bookings?siteId=${site.id}&date=${tomorrow}`);
		for (const row of grid.json?.data?.rooms ?? []) {
			for (const booking of row.bookings) {
				if (booking.status === 'CANCELLED') continue;
				await api(token, `/v1/office/room-bookings/${booking.id}/cancel`, {
					method: 'POST',
					body: JSON.stringify({ reason: 'Dọn dữ liệu bài bấm thử' }),
				});
			}
		}
	}
}

await clearTomorrow();

// Lượt của ngày mai do chính EMPA1 đặt, để họ sửa được.
const booking = await createBooking(a1Token, {
	roomId: rooms[0].id,
	startAt: vnIso(tomorrow, '09:00'),
	endAt: vnIso(tomorrow, '10:00'),
	title: 'Họp chốt số liệu quý',
	attendeeIds: [WHO.employeeA2.id].filter(Boolean),
});
console.log(`lượt ngày mai: ${booking.id} ${tomorrow} 09:00–10:00`);

const browser = await launch();

// ─── FE-35: sửa lượt ngày mai, chỉ đổi giờ kết thúc ───────────────────────────
const a1 = await signIn(browser, WHO.employeeA1.email);
await go(a1, `/office/rooms?booking_id=${booking.id}`, 4000);
const detail = dialog(a1, 'Họp chốt số liệu quý');
line((await detail.count()) > 0, 'FE-35 link thông báo mở đúng hộp chi tiết lượt ngày mai');
await detail.getByRole('button', { name: 'Sửa, dời giờ' }).first().click();
await a1.waitForTimeout(1500);

const form = dialog(a1, 'Sửa lượt họp');
const dateBox = form.locator('input[inputmode="numeric"]').first();
const dateShown = await dateBox.inputValue();
const expected = `${tomorrow.slice(8, 10)}/${tomorrow.slice(5, 7)}/${tomorrow.slice(0, 4)}`;
line(dateShown === expected, 'FE-35 ô Ngày điền NGÀY CỦA LƯỢT, không phải hôm nay', `ô ghi ${dateShown}, cần ${expected}`);
console.log('ảnh:', await shot(a1, 'fe-35-edit-keeps-date'));

await clearToasts(a1);
await setTime(form, a1, 1, '11:00');
await form.getByRole('button', { name: 'Lưu lượt họp' }).first().click();
const savedToast = await toastText(a1, 15000);
line(/Đã lưu lượt họp/.test(savedToast), 'FE-35 lưu được lượt sau khi chỉ đổi giờ kết thúc', savedToast);
line(
	savedToast.includes(`ngày ${expected}`),
	'FE-35 toast nói cả NGÀY, nên người dùng thấy ngay lượt còn ở đúng ngày',
	savedToast,
);

const after = (await api(a1Token, `/v1/office/room-bookings/${booking.id}`)).json?.data;
line(
	after?.startAt?.slice(0, 10) === tomorrow || new Date(after.startAt).toISOString().slice(0, 10) === tomorrow,
	'FE-35 máy chủ vẫn giữ lượt ở ngày mai, không dời về hôm nay',
	`startAt ${after?.startAt}`,
);
line(
	new Date(after.endAt).getTime() - new Date(after.startAt).getTime() === 2 * 60 * 60 * 1000,
	'FE-35 giờ kết thúc đã đổi thành 11:00 (lượt dài hai giờ)',
	`${after?.startAt} → ${after?.endAt}`,
);
console.log('ảnh:', await shot(a1, 'fe-35-after-save'));

// ─── FE-41: trùng một phần lượt của mình, rồi trùng lượt người khác ───────────
await go(a1, '/office/rooms', 3500);
await a1.locator('input[inputmode="numeric"]').first().fill(expected);
await a1.waitForTimeout(2500);

await clearToasts(a1);
await a1.getByRole('button', { name: 'Đặt phòng', exact: true }).first().click();
await a1.waitForTimeout(1500);
const createForm = dialog(a1, 'Đặt phòng họp');
await createForm.locator('input[inputmode="numeric"]').first().fill(expected);
await a1.waitForTimeout(600);
await createForm.locator('input[type="text"]:not([inputmode="numeric"])').first().fill('Họp nhóm kỹ thuật');
// Phòng đang có lượt 09:00–11:00 của chính EMPA1: đặt 10:00–12:00 là trùng một phần.
await setTime(createForm, a1, 0, '10:00');
await setTime(createForm, a1, 1, '12:00');
await createForm.getByRole('button', { name: 'Đặt phòng', exact: true }).last().click();
await a1.waitForTimeout(3000);

const stillOpen = (await dialog(a1, 'Đặt phòng họp').count()) > 0;
line(stillOpen, 'FE-41 trùng giờ thì HỘP VẪN MỞ, không tự đóng mất dữ liệu đã gõ');
const keptTitle = await dialog(a1, 'Đặt phòng họp')
	.locator('input[type="text"]:not([inputmode="numeric"])')
	.first()
	.inputValue()
	.catch(() => '');
line(keptTitle === 'Họp nhóm kỹ thuật', 'FE-41 tiêu đề đã gõ còn nguyên trong hộp', `ô ghi "${keptTitle}"`);
const formText = await dialog(a1, 'Đặt phòng họp').innerText();
line(
	/đã có lượt của bạn lúc|đã đặt phòng này/i.test(formText.replace(/\s+/g, ' ')),
	'FE-41 câu trùng giờ của máy chủ hiện ngay trong hộp, ở chỗ ô giờ',
	formText.replace(/\s+/g, ' ').match(/Phòng[^.]*\./)?.[0]?.slice(0, 160) ?? '',
);
console.log('ảnh:', await shot(a1, 'fe-41-conflict-keeps-form'));

// Đổi sang giờ trống thì đặt được ngay trong cùng hộp, không phải mở lại.
await setTime(dialog(a1, 'Đặt phòng họp'), a1, 0, '13:00');
await setTime(dialog(a1, 'Đặt phòng họp'), a1, 1, '14:00');
await clearToasts(a1);
await dialog(a1, 'Đặt phòng họp').getByRole('button', { name: 'Đặt phòng', exact: true }).last().click();
const okToast = await toastText(a1, 15000);
line(/Đã đặt/.test(okToast), 'FE-41 sửa giờ trong cùng hộp là đặt được, khỏi gõ lại từ đầu', okToast);

// ─── FE-42: lượt 10 phút và lượt 30 phút nối nhau ─────────────────────────────
const short = await createBooking(hrToken, {
	roomId: rooms[1].id,
	startAt: vnIso(tomorrow, '15:00'),
	endAt: vnIso(tomorrow, '15:10'),
	title: 'Trao đổi nhanh',
});
const halfA = await createBooking(hrToken, {
	roomId: rooms[1].id,
	startAt: vnIso(tomorrow, '16:00'),
	endAt: vnIso(tomorrow, '16:30'),
	title: 'Họp nửa tiếng đầu',
});
const halfB = await createBooking(hrToken, {
	roomId: rooms[1].id,
	startAt: vnIso(tomorrow, '16:30'),
	endAt: vnIso(tomorrow, '17:00'),
	title: 'Họp nửa tiếng sau',
});
console.log(`lượt ngắn: ${short.id} 10 phút, ${halfA.id} và ${halfB.id} nửa tiếng nối nhau`);

await go(a1, '/office/rooms', 3500);
await a1.locator('input[inputmode="numeric"]').first().fill(expected);
await a1.waitForTimeout(3000);

/** Hình chữ nhật của thanh một lượt trên lịch, đọc từ chính trình duyệt. */
async function barBox(page, title) {
	const bar = page.locator(`button[title*="${title}"]`).first();
	if (!(await bar.count())) return null;
	return bar.boundingBox();
}

const boxA = await barBox(a1, 'Họp nửa tiếng đầu');
const boxB = await barBox(a1, 'Họp nửa tiếng sau');
line(!!boxA && !!boxB, 'FE-42 hai lượt nửa tiếng nối nhau đều có thanh trên lịch');
if (boxA && boxB) {
	const overlap = boxA.x + boxA.width - boxB.x;
	line(
		overlap <= 1,
		'FE-42 thanh nửa tiếng KHÔNG vẽ đè sang lượt kế tiếp',
		`mép phải ${Math.round(boxA.x + boxA.width)}, mép trái lượt sau ${Math.round(boxB.x)}`,
	);
}
const boxShort = await barBox(a1, 'Trao đổi nhanh');
line(!!boxShort, 'FE-42 lượt mười phút vẫn có thanh trên lịch', boxShort ? `rộng ${Math.round(boxShort.width)}px` : '');
if (boxShort) {
	await a1.locator('button[title*="Trao đổi nhanh"]').first().click();
	await a1.waitForTimeout(1500);
	line(
		(await dialog(a1, 'Trao đổi nhanh').count()) > 0,
		'FE-42 lượt mười phút vẫn bấm được, mở ra hộp chi tiết',
	);
	await a1.keyboard.press('Escape');
	await a1.waitForTimeout(600);
}
console.log('ảnh:', await shot(a1, 'fe-42-short-bars-desktop'));

// Điện thoại: cột tên phòng dính mép trái khi cuộn ngang.
const phone = await signIn(browser, WHO.employeeA1.email, { phone: true });
await go(phone, '/office/rooms', 4000);
await phone.locator('input[inputmode="numeric"]').first().fill(expected);
await phone.waitForTimeout(3000);
const nameCell = phone.locator('p', { hasText: rooms[1].name }).first();
const beforeScroll = await nameCell.boundingBox();
await phone.evaluate(() => {
	const box = document.querySelector('div.overflow-x-auto');
	if (box) box.scrollLeft = 400;
});
await phone.waitForTimeout(800);
const afterScroll = await nameCell.boundingBox();
line(
	!!beforeScroll && !!afterScroll && Math.abs(beforeScroll.x - afterScroll.x) <= 2,
	'FE-42 điện thoại: cột tên phòng dính mép trái khi cuộn ngang',
	`x trước ${Math.round(beforeScroll?.x ?? -1)}, x sau ${Math.round(afterScroll?.x ?? -1)}`,
);
line(
	(await phone.evaluate(() => document.documentElement.scrollWidth)) <= 391,
	'FE-42 điện thoại: lịch cuộn trong khung, trang không tràn ngang',
	`scrollWidth ${await phone.evaluate(() => document.documentElement.scrollWidth)}`,
);
console.log('ảnh:', await shot(phone, 'fe-42-sticky-room-column-phone'));

// ─── FE-43: Lịch của tôi có lượt đã qua, đang họp, sắp tới ─────────────────────
const today = vnNow().date;
const nowHour = vnNow().hour;
// Lượt "đang họp" chỉ dựng được bằng cách đặt từ mốc năm phút kế tiếp rồi CHỜ tới giờ đó: máy
// chủ không cho đặt lượt bắt đầu trong quá khứ (trễ quá năm phút).
if (nowHour <= 22) {
	const pad = n => String(n).padStart(2, '0');
	const startMinutes = (Math.floor((nowHour * 60 + vnNow().minute) / 5) + 1) * 5;
	const endMinutes = Math.min(startMinutes + 15, 23 * 60 + 55);
	const startHhmm = `${pad(Math.floor(startMinutes / 60) % 24)}:${pad(startMinutes % 60)}`;
	const endHhmm = `${pad(Math.floor(endMinutes / 60) % 24)}:${pad(endMinutes % 60)}`;
	const ongoing = await createBookingSomewhere(a1Token, {
		dateYmd: today,
		startHhmm,
		endHhmm,
		title: 'Cuộc họp của Lịch của tôi',
		shiftMinutes: 5,
	});
	console.log(`lượt sẽ đang họp: ${ongoing.id} ${vnTimeOf(ongoing.startAt)}–${vnTimeOf(ongoing.endAt)} (giờ Việt Nam)`);

	const waitMs = Math.max(0, new Date(ongoing.startAt).getTime() - Date.now()) + 20000;
	console.log(`chờ ${Math.round(waitMs / 1000)} giây cho lượt bắt đầu…`);
	await a1.waitForTimeout(waitMs);

	await go(a1, '/office/rooms', 3500);
	await a1.getByRole('button', { name: 'Lịch của tôi' }).first().click();
	await a1.waitForTimeout(3500);
	const mineText = await text(a1);
	line(/Đang họp/.test(mineText), 'FE-43 lượt đang diễn ra mang nhãn "Đang họp"', mineText.match(/Đang họp/)?.[0] ?? '');
	line(/Đã đặt/.test(mineText), 'FE-43 lượt sắp tới mang nhãn "Đã đặt"');
	const badges = await a1.locator('span.rounded-full').allInnerTexts();
	const order = badges.map(b => b.trim()).filter(b => /Đã đặt|Đang họp|Đã kết thúc|Đã huỷ/.test(b));
	const endedAt = order.indexOf('Đã kết thúc');
	line(
		endedAt === -1 || order.slice(endedAt).every(b => b === 'Đã kết thúc' || b === 'Đã huỷ'),
		'FE-43 lượt đã kết thúc xếp sau các lượt còn tới',
		order.join(' | '),
	);
	if (endedAt === -1) console.log('chưa có lượt nào đã kết thúc trong bảy ngày tới của người này');
	console.log('ảnh:', await shot(a1, 'fe-43-my-bookings-timing'));
} else {
	line(true, 'FE-43 bỏ qua vì gần nửa đêm, không dựng được lượt trong ngày', `giờ Việt Nam ${nowHour}`);
}

// ─── F-49: nút "Đặt phòng" điền giờ nằm trong lịch ────────────────────────────
await go(a1, '/office/rooms', 3500);
await clearToasts(a1);
await a1.getByRole('button', { name: 'Đặt phòng', exact: true }).first().click();
await a1.waitForTimeout(1500);
const defaultForm = dialog(a1, 'Đặt phòng họp');
const startShown = await defaultForm.locator('button.font-mono').first().innerText();
const startHour = Number(startShown.trim().slice(0, 2));
// Khung lịch tự nới theo lượt có thật, nên so với khung ĐANG VẼ chứ không so với 7–20 cứng.
const rangeText = (await text(a1)).match(/Lịch hiện từ (\d+) giờ tới (\d+) giờ/);
const rangeStart = Number(rangeText?.[1] ?? 7);
const rangeEnd = Number(rangeText?.[2] ?? 20);
line(
	startHour >= rangeStart && startHour < rangeEnd,
	'F-49 nút Đặt phòng điền giờ nằm trong khung lịch đang vẽ, không ra ngoài',
	`giờ điền sẵn ${startShown.trim()}, lịch vẽ ${rangeStart}–${rangeEnd} giờ`,
);
console.log('ảnh:', await shot(a1, 'f-49-default-hour'));
await a1.keyboard.press('Escape');

for (const [name, page] of [
	['EMPA1', a1],
	['điện thoại', phone],
]) {
	line(page.errors.length === 0, `FE-35..FE-49 không có lỗi JavaScript (${name})`, page.errors.slice(0, 2).join(' | '));
	console.log(`response 4xx của ${name}:`, [...new Set(page.apiErrors)].join(' | ') || 'không có');
}

await browser.close();
process.exit(summary() ? 1 : 0);
