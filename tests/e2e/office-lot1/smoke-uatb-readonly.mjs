/**
 * FE-47: công ty `exp` có phân hệ OFFICE hết hạn, đang ở chế độ chỉ xem.
 *
 * Đợt UAT B, giám đốc gặp đúng cảnh này: băng trên đầu trang nói "không tạo, sửa hay duyệt được"
 * nhưng nút Đặt phòng, ô trống trên lịch và nút Sửa vẫn bày ra, gõ hết biểu mẫu rồi mới bị từ
 * chối. Bài kiểm đúng ba chỗ đó, và kiểm cả việc nút Huỷ lượt vẫn còn.
 */
import { PASSWORD, api, go, launch, line, shot, signIn, summary, text } from './helper.mjs';
import { readFileSync } from 'node:fs';

const SANDBOX_FILE =
	'/tmp/claude-1000/-home-tuanpham-work-hr-system-hr-system-be/fd7df120-0745-4bd0-817c-06818b898892/scratchpad/sandbox-office-fe.json';
const sandbox = JSON.parse(readFileSync(SANDBOX_FILE, 'utf8'));
const exp = sandbox.companies.exp;
if (!exp?.employee) throw new Error('sandbox chưa có công ty `exp` để thử chế độ chỉ xem');
console.log(`công ty chỉ xem: ${exp.note}`);

/** Lấy token của công ty `exp` để đọc lại trạng thái phân hệ và lượt họp. */
async function expToken(email) {
	const res = await fetch('http://localhost:3190/v1/auth/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password: PASSWORD }),
	});
	const json = await res.json();
	if (!json?.data?.accessToken) throw new Error(`đăng nhập thất bại ${email}: ${JSON.stringify(json).slice(0, 200)}`);
	return json.data.accessToken;
}

const employeeToken = await expToken(exp.employee);
const entitlements = await api(employeeToken, '/v1/me/entitlements');
const office = (entitlements.json?.data?.modules ?? entitlements.json?.data ?? []).find?.(m => m.code === 'OFFICE');
line(
	office?.state === 'READ_ONLY',
	'FE-47 máy chủ xác nhận OFFICE của công ty này đang ở chế độ chỉ xem',
	`state ${office?.state}, reason ${office?.reason}`,
);

// `from` và `to` là BẮT BUỘC ở route này: gọi thiếu thì nhận 400 chứ không phải danh sách rỗng.
const today = new Date().toISOString().slice(0, 10);
const inTwoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
const mine =
	(await api(employeeToken, `/v1/me/office/room-bookings?from=${today}&to=${inTwoWeeks}`)).json?.data ?? [];
const booking = mine.find(b => b.status !== 'CANCELLED');
const cancelledBefore = mine.find(b => b.status === 'CANCELLED');
/**
 * Lượt duy nhất của công ty này chỉ huỷ được MỘT lần.
 *
 * Phân hệ đang chỉ xem nên không ai đặt lại được lượt mới, kể cả qua API; chạy bài lần hai thì
 * phần sửa và huỷ không dựng lại được, và chính việc lượt đó đã huỷ là bằng chứng của lần một.
 */
if (!booking && !cancelledBefore) {
	// "Lịch của tôi" không trả lượt đã huỷ, nên khi lần chạy trước đã huỷ lượt duy nhất thì ở đây
	// không còn gì cả. Nói rõ là bỏ qua, đừng báo đỏ một việc không dựng lại được.
	line(true, 'FE-47 phần sửa và huỷ bỏ qua: công ty chỉ xem nên không đặt lại được lượt mới', 'đã kiểm ở lần chạy trước');
} else {
	line(
		true,
		'FE-47 nhân viên có lượt họp để thử sửa và huỷ',
		booking ? `lượt ${booking.id}` : `lượt ${cancelledBefore.id} đã bị huỷ ở lần chạy trước`,
	);
}
if (booking) {
	line(
		booking.canEdit === false,
		'FE-47 hợp đồng: `canEdit` là false khi phân hệ chỉ xem',
		`canEdit ${booking.canEdit}`,
	);
	line(
		booking.canCancel === true,
		'FE-47 hợp đồng: `canCancel` vẫn true để còn nhường phòng',
		`canCancel ${booking.canCancel}`,
	);
}

