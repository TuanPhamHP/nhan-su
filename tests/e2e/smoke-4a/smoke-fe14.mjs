/**
 * FE-14, FE-15, FE-16 — uỷ quyền duyệt, tra cứu, xoá nháp và thu hồi.
 */
import {
	api,
	apiToken,
	clean,
	clearToasts,
	go,
	launch,
	line,
	pickerBox,
	pickPerson,
	proposalValues,
	seedRequest,
	shot,
	signIn,
	summary,
	text,
	toastText,
	WHO,
} from './helper4a.mjs';

const browser = await launch();
const kdToken = await apiToken(WHO.kd1.email);
const mkdToken = await apiToken(WHO.mkd.email);
const mktToken = await apiToken(WHO.mkt.email);
const stamp = Date.now() % 100000;
const pick = ids => [{ stepOrder: 1, employeeIds: ids }];

function ymd(offsetDays) {
	const d = new Date();
	d.setDate(d.getDate() + offsetDays);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dmy(offsetDays) {
	const [y, m, d] = ymd(offsetDays).split('-');
	return `${d}/${m}/${y}`;
}

// Dọn uỷ quyền cũ của QLKT để chạy lại bài này nhiều lần vẫn cùng một tình huống.
const existing = await api(mktToken, '/v1/approval-delegations');
for (const d of existing.json?.data ?? []) {
	if (d.isMine) await api(mktToken, `/v1/approval-delegations/${d.id}`, { method: 'DELETE' });
}

// ════════════════════════ FE-14: uỷ quyền duyệt ════════════════════════
const mkt = await signIn(browser, WHO.mkt.email);
await go(mkt, '/profile?tab=delegations', 4500);
let body = await text(mkt);
line(body.includes('Uỷ quyền duyệt'), 'FE-14a trang cá nhân có tab Uỷ quyền duyệt');
line(body.includes('Bạn chưa uỷ quyền duyệt cho ai'), 'FE-14a chưa có uỷ quyền nào thì nói rõ', body.slice(0, 200));
line(
	body.includes('Bước đã tới lượt bạn trước khi lập uỷ quyền thì vẫn chờ bạn'),
	'FE-14a khối nói trước giới hạn của uỷ quyền',
);
await shot(mkt, 'FE-14a-khoi-uy-quyen');

await mkt.getByRole('button', { name: 'Lập uỷ quyền' }).click();
await mkt.waitForTimeout(1200);
const form = mkt.locator('div.fixed.inset-0').filter({ hasText: 'Lập uỷ quyền duyệt' }).last();
line(await form.isVisible(), 'FE-14b hộp thoại lập uỷ quyền mở ra');
const delegateBox = pickerBox(form, 'Người nhận uỷ quyền');
line(await pickPerson(delegateBox, mkt, WHO.ch.name), 'FE-14b chọn được người nhận uỷ quyền');
const dates = form.locator('input[placeholder="dd/mm/yyyy"]');
await dates.nth(0).fill(dmy(0));
await dates.nth(0).press('Tab');
await dates.nth(1).fill(dmy(2));
await dates.nth(1).press('Tab');
await form.locator('textarea').fill('Đi công tác ba ngày.');
await clearToasts(mkt);
await form.getByRole('button', { name: 'Lập uỷ quyền' }).click();
let toast = await toastText(mkt, 20000);
line(/Đã lập uỷ quyền duyệt/.test(toast), 'FE-14b lập được uỷ quyền ba ngày', toast);
await mkt.waitForTimeout(2000);
body = await text(mkt);
line(body.includes(WHO.ch.name), 'FE-14b uỷ quyền vừa lập hiện trong danh sách', body.slice(0, 300));
line(body.includes('Đi công tác ba ngày'), 'FE-14b ghi chú hiện kèm');
await shot(mkt, 'FE-14b-da-lap-uy-quyen');

const mine = await api(mktToken, '/v1/approval-delegations');
const created = (mine.json?.data ?? []).find(d => d.isMine && d.delegate.id === WHO.ch.id);
line(!!created, 'FE-14b máy chủ lưu uỷ quyền', JSON.stringify(created ?? {}));

// Trùng khoảng ngày: máy chủ chặn, hộp thoại hiện nguyên văn câu lỗi.
await mkt.getByRole('button', { name: 'Lập uỷ quyền' }).click();
await mkt.waitForTimeout(1200);
const form2 = mkt.locator('div.fixed.inset-0').filter({ hasText: 'Lập uỷ quyền duyệt' }).last();
const delegateBox2 = pickerBox(form2, 'Người nhận uỷ quyền');
await pickPerson(delegateBox2, mkt, WHO.ch.name);
const dates2 = form2.locator('input[placeholder="dd/mm/yyyy"]');
await dates2.nth(0).fill(dmy(1));
await dates2.nth(0).press('Tab');
await dates2.nth(1).fill(dmy(3));
await dates2.nth(1).press('Tab');
await clearToasts(mkt);
await form2.getByRole('button', { name: 'Lập uỷ quyền' }).click();
await mkt.waitForTimeout(2500);
const overlapText = clean(await form2.innerText());
toast = await toastText(mkt, 8000);
line(
	/chồng|đã có|trùng/i.test(overlapText + toast),
	'FE-14c trùng khoảng ngày bị chặn, câu lỗi của máy chủ hiện trong hộp thoại',
	`${overlapText.slice(-220)} | ${toast}`,
);
await shot(mkt, 'FE-14c-trung-khoang-ngay');
await form2.getByRole('button', { name: 'Hủy' }).click();
await mkt.waitForTimeout(800);

// Người được uỷ quyền thấy ở phần "người khác uỷ quyền cho tôi".
const ch = await signIn(browser, WHO.ch.email);
await go(ch, '/profile?tab=delegations', 4500);
const chText = await text(ch);
line(chText.includes('Người khác uỷ quyền cho tôi'), 'FE-14d người nhận có phần uỷ quyền nhận được');
line(chText.includes(WHO.mkt.name), 'FE-14d người nhận thấy tên người uỷ quyền', chText.slice(0, 300));
line(
	chText.includes('chỉ người lập mới huỷ được'),
	'FE-14d nói rõ người nhận không huỷ được uỷ quyền của người khác',
	chText.slice(0, 300),
);
await shot(ch, 'FE-14d-nguoi-nhan-uy-quyen');

// Huỷ uỷ quyền của mình.
await go(mkt, '/profile?tab=delegations', 4000);
await clearToasts(mkt);
await mkt.getByRole('button', { name: 'Huỷ uỷ quyền' }).first().click();
toast = await toastText(mkt, 20000);
line(/Đã huỷ uỷ quyền/.test(toast), 'FE-14e huỷ được uỷ quyền của mình', toast);
await mkt.waitForTimeout(2000);
line((await text(mkt)).includes('Bạn chưa uỷ quyền duyệt cho ai'), 'FE-14e danh sách trở về rỗng');
const afterCancel = await api(mktToken, '/v1/approval-delegations');
line(
	!(afterCancel.json?.data ?? []).some(d => d.isMine),
	'FE-14e máy chủ không còn uỷ quyền nào của người này',
);
await shot(mkt, 'FE-14e-da-huy-uy-quyen');

// ════════════════════════ FE-15: tra cứu ════════════════════════
const target = await seedRequest(kdToken, {
	title: `FE-15 phiếu tra cứu ${stamp}`,
	pickedApprovers: pick([WHO.mkd.id]),
});
const draftOfKd = await seedRequest(kdToken, { title: `FE-15 nháp riêng ${stamp}` });

const hr = await signIn(browser, WHO.hr.email);
await go(hr, '/general-requests?tab=search', 5000);
body = await text(hr);
line(body.includes('Tra cứu'), 'FE-15a nhân sự mở được tab Tra cứu');
line(body.includes('Người gửi') && body.includes('Người duyệt'), 'FE-15a có ô lọc người gửi và người duyệt');
await shot(hr, 'FE-15a-tab-tra-cuu');

// Theo số hiệu
await hr.locator('label:has-text("Số hiệu")').first().locator('xpath=following::input[1]').fill(target.code);
await hr.getByRole('button', { name: 'Tra cứu' }).click();
await hr.waitForTimeout(3500);
body = await text(hr);
line(body.includes(target.code), 'FE-15b tra theo số hiệu ra đúng phiếu', target.code);
line(/Tìm thấy 1 phiếu/.test(body), 'FE-15b chỉ một kết quả', body.match(/Tìm thấy \d+ phiếu/)?.[0] ?? '');
await shot(hr, 'FE-15b-tra-theo-so-hieu');

// Theo tiêu đề
await hr.getByRole('button', { name: 'Xoá bộ lọc' }).click();
await hr.waitForTimeout(2500);
await hr.locator('label:has-text("Tiêu đề hoặc số hiệu")').first().locator('xpath=following::input[1]').fill(`FE-15 phiếu tra cứu ${stamp}`);
await hr.getByRole('button', { name: 'Tra cứu' }).click();
await hr.waitForTimeout(3500);
body = await text(hr);
line(body.includes(target.code), 'FE-15c tra theo tiêu đề ra đúng phiếu');

// Theo người duyệt
await hr.getByRole('button', { name: 'Xoá bộ lọc' }).click();
await hr.waitForTimeout(2500);
const approverTrigger = await hr.locator('label:text-is("Người duyệt")').first().getAttribute('for');
await hr.locator(`#${approverTrigger}`).click();
await hr.waitForTimeout(600);
const approverOption = hr.getByRole('button', { name: new RegExp(`^${WHO.mkd.name}`) }).last();
await approverOption.evaluate(el => el.click());
await hr.waitForTimeout(600);
await hr.getByRole('button', { name: 'Tra cứu' }).click();
await hr.waitForTimeout(3500);
body = await text(hr);
const foundCount = Number(body.match(/Tìm thấy (\d+) phiếu/)?.[1] ?? '0');
line(foundCount > 0 && body.includes(target.code), 'FE-15d tra theo người duyệt ra phiếu của người đó', `${foundCount} phiếu`);
await shot(hr, 'FE-15d-tra-theo-nguoi-duyet');

// Phân trang: bỏ hết lọc thì sandbox có nhiều hơn một trang.
await hr.getByRole('button', { name: 'Xoá bộ lọc' }).click();
await hr.waitForTimeout(3500);
body = await text(hr);
const total = Number(body.match(/Tìm thấy (\d+) phiếu/)?.[1] ?? '0');
line(total > 20, 'FE-15e không lọc thì có nhiều hơn một trang', `${total} phiếu`);
const pager = hr.locator('nav, div').filter({ hasText: /^\s*1\s*2/ }).last();
const pageTwo = hr.getByRole('button', { name: '2', exact: true }).first();
if (await pageTwo.count()) {
	await pageTwo.click();
	await hr.waitForTimeout(3500);
	line(true, 'FE-15e bấm được trang 2', clean(await hr.locator('body').innerText()).match(/Tìm thấy \d+ phiếu/)?.[0] ?? '');
} else {
	line(false, 'FE-15e bấm được trang 2', 'không thấy nút trang 2');
}
await shot(hr, 'FE-15e-phan-trang');

// Nháp của người khác không lọt vào kết quả của nhân sự.
await hr.getByRole('button', { name: 'Xoá bộ lọc' }).click();
await hr.waitForTimeout(2500);
await hr.locator('label:has-text("Tiêu đề hoặc số hiệu")').first().locator('xpath=following::input[1]').fill(`FE-15 nháp riêng ${stamp}`);
await hr.getByRole('button', { name: 'Tra cứu' }).click();
await hr.waitForTimeout(3500);
body = await text(hr);
line(
	body.includes('Không có phiếu nào khớp bộ lọc này'),
	'FE-15f nhân sự không thấy nháp của người khác',
	body.slice(0, 260),
);
const hrSearch = await api(await apiToken(WHO.hr.email), `/v1/general-requests?q=FE-15 nháp riêng ${stamp}`);
line(
	(hrSearch.json?.data ?? []).length === 0,
	'FE-15f máy chủ cũng không trả nháp của người khác',
	String((hrSearch.json?.data ?? []).length),
);
await shot(hr, 'FE-15f-khong-thay-nhap-nguoi-khac');

// ════════════════════════ FE-16: xoá nháp, thu hồi ════════════════════════
const kd = await signIn(browser, WHO.kd1.email);
await go(kd, `/general-requests/${draftOfKd.id}`, 4500);
body = await text(kd);
line(body.includes('Xoá nháp'), 'FE-16a phiếu nháp có nút xoá nháp');
await kd.getByRole('button', { name: 'Xoá nháp', exact: true }).first().click();
await kd.waitForTimeout(1200);
const deleteBox = kd.locator('div.fixed.inset-0').filter({ hasText: 'Xoá phiếu nháp' }).last();
line(
	clean(await deleteBox.innerText()).includes('sẽ bị xoá hẳn và không lấy lại được'),
	'FE-16a hộp thoại nói rõ xoá là mất hẳn',
);
await clearToasts(kd);
await deleteBox.getByRole('button', { name: 'Xoá nháp' }).click();
toast = await toastText(kd, 20000);
line(/Đã xoá phiếu nháp/.test(toast), 'FE-16a xoá được nháp', toast);
await kd.waitForTimeout(2500);
line(kd.url().endsWith('/general-requests'), 'FE-16a xoá xong về danh sách', kd.url());
const deleted = await api(kdToken, `/v1/general-requests/${draftOfKd.id}`);
line(deleted.status === 404, 'FE-16a máy chủ không còn phiếu nháp đó', `status=${deleted.status}`);
await shot(kd, 'FE-16a-da-xoa-nhap');

// Thu hồi phiếu chưa ai duyệt
const forCancel = await seedRequest(kdToken, { title: `FE-16 thu hồi ${stamp}`, pickedApprovers: pick([WHO.mkd.id]) });
await go(kd, `/general-requests/${forCancel.id}`, 4500);
await kd.getByRole('button', { name: 'Thu hồi', exact: true }).first().click();
await kd.waitForTimeout(1200);
const cancelBox = kd.locator('div.fixed.inset-0').filter({ hasText: 'Thu hồi phiếu' }).last();
await clearToasts(kd);
await cancelBox.getByRole('button', { name: 'Thu hồi phiếu' }).click();
toast = await toastText(kd, 20000);
line(/Đã thu hồi phiếu/.test(toast), 'FE-16b thu hồi được phiếu chưa ai duyệt', toast);
await kd.waitForTimeout(2000);
line((await text(kd)).includes('Đã thu hồi'), 'FE-16b phiếu chuyển trạng thái đã thu hồi');
await shot(kd, 'FE-16b-da-thu-hoi');

// Phiếu đã có người đồng ý thì không thu hồi được nữa
const twoStep = await seedRequest(kdToken, {
	title: `FE-16 đã có người đồng ý ${stamp}`,
	pickedApprovers: pick([WHO.mkd.id, WHO.ch.id]),
});
const approved = await api(mkdToken, `/v1/general-requests/${twoStep.id}/approve`, {
	method: 'PATCH',
	body: JSON.stringify({ note: 'Đồng ý bước một.' }),
});
line(approved.status === 200, 'FE-16c dựng được phiếu đã qua một lượt đồng ý', `status=${approved.status}`);
await go(kd, `/general-requests/${twoStep.id}`, 4500);
body = await text(kd);
line(
	body.includes('Phiếu đã có người đồng ý ở vòng này nên không thu hồi được nữa'),
	'FE-16c trang nói rõ vì sao không thu hồi được và phải làm gì',
	body.slice(0, 400),
);
line(!/\bThu hồi\b/.test(body), 'FE-16c không còn nút thu hồi');
const cancelApi = await api(kdToken, `/v1/general-requests/${twoStep.id}/cancel`, { method: 'PATCH', body: '{}' });
line(cancelApi.status === 409, 'FE-16c máy chủ cũng chặn thu hồi bằng 409', `status=${cancelApi.status} ${cancelApi.json?.error?.code}`);
await shot(kd, 'FE-16c-khong-thu-hoi-duoc');

console.log('\nlỗi console:', [...mkt.errors, ...hr.errors, ...kd.errors].filter(e => !e.includes('Failed to load resource') && !e.includes('sandboxed')).slice(0, 5));
process.exitCode = summary() ? 1 : 0;
await browser.close();
