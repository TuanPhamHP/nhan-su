/**
 * Nửa sau của luồng kỳ đăng ký: chốt phiếu có lý do, cấp hàng, FE-09 nhận hàng, FE-10, FE-11,
 * FE-12, FE-13.
 *
 * Tách khỏi `smoke-period-flow.mjs` vì các bước này chỉ chạy được MỘT lần trên cùng một phiếu
 * (chốt rồi thì không chốt lại), nên khi phải sửa bài giữa đường thì phần đã xanh không phải
 * chạy lại. Bài này tự đọc trạng thái phiếu rồi làm tiếp từ đúng chỗ còn thiếu.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
	SHOTS,
	WHO,
	api,
	apiToken,
	clearToasts,
	dialog,
	findRequestWithLines,
	go,
	launch,
	line,
	readChainState,
	selectAt,
	shot,
	signIn,
	summary,
	text,
	toastText,
} from './helper.mjs';

const hrToken = await apiToken(WHO.hr.email);
const periodsRes = await api(hrToken, '/v1/office/supply-periods');
/**
 * Kỳ của bài: kỳ mà `smoke-period-flow.mjs` vừa khoá, tức kỳ ĐÃ KHOÁ có phiếu của phòng A.
 *
 * Lấy kỳ có id lớn nhất là không chắc: sandbox có nhiều kỳ do các bài khác mở, mà bước dưới cần
 * đúng kỳ đã khoá và có dòng để chốt, cấp, nhận.
 */
const a1TokenForPick = await apiToken(WHO.employeeA1.email);
const allPeriods = periodsRes.json?.data ?? [];
/**
 * Kỳ của bài: đúng kỳ mà `smoke-period-flow.mjs` vừa chạy qua, đọc từ file trao tay.
 *
 * Chưa có file (chạy lẻ bài này) thì tìm kỳ đã khoá có những dòng của `smoke-supplies.mjs`.
 */
const handedOver = readChainState().flowPeriodId;
let period = allPeriods.find(p => p.id === handedOver) ?? null;
if (!period) {
	const picked = await findRequestWithLines(a1TokenForPick, [/Bút bi/, /Giấy in A4/], { status: 'LOCKED' });
	period = allPeriods.find(p => p.id === picked.item?.period?.id) ?? null;
}
if (!period) {
	throw new Error('không tìm thấy kỳ đã khoá có dòng Bút bi và Giấy in A4 — chạy smoke-period-flow.mjs trước');
}
console.log(`bài làm việc trên kỳ ${period.title} (${period.statusLabel})`);

const summaryRes = await api(hrToken, `/v1/office/supply-periods/${period.id}`);
const deptA = summaryRes.json?.data?.departments?.find(d => d.departmentId === WHO.employeeA1.departmentId);
const mainRequest = deptA?.requests?.find(r => r.sequence === 0);
console.log('phiếu phòng A:', JSON.stringify(mainRequest));

const browser = await launch();
const hr = await signIn(browser, WHO.hr.email);

// ─── FE-08 (tiếp): chốt có lý do rồi cấp hàng ─────────────────────────────────
await go(hr, `/management/office/supply-periods/${period.id}`);
await hr.locator('button', { hasText: 'Phiếu chính' }).first().click();
await hr.waitForTimeout(2500);
const box = dialog(hr, 'Phiếu phòng');

if (mainRequest?.status === 'LOCKED') {
	const row = box.locator('tr', { hasText: 'Giấy in A4' }).first();
	await row.locator('input[role="spinbutton"]').first().fill('6');
	// `UiNumberInput` cũng là input type=text, nên loại trừ `role="spinbutton"` để gõ đúng ô lý do.
	await row.locator('input[type="text"]:not([role="spinbutton"])').first().fill('Còn hàng dự trù tháng trước');
	await hr.waitForTimeout(400);
	await clearToasts(hr);
	await box.getByRole('button', { name: 'Chốt phiếu' }).click();
	const finalizeToast = await toastText(hr, 20000);
	line(/Đã chốt phiếu/.test(finalizeToast), 'FE-08 có lý do thì chốt được phiếu', finalizeToast);
	await hr.waitForTimeout(2500);
	console.log('ảnh:', await shot(hr, 'fe-08-finalized'));
} else {
	line(true, 'FE-08 có lý do thì chốt được phiếu', `phiếu đã ở trạng thái ${mainRequest?.statusLabel}`);
}