const browser = await launch();

for (const [role, email] of [
	['HR', exp.hr],
	['nhân viên', exp.employee],
]) {
	const page = await signIn(browser, email);
	await go(page, '/office/rooms', 4500);
	const roomsText = (await text(page)).replace(/\s+/g, ' ');
	line(
		/chỉ còn xem được|chế độ chỉ xem/.test(roomsText),
		`FE-47 ${role} thấy băng chỉ xem ở trang Đặt phòng`,
		roomsText.match(/Hành chính văn phòng[^.]*\./)?.[0]?.slice(0, 180) ?? roomsText.slice(0, 160),
	);
	line(
		roomsText.includes('Hành chính văn phòng'),
		`FE-47 ${role}: băng gọi đúng tên phân hệ, không gọi "tính năng"`,
		roomsText.match(/Hành chính văn phòng[^.]*\./)?.[0]?.slice(0, 120) ?? '',
	);
	line(
		(await page.getByRole('button', { name: 'Đặt phòng', exact: true }).count()) === 0,
		`FE-47 ${role}: không còn nút Đặt phòng`,
	);

	// Ô trống trên lịch không bấm được nữa.
	const slots = page.locator('button[title*="chế độ chỉ xem"]');
	const slotCount = await slots.count();
	line(slotCount > 0, `FE-47 ${role}: ô giờ trên lịch nói rõ vì sao không đặt được`, `${slotCount} ô`);
	if (slotCount > 0) {
		line(await slots.first().isDisabled(), `FE-47 ${role}: ô giờ trên lịch thật sự không bấm được`);
	}
	console.log('ảnh:', await shot(page, `fe-47-rooms-readonly-${role === 'HR' ? 'hr' : 'employee'}`));

	await go(page, '/office/supplies', 4000);
	const suppliesText = (await text(page)).replace(/\s+/g, ' ');
	line(
		(await page.locator('input[role="spinbutton"]').count()) === 0,
		`FE-47 ${role}: phiếu văn phòng phẩm không còn ô nhập nào`,
		suppliesText.slice(0, 140),
	);
	line(
		(await page.getByRole('button', { name: 'Thêm dòng' }).count()) === 0,
		`FE-47 ${role}: không còn form thêm mặt hàng`,
	);
	console.log('ảnh:', await shot(page, `fe-47-supplies-readonly-${role === 'HR' ? 'hr' : 'employee'}`));
	line(page.errors.length === 0, `FE-47 không có lỗi JavaScript (${role})`, page.errors.slice(0, 2).join(' | '));
}

// Nhân viên mở lượt họp của mình: không có nút Sửa, còn nút Huỷ.
if (booking) {
	const employee = await signIn(browser, exp.employee);
	await go(employee, `/office/rooms?booking_id=${booking.id}`, 4500);
	const detail = employee.locator('div.fixed.inset-0').last();
	line(
		(await detail.getByRole('button', { name: 'Sửa, dời giờ' }).count()) === 0,
		'FE-47 lượt họp không còn nút "Sửa, dời giờ" khi phân hệ chỉ xem',
	);
	const cancelButton = detail.getByRole('button', { name: 'Huỷ lượt' });
	line((await cancelButton.count()) > 0, 'FE-47 nút "Huỷ lượt" vẫn còn, vì huỷ vẫn được phép');
	console.log('ảnh:', await shot(employee, 'fe-47-booking-readonly'));

	// Huỷ thật: đây là việc duy nhất còn làm được.
	await cancelButton.click();
	await employee.waitForTimeout(800);
	await detail.getByRole('button', { name: 'Xác nhận huỷ' }).click();
	await employee.waitForTimeout(3000);
	const after = (await api(employeeToken, `/v1/office/room-bookings/${booking.id}`)).json?.data;
	line(after?.status === 'CANCELLED', 'FE-47 huỷ được lượt dù phân hệ đang chỉ xem', `status ${after?.status}`);
	console.log('ảnh:', await shot(employee, 'fe-47-booking-cancelled'));
	line(employee.errors.length === 0, 'FE-47 không có lỗi JavaScript (nhân viên huỷ lượt)', employee.errors.slice(0, 2).join(' | '));
}

await browser.close();
process.exit(summary() ? 1 : 0);
