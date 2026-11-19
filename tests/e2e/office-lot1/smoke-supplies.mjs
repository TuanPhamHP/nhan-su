/**
 * FE-05, FE-06: nhân viên nhập phiếu của phòng.
 *
 * FE-05 đi từ chuông thông báo: bấm vào thông báo "mở kỳ" phải mở đúng phiếu của phòng người
 * bấm, rồi nhập vài dòng, trong đó một dòng vượt định mức và một dòng ngoài danh mục.
 * FE-06 mở link phiếu của phòng khác.
 */
import {
	WHO,
	api,
	apiToken,
	clearToasts,
	go,
	launch,
	line,
	pickSearchable,
	shot,
	signIn,
	summary,
	text,
	toastText,
} from './helper.mjs';

/**
 * Bài cần một kỳ CÒN MỞ (phòng mới nhập được phiếu), nên lấy kỳ mở mới nhất chứ không lấy kỳ
 * mới nhất theo id: các bài khác khoá rồi đóng kỳ của chúng, nên kỳ mới nhất thường đã đóng.
 */
const hrTokenForPeriod = await apiToken(WHO.hr.email);
const periodList = await api(hrTokenForPeriod, '/v1/office/supply-periods');
const newestPeriod = (periodList.json?.data ?? [])
	.filter(p => p.status === 'OPEN')
	.sort((a, b) => b.id - a.id)[0];
if (!newestPeriod) {
	throw new Error('không còn kỳ nào đang mở — chạy smoke-period-open.mjs để mở một kỳ trước');
}
console.log(`bài làm việc trên kỳ ${newestPeriod.title}`);

// Kỳ mở có thể còn dòng của lần chạy trước, mà cùng mặt hàng thì máy chủ không cho thêm hai lần.
// Dọn dòng cũ của phòng A qua API trước khi bấm, để các bước dưới luôn bắt đầu từ phiếu rỗng.
const a1Token = await apiToken(WHO.employeeA1.email);
const myRequests = await api(a1Token, '/v1/me/office/supply-requests');
const myRequest = (myRequests.json?.data ?? []).find(r => r.period?.id === newestPeriod.id);
if (!myRequest) throw new Error(`phòng A không có phiếu trong kỳ ${newestPeriod.title}`);
const myRequestDetail = await api(a1Token, `/v1/me/office/supply-requests/${myRequest.id}`);
for (const old of myRequestDetail.json?.data?.lines ?? []) {
	await api(a1Token, `/v1/me/office/supply-requests/${myRequest.id}/lines/${old.id}`, {
		method: 'DELETE',
	});
}
console.log(`dọn ${(myRequestDetail.json?.data?.lines ?? []).length} dòng cũ của phiếu ${myRequest.id}`);

const browser = await launch();

// ─── FE-05: EMPA1 mở phiếu từ chuông thông báo ────────────────────────────────
const a1 = await signIn(browser, WHO.employeeA1.email);
await go(a1, '/management');
await a1.locator('button[title="Thông báo"]').first().click();
await a1.waitForTimeout(2500);
const panelText = await text(a1);
line(
	/văn phòng phẩm/i.test(panelText),
	'FE-05 chuông thông báo có thông báo mở kỳ văn phòng phẩm',
	panelText.slice(0, 200),
);
console.log('ảnh:', await shot(a1, 'fe-05-notification'));

// Chuông đã có hàng chục thông báo của các bài trước, nên bấm thông báo văn phòng phẩm mới nhất
// đang hiện trong khung, rồi chọn kỳ của bài bằng tab kỳ ở trang phiếu.
const notifItem = a1.locator('p,div', { hasText: /văn phòng phẩm/i }).last();
await notifItem.click();
await a1.waitForTimeout(3500);
line(
	a1.url().includes('/office/supplies'),
	'FE-05 bấm thông báo mở trang phiếu văn phòng phẩm',
	a1.url(),
);
const periodTab = a1
	.locator('button', { hasText: newestPeriod.title })
	.filter({ hasText: newestPeriod.officeSite.name })
	.first();
if (await periodTab.count()) {
	await periodTab.click();
	await a1.waitForTimeout(2500);
}
const openedText = await text(a1);
line(
	openedText.includes('Tài chính - Kế toán') && openedText.includes(newestPeriod.title),
	'FE-05 mở đúng phiếu của phòng mình',
	openedText.slice(0, 250),
);
console.log('ảnh:', await shot(a1, 'fe-05-request-open'));

// Ô chọn mặt hàng không được có nhóm chỉ HCNS đặt.
const addBox = a1.locator('section', { hasText: 'Thêm mặt hàng' }).first();
await addBox.locator('div[class*="selectTrigger"]').first().click();
await a1.waitForTimeout(600);
const optionsText = await a1.locator('div[class*="dropdown"]').first().innerText();
line(
	!/Đồ uống|Vật dụng sử dụng vệ sinh/.test(optionsText),
	'FE-05 ô chọn không có nhóm Đồ uống và Vật dụng vệ sinh',
	optionsText.split('\n').slice(0, 4).join(' / '),
);
await a1.keyboard.press('Escape');
await a1.waitForTimeout(400);

/** Thêm một dòng vào phiếu: chọn mặt hàng, nhập số, bấm Thêm dòng. */
async function addLine(page, query, optionText, qty) {
	await clearToasts(page);
	const box = page.locator('section', { hasText: 'Thêm mặt hàng' }).first();
	await pickSearchable(box, page, 0, query, optionText);
	await box.locator('input[role="spinbutton"]').first().fill(String(qty));
	await page.waitForTimeout(300);
	await box.getByRole('button', { name: 'Thêm dòng' }).click();
	return toastText(page, 15000);
}

