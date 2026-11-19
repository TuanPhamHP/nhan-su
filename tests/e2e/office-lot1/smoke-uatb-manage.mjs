/**
 * FE-40, FE-48, FE-51, FE-52: bảng tổng hợp và báo cáo chi phí sau UAT đợt B.
 *
 * Hai chỗ dễ hiểu sai nhất: trưởng phòng mở bảng tổng hợp thấy cột "Cần mua" của cả văn phòng và
 * tưởng đó là số phòng mình (FE-40), và dòng có phòng xin vượt định mức trôi lẫn trong mấy chục
 * dòng nên HCNS chốt mà không đọc lý do (FE-48).
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
	selectAt,
	shot,
	signIn,
	summary,
	text,
	toastText,
	ymd,
} from './helper.mjs';

const hrToken = await apiToken(WHO.hr.email);
const a1Token = await apiToken(WHO.employeeA1.email);

const sites = ((await api(hrToken, '/v1/office/sites')).json?.data ?? []).filter(s => s.isActive);
if (!sites.length) throw new Error('sandbox chưa có văn phòng — chạy smoke-settings.mjs trước');

const items = (await api(a1Token, '/v1/me/office/supply-items')).json?.data ?? [];
const quotaItem = items.find(i => i.quota != null);
if (!quotaItem) throw new Error('danh mục chưa có mặt hàng nào có định mức — chạy smoke-settings.mjs trước');

/**
 * Kỳ riêng cho bài, ở một văn phòng còn tháng trống TRONG TẦM ô chọn tháng của báo cáo.
 *
 * Báo cáo chi phí chỉ chọn được mười hai tháng tới, nên kỳ của bài phải nằm trong khoảng đó; và
 * khi văn phòng này hết tháng trống thì chuyển sang văn phòng khác thay vì bỏ cuộc.
 */
const periods = (await api(hrToken, '/v1/office/supply-periods')).json?.data ?? [];
let site = null;
let month = null;
for (const candidate of sites) {
	const taken = new Set(periods.filter(p => p.officeSite.id === candidate.id).map(p => p.month));
	for (let offset = 1; offset <= 12 && !month; offset++) {
		const at = new Date();
		const next = new Date(at.getFullYear(), at.getMonth() + offset, 1);
		const value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
		if (!taken.has(value)) {
			site = candidate;
			month = value;
		}
	}
	if (month) break;
}
if (!month || !site) throw new Error('không còn văn phòng nào có tháng trống trong mười hai tháng tới');
console.log(`bài dùng văn phòng ${site.name}`);

const created = await api(hrToken, '/v1/office/supply-periods', {
	method: 'POST',
	body: JSON.stringify({
		officeSiteId: site.id,
		month,
		deadline: ymd(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)),
		departmentIds: [WHO.employeeA1.departmentId, WHO.employeeB1.departmentId],
	}),
});
if (created.status >= 400) throw new Error(`không mở được kỳ: ${created.status} ${created.text.slice(0, 200)}`);
const period = created.json.data;
console.log(`bài dùng kỳ ${period.title} (id ${period.id})`);

const request = ((await api(a1Token, '/v1/me/office/supply-requests')).json?.data ?? []).find(
	r => r.period.id === period.id,
);
if (!request) throw new Error('phòng A không có phiếu trong kỳ vừa mở');

// Một dòng vượt định mức kèm lý do, một dòng bình thường.
const overQty = (quotaItem.quota ?? 1) + 3;
const over = await api(a1Token, `/v1/me/office/supply-requests/${request.id}/lines`, {
	method: 'POST',
	body: JSON.stringify({
		itemId: quotaItem.id,
		requestedQty: overQty,
		overQuotaReason: 'Tháng này quyết toán nên in nhiều',
	}),
});
if (over.status >= 400) throw new Error(`không thêm được dòng vượt định mức: ${over.status} ${over.text.slice(0, 200)}`);
const normalItem = items.find(i => i.id !== quotaItem.id);
await api(a1Token, `/v1/me/office/supply-requests/${request.id}/lines`, {
	method: 'POST',
	body: JSON.stringify({ itemId: normalItem.id, requestedQty: 2 }),
});

const browser = await launch();