if ((await box.getByRole('button', { name: 'Cấp hàng' }).count()) > 0) {
	await clearToasts(hr);
	await box.getByRole('button', { name: 'Cấp hàng' }).click();
	const issueToast = await toastText(hr, 20000);
	line(/Đã cấp hàng/.test(issueToast), 'FE-08 cấp hàng cho phòng', issueToast);
	await hr.waitForTimeout(2500);
} else {
	line(true, 'FE-08 cấp hàng cho phòng', 'phiếu đã được cấp từ lần chạy trước');
}
console.log('ảnh:', await shot(hr, 'fe-08-issued'));

// ─── FE-12: ghi đã giao thay chưa tới lúc ─────────────────────────────────────
const issuedText = (await box.innerText()).replace(/\s+/g, ' ');
const proxyButtons = await box.getByRole('button', { name: 'Ghi đã giao thay' }).count();
line(proxyButtons === 0, 'FE-12 nút ghi đã giao thay chưa hiện vì chưa đủ 3 ngày làm việc', `${proxyButtons} nút`);
// Câu giải thích chỉ có nghĩa khi phiếu còn chờ nhận; chạy lại bài sau khi phòng đã nhận thì
// phiếu không còn chờ ai nữa nên câu đó biến mất, đó là đúng.
if (/Đã cấp, chờ nhận/.test(issuedText)) {
	line(
		/ghi đã giao thay được từ/i.test(issuedText),
		'FE-12 phiếu nói rõ từ lúc nào mới ghi đã giao thay được',
		issuedText.match(/Bạn ghi đã giao thay được từ [^.]*/)?.[0] ?? issuedText.slice(0, 160),
	);
} else {
	line(true, 'FE-12 phiếu nói rõ từ lúc nào mới ghi đã giao thay được', 'phiếu đã nhận nên không còn chờ ghi đã giao');
}
console.log('ảnh:', await shot(hr, 'fe-12-proxy-too-early'));
await box.getByRole('button', { name: 'Đóng', exact: true }).first().click();
await hr.waitForTimeout(800);

const mgraToken = await apiToken(WHO.managerA.email);
const notifs = await api(mgraToken, '/v1/notifications?page=1&limit=10');
line(
	(notifs.json?.data ?? []).some(n => n.type === 'OFFICE_SUPPLY_ISSUED'),
	'FE-08 trưởng phòng A nhận thông báo đã cấp hàng',
	(notifs.json?.data ?? []).map(n => n.type).slice(0, 5).join(', '),
);

// ─── FE-09: đầu mối và nhận hàng ──────────────────────────────────────────────
const mgra = await signIn(browser, WHO.managerA.email);
await go(mgra, '/office/supplies');
await mgra.waitForTimeout(2500);
const contactSection = mgra.locator('section', { hasText: 'Đầu mối nhận hàng' }).first();
const contactNow = (await contactSection.innerText()).replace(/\s+/g, ' ');

if (!contactNow.includes(WHO.employeeA1.fullName)) {
	await clearToasts(mgra);
	await mgra.getByRole('button', { name: 'Chọn đầu mối' }).first().click();
	await mgra.waitForTimeout(800);
	await contactSection.locator('div[class*="selectTrigger"]').first().click();
	await mgra.waitForTimeout(400);
	await contactSection.locator('input[class*="searchInput"]').first().fill(WHO.employeeA1.fullName);
	await mgra.waitForTimeout(800);
	await contactSection.locator('[class*="optionLabel"]', { hasText: WHO.employeeA1.fullName }).first().click();
	await mgra.waitForTimeout(400);
	await contactSection.getByRole('button', { name: 'Lưu đầu mối' }).click();
	const contactToast = await toastText(mgra, 20000);
	line(
		new RegExp(`Đã chỉ định ${WHO.employeeA1.fullName} làm đầu mối`).test(contactToast),
		'FE-09 trưởng phòng chỉ định EMPA1 làm đầu mối',
		contactToast,
	);
	await mgra.waitForTimeout(1500);
} else {
	line(true, 'FE-09 trưởng phòng chỉ định EMPA1 làm đầu mối', 'đã chỉ định từ lần chạy trước');
}
console.log('ảnh:', await shot(mgra, 'fe-09-contact'));

const a1 = await signIn(browser, WHO.employeeA1.email);
await go(a1, '/office/supplies');
await a1.waitForTimeout(2500);
// Phòng có nhiều phiếu của nhiều kỳ, nên chọn đúng kỳ của bài trước khi bấm nhận.
await a1
	.locator('button', { hasText: period.title })
	.filter({ hasText: period.officeSite.name })
	.first()
	.click();
