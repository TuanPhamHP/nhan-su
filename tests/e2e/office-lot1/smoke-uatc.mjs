/**
 * FE-55..FE-59: những chỗ UAT đợt C bấm lại còn sót.
 *
 * FE-55 là lỗi lệch tiền: sau khi phòng nhận hàng, hộp phiếu của HCNS tính tiền theo số chốt còn
 * trang của phòng và báo cáo tính theo số thực nhận, nên cùng một phiếu ra hai con số. Bài này so
 * cả BA chỗ với nhau và với số tính tay.
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
	pickSearchable,
	shot,
	signIn,
	summary,
	text,
	toastText,
	ymd,
} from './helper.mjs';

const hrToken = await apiToken(WHO.hr.email);
const a1Token = await apiToken(WHO.employeeA1.email);
const a2Token = await apiToken(WHO.employeeA2.email);
const mgrToken = await apiToken(WHO.managerA.email);

const sites = ((await api(hrToken, '/v1/office/sites')).json?.data ?? []).filter(s => s.isActive);
if (!sites.length) throw new Error('sandbox chưa có văn phòng — chạy smoke-settings.mjs trước');

const items = (await api(a1Token, '/v1/me/office/supply-items')).json?.data ?? [];
if (items.length < 3) throw new Error('danh mục trống — chạy smoke-settings.mjs trước');

const periods = (await api(hrToken, '/v1/office/supply-periods')).json?.data ?? [];

/** Tháng trống của một văn phòng, tính trong tầm ô chọn (tháng này tới mười hai tháng tới). */
function freeMonths(siteId, count) {
	const taken = new Set(periods.filter(p => p.officeSite.id === siteId).map(p => p.month));
	const free = [];
	const now = new Date();
	for (let offset = 0; offset <= 12 && free.length < count; offset++) {
		const at = new Date(now.getFullYear(), now.getMonth() + offset, 1);
		const value = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;
		if (!taken.has(value)) free.push(value);
	}
	return free;
}

let site = null;
let months = [];
for (const candidate of sites) {
	const free = freeMonths(candidate.id, 2);
	if (free.length === 2) {
		site = candidate;
		months = free;
		break;
	}
}
if (!site) throw new Error('không còn văn phòng nào có hai tháng trống trong tầm ô chọn');
console.log(`bài dùng văn phòng ${site.name}, tháng ${months.join(' và ')}`);

async function createPeriod(month, days) {
	const res = await api(hrToken, '/v1/office/supply-periods', {
		method: 'POST',
		body: JSON.stringify({
			officeSiteId: site.id,
			month,
			deadline: ymd(new Date(Date.now() + days * 86400000)),
			departmentIds: [WHO.employeeA1.departmentId],
		}),
	});
	if (res.status >= 400) throw new Error(`không mở được kỳ ${month}: ${res.status} ${res.text.slice(0, 200)}`);
	return res.json.data;
}

async function myRequestOf(token, periodId) {
	const list = (await api(token, '/v1/me/office/supply-requests')).json?.data ?? [];
	return list.find(r => r.period.id === periodId) ?? null;
}

// ─── FE-56: mở kỳ không chọn được tháng đã qua ────────────────────────────────
const browser = await launch();
const hr = await signIn(browser, WHO.hr.email);
await go(hr, '/management/office/supply-periods', 4500);
await hr.getByRole('button', { name: 'Mở kỳ mới' }).first().click();
await hr.waitForTimeout(1800);
const createBox = dialog(hr, 'Mở kỳ đăng ký văn phòng phẩm');
const now = new Date();
const thisMonthLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const previousLabel = `Tháng ${previous.getMonth() + 1}/${previous.getFullYear()}`;