// ─── FE-48: bảng tổng hợp tô dòng vượt định mức ───────────────────────────────
const hr = await signIn(browser, WHO.hr.email);
await go(hr, `/management/office/supply-periods/${period.id}`, 4500);
const summaryText = (await text(hr)).replace(/\s+/g, ' ');
line(
	summaryText.includes('có phòng xin vượt định mức'),
	'FE-48 dòng vượt định mức được đánh dấu ngay trong bảng tổng hợp',
	summaryText.match(/[^.]*vượt định mức[^.]*/)?.[0]?.slice(0, 160) ?? '',
);
line(
	summaryText.includes('Tháng này quyết toán nên in nhiều'),
	'FE-48 lý do vượt định mức hiện ở cột Ghi chú',
	summaryText.match(/Tháng này quyết toán[^.]*/)?.[0] ?? '',
);
const highlighted = await hr.locator('tr.bg-amber-50\\/70').count();
line(highlighted > 0, 'FE-48 dòng đó được tô màu khác hẳn các dòng còn lại', `${highlighted} dòng được tô`);
console.log('ảnh:', await shot(hr, 'fe-48-over-quota-row'));

// ─── FE-51: khoá sớm và đóng kỳ đều hỏi lại kèm hậu quả ───────────────────────
await hr.getByRole('button', { name: 'Khoá sớm' }).first().click();
await hr.waitForTimeout(1000);
const lockText = (await text(hr)).replace(/\s+/g, ' ');
line(
	/Khoá kỳ .* ngay bây giờ/.test(lockText) && /hạn chót còn \d+ ngày/.test(lockText),
	'FE-51 hộp hỏi lại của Khoá sớm nói hậu quả và số ngày còn lại',
	lockText.match(/Khoá kỳ[^.]*\./)?.[0]?.slice(0, 200) ?? '',
);
line(
	/còn \d+ phòng chưa nhập dòng nào/.test(lockText),
	'FE-51 hộp hỏi lại nói còn phòng nào chưa nhập gì',
	lockText.match(/còn \d+ phòng chưa nhập dòng nào[^.]*\./)?.[0] ?? 'không có phòng nào trống',
);
console.log('ảnh:', await shot(hr, 'fe-51-lock-confirm'));
await clearToasts(hr);
await hr.getByRole('button', { name: 'Khoá kỳ ngay' }).first().click();
line(/Đã khoá kỳ/.test(await toastText(hr, 15000)), 'FE-51 khoá kỳ xong sau khi xác nhận');
await hr.waitForTimeout(2500);

// ─── FE-52: sửa số thực nhận đúng một dòng ────────────────────────────────────
// Chốt, cấp, nhận qua API để tới bước sửa số thực nhận.
const detail = (await api(hrToken, `/v1/office/supply-requests/${request.id}`)).json?.data;
await api(hrToken, `/v1/office/supply-requests/${request.id}/finalize`, {
	method: 'POST',
	body: JSON.stringify({ lines: (detail?.lines ?? []).map(l => ({ lineId: l.id, finalQty: l.requestedQty })) }),
});
await api(hrToken, `/v1/office/supply-requests/${request.id}/issue`, { method: 'POST' });
const issued = (await api(hrToken, `/v1/office/supply-requests/${request.id}`)).json?.data;
const receive = await api(await apiToken(WHO.managerA.email), `/v1/me/office/supply-requests/${request.id}/receive`, {
	method: 'POST',
	body: JSON.stringify({
		lines: (issued?.lines ?? []).map((l, i) => ({
			lineId: l.id,
			receivedQty: i === 0 ? Math.max((l.finalQty ?? 1) - 2, 0) : (l.finalQty ?? 0),
			receivedNote: i === 0 ? 'thiếu 2' : undefined,
		})),
	}),
});
line(receive.status < 400, 'FE-52 phòng đã bấm Đã nhận (qua API) để tới bước sửa số thực nhận', `status ${receive.status}`);

await go(hr, `/management/office/supply-periods/${period.id}`, 4500);
await hr.locator('button', { hasText: 'Phiếu chính' }).first().click();
await hr.waitForTimeout(2500);
const requestBox = dialog(hr, 'Phiếu phòng');
await requestBox.getByRole('button', { name: 'Sửa số thực nhận' }).click();
await hr.waitForTimeout(1500);