await a1.waitForTimeout(2500);
const receiveButton = a1.getByRole('button', { name: 'Đã nhận', exact: true }).first();
const hasReceive = (await receiveButton.count()) > 0;
// Phiếu đã nhận ở lần chạy trước thì nút biến mất, đó là đúng chứ không phải lỗi.
const alreadyReceived = (await text(a1)).includes('Phòng đã nhận');
line(
	hasReceive || alreadyReceived,
	'FE-09 đầu mối thấy nút Đã nhận',
	hasReceive ? '' : 'phiếu đã nhận từ lần chạy trước',
);

if (hasReceive) {
	await receiveButton.click();
	await a1.waitForTimeout(2000);
	const receiveBox = dialog(a1, 'Xác nhận đã nhận hàng');
	const receiveRow = receiveBox.locator('tr', { hasText: 'Giấy in A4' }).first();
	await receiveRow.locator('input[role="spinbutton"]').first().fill('6');
	await receiveRow.locator('input[type="text"]:not([role="spinbutton"])').first().fill('Thiếu 2');
	await a1.waitForTimeout(400);
	await clearToasts(a1);
	await receiveBox.getByRole('button', { name: 'Xác nhận đã nhận', exact: true }).click();
	const receiveToast = await toastText(a1, 20000);
	line(/Đã ghi nhận hàng/.test(receiveToast), 'FE-09 ghi nhận 6 trên 8 Giấy in A4', receiveToast);
	await a1.waitForTimeout(2500);
}

const a1Text = await text(a1);
line(/Phòng đã nhận|Đã nhận lúc/.test(a1Text), 'FE-09 phiếu chuyển sang Đã nhận', a1Text.match(/Phòng đã nhận[^.]{0,60}/)?.[0] ?? '');
console.log('ảnh:', await shot(a1, 'fe-09-received'));

// ─── FE-10: nhân viên thường không có nút Đã nhận ─────────────────────────────
const a2 = await signIn(browser, WHO.employeeA2.email);
await go(a2, '/office/supplies');
await a2.waitForTimeout(2500);
const a2Receive = await a2.getByRole('button', { name: 'Đã nhận', exact: true }).count();
line(a2Receive === 0, 'FE-10 nhân viên thường không có nút Đã nhận', `${a2Receive} nút`);
console.log('ảnh:', await shot(a2, 'fe-10-no-receive'));

// ─── FE-11: phiếu bổ sung ─────────────────────────────────────────────────────
await go(hr, `/management/office/supply-periods/${period.id}`);
const beforeSup = await text(hr);

if (!/Bổ sung 1/.test(beforeSup)) {
	await clearToasts(hr);
	await hr.getByRole('button', { name: 'Phiếu bổ sung' }).first().click();
	await hr.waitForTimeout(2500);
	const supBox = dialog(hr, 'Phiếu bổ sung');
	await supBox.locator('button[id^="ui-select"]').first().click();
	await hr.waitForTimeout(500);
	await hr.getByRole('button', { name: 'Dịch vụ khách hàng', exact: true }).last().evaluate(el => el.click());
	await hr.waitForTimeout(500);
	await supBox.locator('input[placeholder*="quyết toán"]').first().fill('Phòng B hết cafe tiếp khách');
	await supBox.locator('div[class*="selectTrigger"]').first().click();
	await hr.waitForTimeout(400);
	await supBox.locator('input[class*="searchInput"]').first().fill('Cafe');
	await hr.waitForTimeout(900);
	const cafeOption = supBox.locator('[class*="optionLabel"]').first();
	const cafeLabel = (await cafeOption.innerText().catch(() => '')).replace(/\s+/g, ' ');
	line(/chỉ HCNS đặt/i.test(cafeLabel), 'FE-11 ô chọn của HCNS có cả nhóm chỉ HCNS đặt', cafeLabel);
	await cafeOption.click();
	await hr.waitForTimeout(400);
	await supBox.locator('input[role="spinbutton"]').first().fill('2');
	await hr.waitForTimeout(300);
	await supBox.getByRole('button', { name: 'Tạo phiếu bổ sung' }).click();
	const supToast = await toastText(hr, 20000);
	line(/Đã tạo phiếu bổ sung/.test(supToast), 'FE-11 tạo phiếu bổ sung cho phòng B', supToast);
	await hr.waitForTimeout(2500);
} else {
	line(true, 'FE-11 tạo phiếu bổ sung cho phòng B', 'đã tạo từ lần chạy trước');
}