// Đọc tháng ĐANG CHỌN trước khi mở danh sách: nút ô chọn hiện nhãn của giá trị hiện tại.
const monthTrigger = createBox.locator('button[id^="ui-select"]').nth(1);
const selectedMonth = (await monthTrigger.innerText()).trim();
line(
	!selectedMonth.includes(previousLabel),
	'FE-56 tháng chọn sẵn không phải tháng đã qua',
	`đang chọn ${selectedMonth}`,
);

await monthTrigger.click();
await hr.waitForTimeout(600);
// `UiSelect` teleport từng option ra body thành <button>, nên đọc theo nhãn thay vì theo hộp.
const monthOptions = (await hr.getByRole('button', { name: /^Tháng \d+\/\d+$/ }).allInnerTexts())
	.map(s => s.trim())
	.join(' | ');
line(
	monthOptions.includes(thisMonthLabel) && !monthOptions.includes(previousLabel),
	'FE-56 ô chọn tháng bắt đầu từ tháng hiện tại, không còn tháng đã qua',
	`danh sách: ${monthOptions.slice(0, 120)}`,
);
console.log('ảnh:', await shot(hr, 'fe-56-month-options'));
// Đóng danh sách bằng cách bấm tiêu đề hộp, KHÔNG bấm Esc: Esc đóng cả hộp mở kỳ.
await createBox.locator('h2').first().click({ position: { x: 2, y: 2 } });
await hr.waitForTimeout(400);

// Hợp đồng: máy chủ cũng chặn tháng đã qua, nên giao diện và máy chủ nói cùng một chuyện.
const pastMonth = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
const pastTry = await api(hrToken, '/v1/office/supply-periods', {
	method: 'POST',
	body: JSON.stringify({
		officeSiteId: site.id,
		month: pastMonth,
		deadline: ymd(new Date(Date.now() + 3 * 86400000)),
		departmentIds: [WHO.employeeA1.departmentId],
	}),
});
line(
	pastTry.json?.error?.code === 'OFFICE_SUPPLY_PERIOD_MONTH_PAST',
	'FE-56 máy chủ chặn tháng đã qua bằng mã riêng',
	`${pastTry.status} ${pastTry.json?.error?.code ?? ''} ${pastTry.json?.error?.message ?? ''}`,
);
await createBox.getByRole('button', { name: /Thôi|Đóng/ }).first().click();
await hr.waitForTimeout(800);

// ─── Dựng dữ liệu cho FE-55 và FE-57 ─────────────────────────────────────────
const periodOne = await createPeriod(months[0], 5);
const periodTwo = await createPeriod(months[1], 9);
const requestOne = await myRequestOf(a1Token, periodOne.id);
const requestTwo = await myRequestOf(a1Token, periodTwo.id);
if (!requestOne || !requestTwo) throw new Error('phòng A không có phiếu trong hai kỳ vừa mở');

const pricedItem = items.find(i => i.quota == null) ?? items[0];
const addLine = await api(a1Token, `/v1/me/office/supply-requests/${requestOne.id}/lines`, {
	method: 'POST',
	body: JSON.stringify({ itemId: pricedItem.id, requestedQty: 10 }),
});
if (addLine.status >= 400) throw new Error(`không thêm được dòng: ${addLine.text.slice(0, 160)}`);

// Khoá kỳ, đặt đơn giá của kỳ, chốt 10, cấp, rồi phòng nhận 9.
await api(hrToken, `/v1/office/supply-periods/${periodOne.id}/lock`, { method: 'POST' });
const UNIT_PRICE = 65000;
// Route này là PUT (thay cả danh sách dự trù và đơn giá của kỳ), không phải POST.
const priceRes = await api(hrToken, `/v1/office/supply-periods/${periodOne.id}/items`, {
	method: 'PUT',
	body: JSON.stringify({ items: [{ itemId: pricedItem.id, reserveQty: 0, unitPrice: UNIT_PRICE }] }),
});
line(priceRes.status < 400, 'FE-55 đặt được đơn giá của kỳ', `status ${priceRes.status}`);

