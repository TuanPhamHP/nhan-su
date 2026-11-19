/**
 * FE-07 tới FE-13: khoá kỳ, bảng tổng hợp, chốt, cấp, nhận hàng, phiếu bổ sung, ghi đã giao và
 * xuất Excel.
 *
 * Một bài liền mạch vì các bước phụ thuộc nhau: phải khoá kỳ mới chốt được, chốt rồi mới cấp
 * được, cấp rồi mới nhận được. Chạy sau `smoke-supplies.mjs`.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
	API,
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
	saveChainState,
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
 * Kỳ của bài: kỳ mà `smoke-supplies.mjs` vừa nhập dòng vào.
 *
 * Không lấy kỳ có id lớn nhất: sandbox chạy nhiều bài nên có thể có vài kỳ đang mở, mà kỳ mới
 * nhất chưa chắc là kỳ có dòng. Các bước dưới cần một phiếu CÓ DÒNG để chốt và cấp, nên tìm theo
 * phiếu của phòng A.
 */
const a1TokenForPick = await apiToken(WHO.employeeA1.email);
const LINES = [/Bút bi/, /Giấy in A4/];
// Ưu tiên kỳ còn mở (bài cần tự khoá nó); chạy lại trên sandbox đã khoá thì lấy kỳ đã khoá mà
// phiếu CHƯA chốt, vì các bước dưới là chốt, cấp, nhận.
let picked = await findRequestWithLines(a1TokenForPick, LINES, { status: 'OPEN' });
if (!picked.item) {
	picked = await findRequestWithLines(a1TokenForPick, LINES, { status: 'LOCKED', requestStatus: 'LOCKED' });
}
const allPeriods = periodsRes.json?.data ?? [];
const period =
	allPeriods.find(p => p.id === picked.item?.period?.id) ?? allPeriods.sort((a, b) => b.id - a.id)[0];
if (!period) throw new Error('chưa có kỳ nào — chạy smoke-period-open.mjs trước');
if (!picked.item) throw new Error('không tìm thấy phiếu có dòng Bút bi và Giấy in A4 — chạy smoke-supplies.mjs trước');
// Trao kỳ này lại cho `smoke-period-flow2.mjs`, khỏi phải đoán.
saveChainState({ flowPeriodId: period.id, flowPeriodTitle: period.title });
console.log(`bài làm việc trên kỳ ${period.title} (${period.statusLabel})`);

const browser = await launch();
const hr = await signIn(browser, WHO.hr.email);
const a1 = await signIn(browser, WHO.employeeA1.email);

// ─── FE-07: HR khoá sớm, EMPA1 đang mở phiếu thì sửa ──────────────────────────
// Mở phiếu ở tab của EMPA1 TRƯỚC khi khoá: đây mới là tình huống thật của người đang nhập dở.
const wasOpen = period.status === 'OPEN';
await go(a1, '/office/supplies');
await a1.waitForTimeout(2500);
if (wasOpen) {
	await a1
		.locator('button', { hasText: period.title })
		.filter({ hasText: period.officeSite.name })
		.first()
		.click();
	await a1.waitForTimeout(2500);
}

await go(hr, `/management/office/supply-periods/${period.id}`);
await clearToasts(hr);
// Chạy lại bài trên sandbox đã khoá kỳ thì không còn nút này nữa, nên nói rõ thay vì gãy.
if (period.status === 'OPEN') {
	await hr.getByRole('button', { name: 'Khoá sớm' }).first().click();
	// UAT đợt B: khoá sớm nay hỏi lại kèm hậu quả, nên phải xác nhận thêm một bước.
	await hr.waitForTimeout(1000);
	await hr.getByRole('button', { name: 'Khoá kỳ ngay' }).first().click();
	const lockToast = await toastText(hr, 20000);
	line(/Đã khoá kỳ/.test(lockToast), 'FE-07 HR khoá sớm kỳ', lockToast);
} else {
	line(true, 'FE-07 HR khoá sớm kỳ', `kỳ đã ở trạng thái ${period.statusLabel} từ lần chạy trước`);
}
await hr.waitForTimeout(2000);
console.log('ảnh:', await shot(hr, 'fe-07-locked-period'));