const pen = await addLine(a1, 'Bút bi', 'Bút bi', 10);
line(/Đã thêm dòng/.test(pen), 'FE-05 thêm dòng bút bi', pen);

// Giấy in A4 định mức 5, xin 8 nên máy chủ bắt ghi lý do.
const paper = await addLine(a1, 'Giấy in A4', 'Giấy in A4', 8);
await a1.waitForTimeout(1200);
const addSection = a1.locator('section', { hasText: 'Thêm mặt hàng' }).first();
const quotaWarning = await addSection.innerText();
line(
	/Lý do vượt định mức/.test(quotaWarning),
	'FE-05 xin vượt định mức thì mở ô lý do ngay tại form',
	`${paper} | ${quotaWarning.replace(/\s+/g, ' ').slice(0, 160)}`,
);
console.log('ảnh:', await shot(a1, 'fe-05-over-quota'));

await addSection.locator('input[placeholder*="quyết toán"]').first().fill('Tháng này quyết toán, in nhiều');
await a1.waitForTimeout(300);
await addSection.getByRole('button', { name: 'Thêm dòng' }).click();
const paperOk = await toastText(a1, 15000);
line(/Đã thêm dòng/.test(paperOk), 'FE-05 có lý do thì thêm được dòng vượt định mức', paperOk);
await a1.waitForTimeout(1500);
const afterPaper = await text(a1);
line(
	/Vượt định mức|Lý do vượt định mức/.test(afterPaper),
	'FE-05 dòng vượt định mức hiện lý do trên phiếu',
	afterPaper.match(/Vượt định mức[^·]*/)?.[0]?.slice(0, 120) ?? '',
);

// Dòng ngoài danh mục.
await clearToasts(a1);
const customToggle = a1.getByRole('button', { name: /Mặt hàng không có trong danh mục/ }).first();
await customToggle.click();
await a1.waitForTimeout(500);
const customBox = a1.locator('section', { hasText: 'Thêm mặt hàng' }).first();
await customBox.locator('input[placeholder*="Pin 3A"]').first().fill('Pin 3A');
await customBox.locator('input[placeholder*="Đôi"]').first().fill('Đôi');
await customBox.locator('input[role="spinbutton"]').last().fill('3');
await a1.waitForTimeout(300);
await customBox.getByRole('button', { name: 'Thêm', exact: true }).click();
const customToast = await toastText(a1, 15000);
line(/Đã thêm mặt hàng ngoài danh mục/.test(customToast), 'FE-05 thêm dòng ngoài danh mục Pin 3A', customToast);
await a1.waitForTimeout(1500);
console.log('ảnh:', await shot(a1, 'fe-05-lines'));

// ─── FE-05: EMPA2 sửa một dòng, phiếu ghi "sửa cuối bởi" ──────────────────────
const a2 = await signIn(browser, WHO.employeeA2.email);
await go(a2, '/office/supplies');
await a2.waitForTimeout(2500);
// Phòng có phiếu của nhiều kỳ, nên chọn đúng kỳ của bài trước khi sửa dòng.
await a2
	.locator('button', { hasText: newestPeriod.title })
	.filter({ hasText: newestPeriod.officeSite.name })
	.first()
	.click();
await a2.waitForTimeout(2500);
const penRow = a2.locator('div.p-4', { hasText: 'Bút bi' }).first();
await penRow.locator('input[role="spinbutton"]').first().fill('12');
await a2.waitForTimeout(500);
await penRow.getByRole('button', { name: 'Lưu', exact: true }).click();
const editToast = await toastText(a2, 15000);
line(/Đã lưu dòng/.test(editToast), 'FE-05 EMPA2 sửa được dòng của phòng', editToast);
await a2.waitForTimeout(1500);
const a2Text = await text(a2);
line(
	a2Text.includes(`sửa cuối bởi ${WHO.employeeA2.fullName}`),
	'FE-05 dòng hiện "sửa cuối bởi Hoàng Thị Bình"',
	a2Text.match(/sửa cuối bởi [^·]*/)?.[0]?.slice(0, 80) ?? '',
);
console.log('ảnh:', await shot(a2, 'fe-05-updated-by'));

// ─── FE-06: EMPB1 mở link phiếu của phòng A ───────────────────────────────────
const requestA = myRequest.id;
line(!!requestA, 'FE-06 đọc được id phiếu phòng A để dựng link', `request ${requestA}`);

const b1 = await signIn(browser, WHO.employeeB1.email);
await go(b1, `/office/supplies?request_id=${requestA}`);
await b1.waitForTimeout(3000);
const b1Toast = await toastText(b1, 8000);
const b1Text = await text(b1);
// Câu hiện lên là câu của máy chủ ("Đây là phiếu của phòng khác…"), không phải câu dự phòng của FE.
line(
	/phòng khác|phòng mình|phòng bạn/i.test(b1Toast),
	'FE-06 báo rõ phiếu không phải của phòng mình',
	b1Toast,
);
line(
	b1Text.includes('Văn phòng phẩm của phòng'),
	'FE-06 không trắng trang, vẫn ở trang phiếu của phòng mình',
	b1Text.slice(0, 160),
);
line(b1.url().endsWith('/office/supplies'), 'FE-06 query request_id đã được dọn khỏi URL', b1.url());
console.log('ảnh:', await shot(b1, 'fe-06-other-department'));

for (const [name, page] of [
	['EMPA1', a1],
	['EMPA2', a2],
	['EMPB1', b1],
]) {
	line(page.errors.length === 0, `FE-05/FE-06 không có lỗi JavaScript (${name})`, page.errors.slice(0, 2).join(' | '));
	console.log(`response 4xx của ${name}:`, [...new Set(page.apiErrors)].join(' | ') || 'không có');
}

await browser.close();
process.exit(summary() ? 1 : 0);