const detail = (await api(hrToken, `/v1/office/supply-requests/${requestOne.id}`)).json?.data;
const lineId = detail.lines[0].id;
await api(hrToken, `/v1/office/supply-requests/${requestOne.id}/finalize`, {
	method: 'POST',
	body: JSON.stringify({ lines: [{ lineId, finalQty: 10 }] }),
});
await api(hrToken, `/v1/office/supply-requests/${requestOne.id}/issue`, { method: 'POST' });
await api(mgrToken, `/v1/me/office/supply-requests/${requestOne.id}/receive`, {
	method: 'POST',
	body: JSON.stringify({ lines: [{ lineId, receivedQty: 9, receivedNote: 'kho giao thiếu 1' }] }),
});

const expectedMoney = (9 * UNIT_PRICE).toLocaleString('vi-VN');
console.log(`tiền đúng phải là ${expectedMoney} (9 × ${UNIT_PRICE})`);

// ─── FE-55: ba chỗ phải ra cùng một con số ────────────────────────────────────
await go(hr, `/management/office/supply-periods/${periodOne.id}`, 4500);
await hr.locator('button', { hasText: 'Phiếu chính' }).first().click();
await hr.waitForTimeout(2500);
const modalBox = dialog(hr, 'Phiếu phòng');
const modalText = (await modalBox.innerText()).replace(/\s+/g, ' ');
line(
	modalText.includes(expectedMoney),
	'FE-55 hộp phiếu của HCNS tính tiền theo số THỰC NHẬN',
	modalText.match(/Tổng tiền phiếu[^0-9]*[\d.]+/)?.[0] ?? modalText.slice(0, 200),
);
line(
	modalText.includes('Thành tiền tính theo số phòng thực nhận'),
	'FE-55 hộp nói rõ tiền đang tính theo số nào',
	modalText.match(/Thành tiền tính theo[^.]*\./)?.[0] ?? '',
);
line(
	!modalText.includes((10 * UNIT_PRICE).toLocaleString('vi-VN')),
	'FE-55 hộp KHÔNG còn con số tính theo số chốt',
	`số theo số chốt là ${(10 * UNIT_PRICE).toLocaleString('vi-VN')}`,
);
console.log('ảnh:', await shot(hr, 'fe-55-hcns-money'));
await modalBox.getByRole('button', { name: 'Đóng', exact: true }).first().click();
await hr.waitForTimeout(800);

// Bảng tổng hợp là con số KHÁC về nghĩa: số cần mua nhân đơn giá, tức tiền HCNS phải mua, nên nó
// vẫn là 650.000 sau khi phòng nhận 9. Bài kiểm đúng điều đó, và kiểm cả câu giải thích kèm theo.
const purchaseMoney = (10 * UNIT_PRICE).toLocaleString('vi-VN');
const summaryText = (await text(hr)).replace(/\s+/g, ' ');
line(
	summaryText.includes(purchaseMoney),
	'FE-55 bảng tổng hợp là tiền CẦN MUA, không phải chi phí sau khi nhận',
	summaryText.match(/Tổng tiền kỳ [\d.]+/)?.[0] ?? '',
);
line(
	/Thành tiền ở bảng này là số cần mua nhân đơn giá/.test(summaryText),
	'FE-55 bảng tổng hợp nói rõ con số của nó là tiền cần mua',
	summaryText.match(/Thành tiền ở bảng này[^.]*\./)?.[0] ?? '',
);