// Màn của EMPA1 đang là màn mở TRƯỚC lúc khoá, nên vẫn còn ô nhập: bấm Lưu lúc này là đúng tình
// huống người đang nhập dở. Chạy lại bài khi kỳ đã khoá sẵn thì không dựng lại được cảnh đó.
if (wasOpen) {
	await clearToasts(a1);
	const penRow = a1.locator('div.p-4', { hasText: 'Bút bi' }).first();
	// Gõ một số KHÁC số đang có: gõ lại đúng số cũ thì dòng không "bẩn" nên nút Lưu không hiện,
	// và bài sẽ đỏ vì một lý do chẳng liên quan gì tới việc đang kiểm.
	const penQty = (picked.detail?.lines ?? []).find(l => /Bút bi/.test(l.name))?.requestedQty ?? 10;
	await penRow.locator('input[role="spinbutton"]').first().fill(String(penQty + 5));
	await a1.waitForTimeout(400);
	await penRow.getByRole('button', { name: 'Lưu', exact: true }).click();
	const lockedToast = await toastText(a1, 20000);
	line(
		/kỳ đã|đã khoá|đã đóng|hết hạn/i.test(lockedToast),
		'FE-07 EMPA1 sửa sau khi khoá thì nhận câu của máy chủ',
		lockedToast,
	);
	await a1.waitForTimeout(2500);
	await go(a1, '/office/supplies', 3000);
	await a1
		.locator('button', { hasText: period.title })
		.filter({ hasText: period.officeSite.name })
		.first()
		.click();
	await a1.waitForTimeout(2500);
} else {
	line(true, 'FE-07 EMPA1 sửa sau khi khoá thì nhận câu của máy chủ', 'kỳ đã khoá sẵn nên không dựng lại được cảnh này');
	await a1
		.locator('button', { hasText: period.title })
		.filter({ hasText: period.officeSite.name })
		.first()
		.click();
	await a1.waitForTimeout(2500);
}
const a1AfterLock = await text(a1);
const inputsLeft = await a1.locator('input[role="spinbutton"]').count();
line(inputsLeft === 0, 'FE-07 phiếu khoá thì không còn ô nhập nào', `còn ${inputsLeft} ô`);
line(/Chờ HCNS chốt/.test(a1AfterLock), 'FE-07 phiếu chuyển sang Chờ HCNS chốt', a1AfterLock.match(/Chờ HCNS chốt/)?.[0] ?? '');
console.log('ảnh:', await shot(a1, 'fe-07-employee-locked'));

// ─── FE-08: bảng tổng hợp, dự trù, đơn giá, chốt, cấp ─────────────────────────
await go(hr, `/management/office/supply-periods/${period.id}`);
const matrixText = await text(hr);
line(/I\.|II\./.test(matrixText), 'FE-08 bảng tổng hợp chia nhóm có số La Mã', matrixText.match(/I+\. [^·]{0,40}/)?.[0] ?? '');
line(/Tài chính - Kế toán/.test(matrixText), 'FE-08 bảng có cột phòng ban như file HCNS');
console.log('ảnh:', await shot(hr, 'fe-08-matrix'));

const paperRow = hr.locator('tr', { hasText: 'Giấy in A4' }).first();
await paperRow.locator('input[role="spinbutton"]').first().fill('5');
await paperRow.locator('input[role="spinbutton"]').nth(1).fill('65000');
await hr.waitForTimeout(400);
await clearToasts(hr);
await hr.getByRole('button', { name: 'Lưu dự trù và đơn giá' }).first().click();
const itemsToast = await toastText(hr, 20000);
line(/Đã lưu dự trù và đơn giá/.test(itemsToast), 'FE-08 lưu dự trù 5 và đơn giá 65.000', itemsToast);
await hr.waitForTimeout(2000);
const paperRowText = (await paperRow.innerText()).replace(/\s+/g, ' ');
line(
	/\b13\b/.test(paperRowText),
	'FE-08 số cần mua Giấy in A4 bằng 8 cộng 5',
	paperRowText.slice(0, 160),
);
console.log('ảnh:', await shot(hr, 'fe-08-reserve-price'));

// Mở phiếu phòng A: sửa số chốt mà không ghi lý do.
await clearToasts(hr);
await hr.locator('button', { hasText: 'Phiếu chính' }).first().click();
await hr.waitForTimeout(2500);
const requestBox = dialog(hr, 'Phiếu phòng');
const finalRow = requestBox.locator('tr', { hasText: 'Giấy in A4' }).first();
await finalRow.locator('input[role="spinbutton"]').first().fill('6');
await hr.waitForTimeout(300);
await requestBox.getByRole('button', { name: 'Chốt phiếu' }).click();
await hr.waitForTimeout(1500);
const finalError = await finalRow.locator('p.text-red-500').first().innerText().catch(() => '');
line(
	/ghi lý do/i.test(finalError),
	'FE-08 chốt số khác số xin mà thiếu lý do thì bị chặn ngay ô đó',
	finalError.trim(),
);
console.log('ảnh:', await shot(hr, 'fe-08-final-no-reason'));