const afterSup = await text(hr);
line(/Bổ sung 1/.test(afterSup), 'FE-11 phiếu bổ sung hiện ở trang kỳ', afterSup.match(/Bổ sung 1[^·]{0,40}/)?.[0] ?? '');
console.log('ảnh:', await shot(hr, 'fe-11-supplement'));

const mgrbToken = await apiToken(WHO.managerB.email);
const mgrbNotifs = await api(mgrbToken, '/v1/notifications?page=1&limit=10');
line(
	(mgrbNotifs.json?.data ?? []).some(n => n.type === 'OFFICE_SUPPLY_SUPPLEMENT_CREATED'),
	'FE-11 trưởng phòng B nhận thông báo phiếu bổ sung',
	(mgrbNotifs.json?.data ?? []).map(n => n.type).slice(0, 5).join(', '),
);

// Kỳ còn mở: giao diện không có nút phiếu bổ sung, và máy chủ cũng chặn.
let openPeriodId = periodsRes.json?.data?.find(p => p.status === 'OPEN')?.id;
if (!openPeriodId) {
	const created = await api(hrToken, '/v1/office/supply-periods', {
		method: 'POST',
		body: JSON.stringify({
			officeSiteId: period.officeSite.id,
			month: '2027-02',
			deadline: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
			departmentIds: [WHO.employeeB1.departmentId],
		}),
	});
	openPeriodId = created.json?.data?.id;
}
await go(hr, `/management/office/supply-periods/${openPeriodId}`);
const openPeriodText = await text(hr);
line(
	!/Phiếu bổ sung/.test(openPeriodText),
	'FE-11 kỳ còn mở thì giao diện không có nút Phiếu bổ sung',
	openPeriodText.match(/Xuất Excel|Gia hạn|Khoá sớm|Đóng kỳ/g)?.join(', ') ?? '',
);
// Giao diện không mở đường này, nên gọi thẳng API để chắc chắn luật nằm ở máy chủ chứ không chỉ
// ở chỗ ẩn nút. Dòng gửi lên phải hợp lệ, nếu không sẽ dính lỗi kiểm dữ liệu thay vì lỗi trạng thái.
const anyItem = (await api(hrToken, '/v1/office/supply-items')).json?.data?.[0]?.id;
const supOnOpen = await api(hrToken, `/v1/office/supply-periods/${openPeriodId}/supplements`, {
	method: 'POST',
	body: JSON.stringify({
		departmentId: WHO.employeeB1.departmentId,
		note: 'thử khi kỳ còn mở',
		lines: [{ itemId: anyItem, requestedQty: 1 }],
	}),
});
line(
	supOnOpen.json?.error?.code === 'OFFICE_SUPPLY_INVALID_STATE',
	'FE-11 máy chủ chặn phiếu bổ sung khi kỳ còn mở',
	`${supOnOpen.status} ${supOnOpen.json?.error?.code ?? ''} ${supOnOpen.json?.error?.message ?? ''}`,
);
console.log('ảnh:', await shot(hr, 'fe-11-open-period-no-supplement'));

// ─── FE-13: xuất Excel và góc nhìn trưởng phòng ───────────────────────────────
await go(hr, `/management/office/supply-periods/${period.id}`);
await clearToasts(hr);
const [periodDownload] = await Promise.all([
	hr.waitForEvent('download', { timeout: 30000 }),
	hr.getByRole('button', { name: 'Xuất Excel' }).first().click(),
]);
const periodFile = `${SHOTS}/fe-13-tong-hop.xlsx`;
await periodDownload.saveAs(periodFile);
line(
	readFileSync(periodFile).length > 3000,
	'FE-13 tải được file bảng tổng hợp',
	`${readFileSync(periodFile).length} byte, ${periodDownload.suggestedFilename()}`,
);
const periodStrings = execFileSync('unzip', ['-p', periodFile, 'xl/sharedStrings.xml'], { encoding: 'utf8' });
line(
	periodStrings.includes('Tài chính - Kế toán') && periodStrings.includes('Dịch vụ khách hàng'),
	'FE-13 file bảng tổng hợp có cột từng phòng ban như file HCNS',
	periodStrings.match(/Tài chính - Kế toán|Dịch vụ khách hàng/g)?.join(', ') ?? periodStrings.slice(0, 120),
);