const a1 = await signIn(browser, WHO.employeeA1.email);
await go(a1, `/office/supplies?request_id=${requestOne.id}`, 4500);
const roomText = (await text(a1)).replace(/\s+/g, ' ');
// Nhân viên KHÔNG thấy tiền (máy chủ trả `null` ở mọi trường tiền), nên trang của phòng không in
// con số nào: kiểm đúng điều đó thay vì đòi nó khớp số của HCNS.
line(
	!/Tổng tiền phiếu/.test(roomText),
	'FE-55 trang của phòng không hiện tiền, đúng như hợp đồng cho nhân viên',
	roomText.match(/Tổng tiền phiếu[^·]*/)?.[0] ?? 'không có dòng tiền nào',
);
line(
	/Số xin 10 .*HCNS chốt 10 .*Đã nhận 9/.test(roomText),
	'FE-55 (C-5) dòng đọc theo thứ tự Số xin, HCNS chốt, Đã nhận',
	roomText.match(/Số xin[^·]*HCNS chốt[^·]*Đã nhận \d+/)?.[0]?.slice(0, 120) ?? '',
);
console.log('ảnh:', await shot(a1, 'fe-55-room-money'));

await go(hr, '/management/office/reports', 4500);
const monthLabelOne = `Tháng ${Number(months[0].slice(5, 7))}/${months[0].slice(0, 4)}`;
const fromTrigger = hr.locator('button[id^="ui-select"]').first();
await fromTrigger.click();
await hr.waitForTimeout(500);
await hr.getByRole('button', { name: monthLabelOne, exact: true }).last().evaluate(el => el.click());
await hr.waitForTimeout(3000);
const toTrigger = hr.locator('button[id^="ui-select"]').nth(1);
await toTrigger.click();
await hr.waitForTimeout(500);
await hr.getByRole('button', { name: monthLabelOne, exact: true }).last().evaluate(el => el.click());
await hr.waitForTimeout(3500);
const reportText = (await text(hr)).replace(/\s+/g, ' ');
line(reportText.includes(expectedMoney), 'FE-55 báo cáo chi phí ra cùng con số', reportText.match(/Tổng chi phí [\d.]+/)?.[0] ?? reportText.slice(0, 200));
console.log('ảnh:', await shot(hr, 'fe-55-report-money'));

// ─── FE-57: lấy số tháng trước lần hai ────────────────────────────────────────
await go(a1, `/office/supplies?request_id=${requestTwo.id}`, 4500);
await clearToasts(a1);
await a1.getByRole('button', { name: 'Lấy số tháng trước' }).first().click();
const firstCopy = await toastText(a1, 20000);
line(/Đã thêm \d+ dòng từ/.test(firstCopy), 'FE-57 lần đầu lấy số tháng trước thì thêm được dòng', firstCopy);
await a1.waitForTimeout(2500);

await clearToasts(a1);
await a1.getByRole('button', { name: 'Lấy số tháng trước' }).first().click();
const secondCopy = await toastText(a1, 20000);
line(
	/Phiếu đã có đủ các mặt hàng của .*, không có gì để thêm/.test(secondCopy),
	'FE-57 lần hai nói phiếu đã đủ, không còn "Đã thêm 0 dòng… Bỏ qua N dòng"',
	secondCopy,
);
line(!/Bỏ qua \d+ dòng/.test(secondCopy), 'FE-57 không còn đếm mặt hàng phiếu đã có là "bỏ qua"', secondCopy);
console.log('ảnh:', await shot(a1, 'fe-57-copy-previous-twice'));

// ─── FE-59: người khác vừa thêm đúng mặt hàng đó ──────────────────────────────
const freshItem = items.find(i => i.id !== pricedItem.id && i.quota == null) ?? items[1];
await go(a1, `/office/supplies?request_id=${requestTwo.id}`, 4500);
// EMPA2 thêm dòng SAU khi màn của EMPA1 đã tải: đúng cảnh hai người cùng nhập một phiếu.
const byOther = await api(a2Token, `/v1/me/office/supply-requests/${requestTwo.id}/lines`, {
	method: 'POST',
	body: JSON.stringify({ itemId: freshItem.id, requestedQty: 4 }),
});
if (byOther.status >= 400 && byOther.json?.error?.code !== 'OFFICE_SUPPLY_LINE_EXISTS') {
	throw new Error(`EMPA2 không thêm được dòng: ${byOther.text.slice(0, 160)}`);
}
console.log(`EMPA2 vừa thêm ${freshItem.name}`);