// Ô số của `UiNumberInput` cũng là `type="text"` (nó tự nhóm nghìn), nên phải loại trừ
// `role="spinbutton"` để không gõ lý do vào ô số.
await finalRow.locator('input[type="text"]:not([role="spinbutton"])').first().fill('Còn hàng dự trù tháng trước');
await hr.waitForTimeout(300);
await clearToasts(hr);
await requestBox.getByRole('button', { name: 'Chốt phiếu' }).click();
const finalizeToast = await toastText(hr, 20000);
line(/Đã chốt phiếu/.test(finalizeToast), 'FE-08 có lý do thì chốt được phiếu', finalizeToast);
await hr.waitForTimeout(2000);

await clearToasts(hr);
await requestBox.getByRole('button', { name: 'Cấp hàng' }).click();
const issueToast = await toastText(hr, 20000);
line(/Đã cấp hàng/.test(issueToast), 'FE-08 cấp hàng cho phòng', issueToast);
await hr.waitForTimeout(2000);
console.log('ảnh:', await shot(hr, 'fe-08-issued'));

// ─── FE-12: ghi đã giao thay chưa tới lúc ─────────────────────────────────────
const issuedBoxText = (await requestBox.innerText()).replace(/\s+/g, ' ');
const hasProxyButton = await requestBox.getByRole('button', { name: 'Ghi đã giao thay' }).count();
line(hasProxyButton === 0, 'FE-12 nút ghi đã giao thay chưa hiện vì chưa đủ 3 ngày làm việc', `${hasProxyButton} nút`);
line(
	/ghi đã giao thay được từ/i.test(issuedBoxText),
	'FE-12 phiếu nói rõ từ lúc nào HCNS mới ghi đã giao thay được',
	issuedBoxText.match(/Bạn ghi đã giao thay được từ [^.]*/)?.[0] ?? '',
);
console.log('ảnh:', await shot(hr, 'fe-12-proxy-too-early'));
await requestBox.getByRole('button', { name: 'Đóng', exact: true }).first().click();
await hr.waitForTimeout(800);

// MGRA nhận thông báo cấp hàng.
const mgraToken = await apiToken(WHO.managerA.email);
const notifs = await api(mgraToken, '/v1/notifications?page=1&limit=10');
const notifTypes = (notifs.json?.data ?? []).map(n => n.type);
line(
	notifTypes.includes('OFFICE_SUPPLY_ISSUED'),
	'FE-08 trưởng phòng A nhận thông báo đã cấp hàng',
	notifTypes.slice(0, 5).join(', '),
);

// ─── FE-09: trưởng phòng chỉ định đầu mối, đầu mối bấm Đã nhận ────────────────
const mgra = await signIn(browser, WHO.managerA.email);
await go(mgra, '/office/supplies');
await mgra.waitForTimeout(2500);
await clearToasts(mgra);
await mgra.getByRole('button', { name: 'Chọn đầu mối' }).first().click();
await mgra.waitForTimeout(600);
const contactBox = mgra.locator('section', { hasText: 'Đầu mối nhận hàng' }).first();
await contactBox.locator('div[class*="selectTrigger"]').first().click();
await mgra.waitForTimeout(400);
await contactBox.locator('input[class*="searchInput"]').first().fill('Phạm Văn An');
await mgra.waitForTimeout(700);
await contactBox.locator('[class*="optionLabel"]', { hasText: 'Phạm Văn An' }).first().click();
await mgra.waitForTimeout(400);
await contactBox.getByRole('button', { name: 'Lưu đầu mối' }).click();
const contactToast = await toastText(mgra, 20000);
line(
	/Đã chỉ định Phạm Văn An làm đầu mối/.test(contactToast),
	'FE-09 trưởng phòng chỉ định EMPA1 làm đầu mối',
	contactToast,
);
console.log('ảnh:', await shot(mgra, 'fe-09-contact'));

await go(a1, '/office/supplies');
await a1.waitForTimeout(2500);
// Phòng có nhiều phiếu của nhiều kỳ, nên chọn đúng kỳ của bài trước khi bấm nhận.
await a1
		.locator('button', { hasText: period.title })
		.filter({ hasText: period.officeSite.name })
		.first()
		.click();