// Chưa đổi gì mà bấm Lưu: hộp phải nói ngay, không gọi máy chủ vô ích.
await dialog(hr, 'Phiếu phòng').locator('input[placeholder*="gõ nhầm"]').first().fill('Phòng đếm lại kho');
await dialog(hr, 'Phiếu phòng').getByRole('button', { name: 'Lưu số thực nhận' }).click();
await hr.waitForTimeout(1500);
const nothingText = (await dialog(hr, 'Phiếu phòng').innerText()).replace(/\s+/g, ' ');
line(
	/chưa đổi số thực nhận hay ghi chú nào/i.test(nothingText),
	'FE-52 chưa đổi gì thì hộp nói ngay, không gửi lên máy chủ',
	nothingText.match(/Bạn chưa đổi[^.]*\./)?.[0] ?? nothingText.slice(0, 200),
);
console.log('ảnh:', await shot(hr, 'fe-52-nothing-changed'));

// Đổi đúng một dòng: số và câu nhắc sửa ghi chú.
// `:visible` vì hộp có cả khối dọc cho điện thoại (ẩn trên desktop) lẫn bảng cho desktop.
const firstQty = dialog(hr, 'Phiếu phòng').locator('input[role="spinbutton"]:visible').first();
const current = Number((await firstQty.inputValue()).replace(/\D/g, '')) || 0;
await firstQty.fill(String(current + 1));
await hr.waitForTimeout(800);
const nudgeText = (await dialog(hr, 'Phiếu phòng').innerText()).replace(/\s+/g, ' ');
line(
	/Số đã đổi, bạn sửa ghi chú này cho khớp/.test(nudgeText),
	'FE-52 đổi số mà ghi chú cũ còn nguyên thì được nhắc sửa ghi chú',
	nudgeText.match(/Số đã đổi[^.]*\./)?.[0] ?? '',
);
console.log('ảnh:', await shot(hr, 'fe-52-note-nudge'));
await clearToasts(hr);
await dialog(hr, 'Phiếu phòng').getByRole('button', { name: 'Lưu số thực nhận' }).click();
const correctToast = await toastText(hr, 20000);
line(
	/Đã sửa số thực nhận ở 1 dòng/.test(correctToast),
	'FE-52 câu báo nói đúng MỘT dòng đã đổi, không nói cả phiếu',
	correctToast,
);
console.log('ảnh:', await shot(hr, 'fe-52-corrected'));

// ─── FE-40: trưởng phòng mở bảng tổng hợp và báo cáo chi phí ──────────────────
const manager = await signIn(browser, WHO.managerA.email);
await go(manager, `/management/office/supply-periods/${period.id}`, 4500);
const headers = await manager.locator('thead th').allInnerTexts();
const headerList = headers.map(h => h.trim());
line(!headerList.includes('Dự trù'), 'FE-40 trưởng phòng không thấy cột Dự trù', headerList.join(' | '));
line(!headerList.includes('Cần mua'), 'FE-40 trưởng phòng không thấy cột Cần mua của cả văn phòng', headerList.join(' | '));
line(headerList.includes('Tổng'), 'FE-40 cột số của trưởng phòng là "Tổng"', headerList.join(' | '));
line(
	(await manager.locator('input[role="spinbutton"]').count()) === 0,
	'FE-40 trưởng phòng không có ô nhập nào trên bảng tổng hợp',
);
const managerSummary = (await text(manager)).replace(/\s+/g, ' ');
line(
	managerSummary.includes('Bạn đang xem phạm vi phòng mình'),
	'FE-40 trang nói rõ đây là phạm vi phòng mình',
	managerSummary.match(/Bạn đang xem[^.]*\./)?.[0] ?? '',
);
console.log('ảnh:', await shot(manager, 'fe-40-manager-summary'));