await go(hr, '/management/office/reports');
await hr.waitForTimeout(2500);
// Báo cáo mặc định xem tháng này, còn kỳ vừa chạy là tháng chi phí 12/2026, nên chọn đúng tháng.
await selectAt(hr, hr, 0, period.title);
await selectAt(hr, hr, 1, period.title);
await hr.waitForTimeout(2500);
const reportText = await text(hr);
line(/Tổng chi phí/.test(reportText), 'FE-13 báo cáo chi phí mở được', reportText.slice(0, 160));
/**
 * Chi phí tính theo SỐ THỰC NHẬN, kiểm ở hai nơi.
 *
 * Không so tổng cả tháng trên màn nữa: sandbox dùng chung nên cùng một tháng có thể có chi phí của
 * nhiều kỳ, nhiều văn phòng, và con số tổng đổi theo những bài khác. Thay vào đó kiểm hai điều chắc
 * chắn: thành tiền của DÒNG trong phiếu của bài đúng bằng số thực nhận nhân đơn giá, và số trên
 * màn khớp số máy chủ trả cho cùng bộ lọc.
 */
const paperLine = (await api(hrToken, `/v1/office/supply-requests/${mainRequest.id}`)).json?.data?.lines?.find(
	l => /Giấy in A4/.test(l.name),
);
line(
	paperLine?.amount === (paperLine?.receivedQty ?? 0) * (paperLine?.unitPrice ?? 0),
	'FE-09 thành tiền của dòng tính theo số thực nhận',
	`nhận ${paperLine?.receivedQty} × ${paperLine?.unitPrice} = ${paperLine?.amount}`,
);
const apiReport = (
	await api(hrToken, `/v1/office/reports/supply-costs?monthFrom=${period.month}&monthTo=${period.month}`)
).json?.data;
line(
	reportText.includes(apiReport.totalAmount.toLocaleString('vi-VN')),
	'FE-09 số trên màn báo cáo khớp số máy chủ trả về',
	`máy chủ ${apiReport?.totalAmount?.toLocaleString('vi-VN')}`,
);
console.log('ảnh:', await shot(hr, 'fe-13-report'));

const [reportDownload] = await Promise.all([
	hr.waitForEvent('download', { timeout: 30000 }),
	hr.getByRole('button', { name: 'Xuất Excel' }).first().click(),
]);
const reportFile = `${SHOTS}/fe-13-bao-cao.xlsx`;
await reportDownload.saveAs(reportFile);
line(
	readFileSync(reportFile).length > 3000,
	'FE-13 tải được file báo cáo chi phí',
	`${readFileSync(reportFile).length} byte, ${reportDownload.suggestedFilename()}`,
);

await go(mgra, '/management/office/reports');
await mgra.waitForTimeout(2500);
await selectAt(mgra, mgra, 0, period.title);
await selectAt(mgra, mgra, 1, period.title);
await mgra.waitForTimeout(2500);
const mgraReport = await text(mgra);
line(
	mgraReport.includes('Tài chính - Kế toán') && !mgraReport.includes('Dịch vụ khách hàng'),
	'FE-13 trưởng phòng chỉ thấy phòng mình trong báo cáo',
	mgraReport.match(/Tài chính - Kế toán|Dịch vụ khách hàng|Trung tâm công nghệ/g)?.join(', ') ?? '',
);
console.log('ảnh:', await shot(mgra, 'fe-13-manager-report'));

await go(mgra, `/management/office/supply-periods/${period.id}`);
await mgra.waitForTimeout(2500);
const mgraPeriod = await text(mgra);
const mgraWrite = await mgra
	.getByRole('button', { name: /Khoá sớm|Đóng kỳ|Gia hạn|Phiếu bổ sung|Lưu dự trù/ })
	.count();
line(mgraWrite === 0, 'FE-13 trưởng phòng không có nút ghi trên trang kỳ', `${mgraWrite} nút`);
line(
	!mgraPeriod.includes('Dịch vụ khách hàng'),
	'FE-13 trang kỳ của trưởng phòng chỉ có cột phòng mình',
	mgraPeriod.match(/Tài chính - Kế toán|Dịch vụ khách hàng|Trung tâm công nghệ/g)?.join(', ') ?? '',
);
console.log('ảnh:', await shot(mgra, 'fe-13-manager-period'));

for (const [name, page] of [
	['HR01', hr],
	['EMPA1', a1],
	['EMPA2', a2],
	['MGRA', mgra],
]) {
	line(page.errors.length === 0, `FE-08..FE-13 không có lỗi JavaScript (${name})`, page.errors.slice(0, 2).join(' | '));
	console.log(`response 4xx của ${name}:`, [...new Set(page.apiErrors)].join(' | ') || 'không có');
}

await browser.close();
process.exit(summary() ? 1 : 0);