await a1.waitForTimeout(2500);
// `exact: true`: nút chọn kỳ cũng chứa chữ "Đã nhận · 3 dòng" nên tìm không chặt là bấm nhầm.
const receiveButton = a1.getByRole('button', { name: 'Đã nhận', exact: true }).first();
line(await receiveButton.count() > 0, 'FE-09 đầu mối thấy nút Đã nhận');
await receiveButton.click();
await a1.waitForTimeout(1500);
const receiveBox = dialog(a1, 'Xác nhận đã nhận hàng');
const receiveRow = receiveBox.locator('tr', { hasText: 'Giấy in A4' }).first();
await receiveRow.locator('input[role="spinbutton"]').first().fill('6');
await receiveRow.locator('input[type="text"]:not([role="spinbutton"])').first().fill('Thiếu 2');
await a1.waitForTimeout(300);
await clearToasts(a1);
await receiveBox.getByRole('button', { name: 'Xác nhận đã nhận', exact: true }).click();
const receiveToast = await toastText(a1, 20000);
line(/Đã ghi nhận hàng/.test(receiveToast), 'FE-09 ghi nhận 6 trên 8 Giấy in A4', receiveToast);
await a1.waitForTimeout(2500);
const a1Received = await text(a1);
line(/Đã nhận/.test(a1Received), 'FE-09 phiếu chuyển sang Đã nhận', a1Received.match(/Đã nhận[^·]{0,40}/)?.[0] ?? '');
console.log('ảnh:', await shot(a1, 'fe-09-received'));

// ─── FE-10: EMPA2 không có nút Đã nhận ────────────────────────────────────────
const a2 = await signIn(browser, WHO.employeeA2.email);
await go(a2, '/office/supplies');
await a2.waitForTimeout(2500);
// `exact: true`: nút chọn kỳ cũng mang chữ "Đã nhận · N dòng", đếm không chặt là đếm nhầm.
const a2ReceiveCount = await a2.getByRole('button', { name: 'Đã nhận', exact: true }).count();
line(a2ReceiveCount === 0, 'FE-10 nhân viên thường không có nút Đã nhận', `${a2ReceiveCount} nút`);
console.log('ảnh:', await shot(a2, 'fe-10-no-receive'));

// ─── FE-11: phiếu bổ sung ─────────────────────────────────────────────────────
await go(hr, `/management/office/supply-periods/${period.id}`);
await clearToasts(hr);
await hr.getByRole('button', { name: 'Phiếu bổ sung' }).first().click();
await hr.waitForTimeout(2500);
const supBox = dialog(hr, 'Phiếu bổ sung');
await supBox.locator('button[id^="ui-select"]').first().click();
await hr.waitForTimeout(400);
await hr.getByRole('button', { name: 'Dịch vụ khách hàng', exact: true }).last().evaluate(el => el.click());
await hr.waitForTimeout(400);
await supBox.locator('input[placeholder*="quyết toán"]').first().fill('Phòng B hết cafe tiếp khách');
await supBox.locator('div[class*="selectTrigger"]').first().click();
await hr.waitForTimeout(400);
await supBox.locator('input[class*="searchInput"]').first().fill('Cafe');
await hr.waitForTimeout(800);
const cafeOption = supBox.locator('[class*="optionLabel"]').first();
const cafeLabel = await cafeOption.innerText().catch(() => '');
line(/chỉ HCNS đặt/i.test(cafeLabel), 'FE-11 ô chọn của HCNS có cả nhóm chỉ HCNS đặt', cafeLabel);
await cafeOption.click();
await hr.waitForTimeout(400);
await supBox.locator('input[role="spinbutton"]').first().fill('2');
await hr.waitForTimeout(300);
await supBox.getByRole('button', { name: 'Tạo phiếu bổ sung' }).click();
const supToast = await toastText(hr, 20000);
line(/Đã tạo phiếu bổ sung/.test(supToast), 'FE-11 tạo phiếu bổ sung cho phòng B', supToast);
await hr.waitForTimeout(2500);
const periodAfterSup = await text(hr);
line(/Bổ sung 1/.test(periodAfterSup), 'FE-11 phiếu bổ sung hiện ở trang kỳ', periodAfterSup.match(/Bổ sung \d[^·]*/)?.[0] ?? '');
console.log('ảnh:', await shot(hr, 'fe-11-supplement'));