const addBox = a1.locator('section', { hasText: 'Thêm mặt hàng' }).first();
await pickSearchable(addBox, a1, 0, freshItem.name.slice(0, 10), freshItem.name.slice(0, 10));
await addBox.locator('input[role="spinbutton"]').first().fill('3');
await clearToasts(a1);
await addBox.getByRole('button', { name: 'Thêm dòng' }).first().click();
await a1.waitForTimeout(4000);
const afterConflict = (await text(a1)).replace(/\s+/g, ' ');
const addText = (await addBox.innerText()).replace(/\s+/g, ' ');
line(
	// Câu hiện lên là câu của MÁY CHỦ ("Phiếu đã có mặt hàng này…"); câu dự phòng của trang nói
	// "đã có trong phiếu", nên nhận cả hai cách diễn đạt.
	/đã có mặt hàng này|đã có trong phiếu/.test(`${addText} ${afterConflict}`),
	'FE-59 thêm trùng thì nói mặt hàng đã có trong phiếu',
	addText.match(/[^.]*đã có[^.]*\./)?.[0]?.slice(0, 140) ?? afterConflict.slice(0, 140),
);
line(
	afterConflict.includes(freshItem.name),
	'FE-59 phiếu tự tải lại nên dòng của người kia hiện ra',
	`tìm "${freshItem.name}" trên màn`,
);
console.log('ảnh:', await shot(a1, 'fe-59-reload-on-conflict'));

// ─── FE-58: lịch điện thoại đọc được tên hai phòng ───────────────────────────
const rooms = ((await api(hrToken, '/v1/office/rooms')).json?.data ?? []).filter(r => r.isActive);
const phone = await signIn(browser, WHO.employeeA1.email, { phone: true });
await go(phone, '/office/rooms', 4500);
const siteTrigger = phone.locator('button[id^="ui-select"]').first();
await siteTrigger.click();
await phone.waitForTimeout(500);
await phone.getByRole('button', { name: rooms[0].officeSiteName, exact: true }).last().evaluate(el => el.click());
await phone.waitForTimeout(3500);

const nameCells = phone.locator('div.sticky.left-0 p.font-medium');
const shown = (await nameCells.allInnerTexts()).map(s => s.trim()).filter(Boolean);
const siteRooms = rooms.filter(r => r.officeSiteName === rooms[0].officeSiteName).map(r => r.name);
line(
	siteRooms.every(name => shown.includes(name)),
	'FE-58 điện thoại hiện ĐỦ tên từng phòng, không cắt thành "Phòng họ…"',
	`trên màn: ${shown.join(' | ')}`,
);
line(
	!shown.some(name => name.endsWith('…')),
	'FE-58 không còn dấu ba chấm ở tên phòng',
	shown.join(' | '),
);
line(
	(await phone.evaluate(() => document.documentElement.scrollWidth)) <= 391,
	'FE-58 trang vẫn không tràn ngang',
	`scrollWidth ${await phone.evaluate(() => document.documentElement.scrollWidth)}`,
);
console.log('ảnh:', await shot(phone, 'fe-58-phone-room-names'));

for (const [name, page] of [
	['HCNS', hr],
	['EMPA1', a1],
	['điện thoại', phone],
]) {
	line(page.errors.length === 0, `FE-55..FE-59 không có lỗi JavaScript (${name})`, page.errors.slice(0, 2).join(' | '));
	console.log(`response 4xx của ${name}:`, [...new Set(page.apiErrors)].join(' | ') || 'không có');
}

console.log(`kỳ của bài: ${periodOne.id} (${periodOne.title}) và ${periodTwo.id} (${periodTwo.title})`);
await browser.close();
process.exit(summary() ? 1 : 0);
