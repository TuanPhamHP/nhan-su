/**
 * FE-50: HCNS huỷ một kỳ đã gửi thông báo, rồi phòng bấm thông báo cũ.
 *
 * Trước đây phiếu đã mất mà trang vẫn mở kỳ KHÁC ra, nên trưởng phòng tưởng mình đang xem kỳ
 * trong thông báo và sửa số của một kỳ không liên quan. Thông báo huỷ kỳ thì không mang refId
 * (phiếu đã bị xoá cùng kỳ), nên chuông phải mở trang phiếu chung.
 */
import {
	WHO,
	api,
	apiToken,
	go,
	launch,
	line,
	shot,
	signIn,
	summary,
	text,
	toastText,
	ymd,
} from './helper.mjs';

const hrToken = await apiToken(WHO.hr.email);
const a1Token = await apiToken(WHO.employeeA1.email);

const sites = (await api(hrToken, '/v1/office/sites')).json?.data ?? [];
const site = sites[0];
if (!site) throw new Error('sandbox chưa có văn phòng — chạy smoke-settings.mjs trước');

const periods = (await api(hrToken, '/v1/office/supply-periods')).json?.data ?? [];
const taken = new Set(periods.filter(p => p.officeSite.id === site.id).map(p => p.month));
let month = null;
for (let offset = 1; offset <= 24 && !month; offset++) {
	const at = new Date();
	const candidate = new Date(at.getFullYear(), at.getMonth() + offset, 1);
	const value = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}`;
	if (!taken.has(value)) month = value;
}
if (!month) throw new Error('không còn tháng trống để mở kỳ cho bài này');

const created = await api(hrToken, '/v1/office/supply-periods', {
	method: 'POST',
	body: JSON.stringify({
		officeSiteId: site.id,
		month,
		deadline: ymd(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)),
		departmentIds: [WHO.employeeA1.departmentId],
	}),
});
if (created.status >= 400) throw new Error(`không mở được kỳ: ${created.status} ${created.text.slice(0, 200)}`);
const period = created.json.data;
const request = ((await api(a1Token, '/v1/me/office/supply-requests')).json?.data ?? []).find(
	r => r.period.id === period.id,
);
if (!request) throw new Error('phòng A không có phiếu trong kỳ vừa mở');
console.log(`kỳ sẽ bị huỷ: ${period.title} (id ${period.id}), phiếu ${request.id}`);

const browser = await launch();

// ─── HCNS huỷ kỳ ngay trên giao diện ──────────────────────────────────────────
const hr = await signIn(browser, WHO.hr.email);
await go(hr, `/management/office/supply-periods/${period.id}`, 4500);
await hr.getByRole('button', { name: 'Huỷ kỳ', exact: true }).first().click();
await hr.waitForTimeout(1000);
const confirmText = (await text(hr)).replace(/\s+/g, ' ');
line(
	confirmText.includes('biến mất khỏi danh sách'),
	'FE-50 huỷ kỳ có hộp hỏi lại nói rõ kỳ và phiếu rỗng sẽ mất',
	confirmText.match(/Huỷ kỳ[^.]*\./)?.[0]?.slice(0, 180) ?? '',
);
await hr.getByRole('button', { name: 'Huỷ kỳ này' }).first().click();
const cancelToast = await toastText(hr, 20000);
line(/Đã huỷ kỳ/.test(cancelToast), 'FE-50 huỷ được kỳ', cancelToast);
await hr.waitForTimeout(2500);
line(
	hr.url().endsWith('/management/office/supply-periods'),
	'FE-50 sau khi huỷ thì về danh sách kỳ, không ở lại trang trống',
	hr.url(),
);
console.log('ảnh:', await shot(hr, 'fe-50-period-cancelled'));

const gone = await api(hrToken, `/v1/office/supply-periods/${period.id}`);
line(gone.status === 404, 'FE-50 máy chủ xác nhận kỳ đã biến mất', `status ${gone.status}`);

// ─── Phòng bấm thông báo cũ: phiếu không còn ──────────────────────────────────
const a1 = await signIn(browser, WHO.employeeA1.email);
await go(a1, `/office/supplies?request_id=${request.id}`, 4500);
const staleToast = await toastText(a1, 10000);
line(
	/Phiếu này không còn, có thể kỳ đã bị HCNS huỷ/.test(staleToast),
	'FE-50 bấm thông báo của kỳ đã huỷ thì nói thẳng phiếu không còn',
	staleToast,
);
const pageText = (await text(a1)).replace(/\s+/g, ' ');
line(
	!pageText.includes('Thêm mặt hàng'),
	'FE-50 KHÔNG mở kỳ khác ra, nên không ai sửa số của kỳ không liên quan',
	pageText.slice(0, 180),
);
line(a1.url().endsWith('/office/supplies'), 'FE-50 query request_id đã được dọn khỏi URL', a1.url());
line(
	!/Bạn thử lại sau ít phút/.test(staleToast),
	'FE-50 không bảo người dùng thử lại một việc không bao giờ chạy được nữa',
	staleToast,
);
console.log('ảnh:', await shot(a1, 'fe-50-stale-request'));

// ─── Thông báo huỷ kỳ trong chuông: mở trang phiếu chung ──────────────────────
await go(a1, '/management', 3500);
await a1.locator('button[title="Thông báo"]').first().click();
await a1.waitForTimeout(2500);
const panelText = (await text(a1)).replace(/\s+/g, ' ');
line(
	/huỷ|hủy/i.test(panelText) && /văn phòng phẩm/i.test(panelText),
	'FE-50 chuông của phòng có thông báo huỷ kỳ',
	panelText.match(/[^.]*văn phòng phẩm[^.]*/)?.[0]?.slice(0, 180) ?? '',
);
console.log('ảnh:', await shot(a1, 'fe-50-cancel-notification'));
const cancelItem = a1.locator('p,div', { hasText: /đã huỷ kỳ|đã hủy kỳ|huỷ kỳ đăng ký/i }).last();
if (await cancelItem.count()) {
	await cancelItem.click();
	await a1.waitForTimeout(3500);
	line(
		a1.url().endsWith('/office/supplies'),
		'FE-50 thông báo huỷ kỳ không mang refId nên mở trang phiếu chung',
		a1.url(),
	);
	line(
		!(await text(a1)).includes('Chưa mở được phiếu này'),
		'FE-50 mở trang phiếu chung không sinh lỗi nào',
	);
	console.log('ảnh:', await shot(a1, 'fe-50-cancel-notification-opened'));
} else {
	line(false, 'FE-50 không tìm thấy thông báo huỷ kỳ trong chuông để bấm', panelText.slice(0, 200));
}

for (const [name, page] of [
	['HCNS', hr],
	['EMPA1', a1],
]) {
	line(page.errors.length === 0, `FE-50 không có lỗi JavaScript (${name})`, page.errors.slice(0, 2).join(' | '));
	console.log(`response 4xx của ${name}:`, [...new Set(page.apiErrors)].join(' | ') || 'không có');
}

await browser.close();
process.exit(summary() ? 1 : 0);