const mgrbToken = await apiToken(WHO.managerB.email);
const mgrbNotifs = await api(mgrbToken, '/v1/notifications?page=1&limit=10');
line(
	(mgrbNotifs.json?.data ?? []).some(n => n.type === 'OFFICE_SUPPLY_SUPPLEMENT_CREATED'),
	'FE-11 trưởng phòng B nhận thông báo phiếu bổ sung',
	(mgrbNotifs.json?.data ?? []).map(n => n.type).slice(0, 5).join(', '),
);

// Kỳ còn mở: giao diện không có nút phiếu bổ sung, và máy chủ cũng chặn.
const openPeriod = await api(hrToken, '/v1/office/supply-periods', {
	method: 'POST',
	body: JSON.stringify({
		officeSiteId: period.officeSite.id,
		month: '2027-02',
		deadline: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
		departmentIds: [WHO.employeeB1.departmentId],
	}),
});
const openPeriodId = openPeriod.json?.data?.id;
await go(hr, `/management/office/supply-periods/${openPeriodId}`);
const openPeriodButtons = await text(hr);
line(
	!/Phiếu bổ sung/.test(openPeriodButtons),
	'FE-11 kỳ còn mở thì giao diện không có nút Phiếu bổ sung',
	openPeriodButtons.match(/Xuất Excel|Gia hạn|Khoá sớm/g)?.join(', ') ?? '',
);
const supOnOpen = await api(hrToken, `/v1/office/supply-periods/${openPeriodId}/supplements`, {
	method: 'POST',
	body: JSON.stringify({ departmentId: WHO.employeeB1.departmentId, note: 'thử khi kỳ còn mở', lines: [] }),
});
line(
	supOnOpen.status === 409 || supOnOpen.status === 400,
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
const periodSize = readFileSync(periodFile).length;
line(periodSize > 3000, 'FE-13 tải được file bảng tổng hợp', `${periodSize} byte, ${periodDownload.suggestedFilename()}`);
const periodSheet = execFileSync('unzip', ['-p', periodFile, 'xl/sharedStrings.xml'], { encoding: 'utf8' });
line(
	periodSheet.includes('Tài chính - Kế toán') && periodSheet.includes('Dịch vụ khách hàng'),
	'FE-13 file bảng tổng hợp có cột từng phòng ban như file HCNS',
	periodSheet.match(/Tài chính - Kế toán|Dịch vụ khách hàng/g)?.join(', ') ?? periodSheet.slice(0, 120),
);

await go(hr, '/management/office/reports');
await hr.waitForTimeout(2500);
// Báo cáo mặc định xem tháng này, còn kỳ của bài là tháng chi phí khác, nên chọn đúng tháng.
await selectAt(hr, hr, 0, period.title);
await selectAt(hr, hr, 1, period.title);
await hr.waitForTimeout(2500);
const reportText = await text(hr);
line(/Tổng chi phí/.test(reportText), 'FE-13 báo cáo chi phí mở được', reportText.match(/Tổng chi phí[^đ]*/)?.[0]?.slice(0, 80) ?? '');
// Chi phí tính theo số thực nhận: 6 tập giấy nhân 65.000 là 390.000.
/**
 * Chi phí tính theo SỐ THỰC NHẬN, kiểm ở hai nơi.
 *
 * Không so tổng cả tháng trên màn: sandbox dùng chung nên tháng đó có thể có chi phí của nhiều kỳ,
 * nhiều văn phòng. Kiểm hai điều chắc chắn: thành tiền của DÒNG đúng bằng số thực nhận nhân đơn
 * giá, và số trên màn khớp số máy chủ trả cho cùng bộ lọc.
 */
const paperLine = (await api(hrToken, `/v1/office/supply-requests/${picked.item.id}`)).json?.data?.lines?.find(l =>
	/Giấy in A4/.test(l.name),
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

// MGRA: chỉ thấy phòng mình, không có nút ghi.
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
const mgraWriteButtons = await mgra
	.getByRole('button', { name: /Khoá sớm|Đóng kỳ|Gia hạn|Phiếu bổ sung|Lưu dự trù/ })
	.count();
line(mgraWriteButtons === 0, 'FE-13 trưởng phòng không có nút ghi trên trang kỳ', `${mgraWriteButtons} nút`);
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
	line(page.errors.length === 0, `FE-07..FE-13 không có lỗi JavaScript (${name})`, page.errors.slice(0, 2).join(' | '));
	console.log(`response 4xx của ${name}:`, [...new Set(page.apiErrors)].join(' | ') || 'không có');
}

console.log('sandbox:', API);
await browser.close();
process.exit(summary() ? 1 : 0);