await go(manager, '/management/office/reports', 4500);
// Chọn đúng tháng của kỳ trong bài: trang mở ra ở tháng gần nhất CÓ SỐ, mà sandbox có nhiều kỳ
// nên tháng đó chưa chắc là tháng của bài.
const monthLabelOfPeriod = `Tháng ${Number(month.slice(5, 7))}/${month.slice(0, 4)}`;
await selectAt(manager.locator('body'), manager, 0, monthLabelOfPeriod);
await manager.waitForTimeout(3000);
await selectAt(manager.locator('body'), manager, 1, monthLabelOfPeriod);
await manager.waitForTimeout(3500);
const reportText = (await text(manager)).replace(/\s+/g, ' ');
line(
	!reportText.includes('chưa có chi phí văn phòng phẩm nào'),
	'FE-40 báo cáo có số của tháng kỳ trong bài',
	reportText.match(/Tháng \d+\/\d+/)?.[0] ?? '',
);
line(reportText.includes('Chi phí văn phòng phẩm'), 'FE-40 tiêu đề trang là "Chi phí văn phòng phẩm"');
line(
	reportText.includes('Bạn xem được chi phí của phòng mình'),
	'FE-40 ô Phòng ban bị khoá kèm câu giải thích',
	reportText.match(/Bạn xem được[^.]*\./)?.[0] ?? '',
);
const deptTrigger = manager.locator('button[id^="ui-select"]').nth(2);
line(await deptTrigger.isDisabled(), 'FE-40 ô Phòng ban thật sự không bấm được');
line(
	reportText.includes('Số mặt hàng') || reportText.includes('mặt hàng'),
	'FE-40 cột "Số mặt hàng" dùng đúng tên như file Excel',
);
line(
	reportText.includes('Chi phí tính theo số các phòng thực nhận'),
	'FE-40 câu cơ sở tính nằm ngay dưới bảng',
	reportText.match(/Chi phí tính theo[^.]*\./)?.[0]?.slice(0, 180) ?? '',
);
console.log('ảnh:', await shot(manager, 'fe-40-manager-report'));
line(
	[...new Set(manager.apiErrors)].every(e => !e.startsWith('403')),
	'FE-40 trưởng phòng không gặp 403 nào, vì không còn chọn được phòng khác',
	[...new Set(manager.apiErrors)].join(' | ') || 'không có',
);

// Điện thoại: cột tiền phải thấy ngay.
const phone = await signIn(browser, WHO.managerA.email, { phone: true });
await go(phone, '/management/office/reports', 4500);
await selectAt(phone.locator('body'), phone, 0, monthLabelOfPeriod);
await phone.waitForTimeout(3000);
await selectAt(phone.locator('body'), phone, 1, monthLabelOfPeriod);
await phone.waitForTimeout(3500);
const phoneText = (await text(phone)).replace(/\s+/g, ' ');
line(/Tổng chi phí/.test(phoneText), 'FE-40 điện thoại: dòng Tổng chi phí hiện ngay, không nằm ngoài màn hình');
line(
	(await phone.evaluate(() => document.documentElement.scrollWidth)) <= 391,
	'FE-40 điện thoại: báo cáo không tràn ngang',
	`scrollWidth ${await phone.evaluate(() => document.documentElement.scrollWidth)}`,
);
console.log('ảnh:', await shot(phone, 'fe-40-report-phone'));

await go(phone, `/management/office/supply-periods/${period.id}`, 4500);
// UAT đợt C: điện thoại KHÔNG còn cột tiền ghim bên phải (nó đè lên cột số của phòng ban); thành
// tiền của từng dòng in ngay dưới tên mặt hàng, ở ô dính bên trái.
const phoneSummary = (await text(phone)).replace(/\s+/g, ' ');
line(
	/Thành tiền [\d.—]+/.test(phoneSummary),
	'FE-40 điện thoại: thành tiền của dòng hiện ngay dưới tên mặt hàng',
	phoneSummary.match(/Thành tiền [\d.—]+/)?.[0] ?? phoneSummary.slice(0, 160),
);
line(
	(await phone.locator('td.sticky.right-0').count()) === 0,
	'FE-40 điện thoại: không còn ô tiền ghim đè lên cột phòng ban',
);
console.log('ảnh:', await shot(phone, 'fe-40-summary-phone'));

for (const [name, page] of [
	['HCNS', hr],
	['trưởng phòng', manager],
	['điện thoại', phone],
]) {
	line(page.errors.length === 0, `FE-40..FE-52 không có lỗi JavaScript (${name})`, page.errors.slice(0, 2).join(' | '));
	console.log(`response 4xx của ${name}:`, [...new Set(page.apiErrors)].join(' | ') || 'không có');
}

console.log(`kỳ của bài: ${period.id} (${period.title})`);
await browser.close();
process.exit(summary() ? 1 : 0);
