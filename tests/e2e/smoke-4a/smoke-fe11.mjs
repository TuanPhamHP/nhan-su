/**
 * FE-11, FE-12, FE-13 — quản trị viên duyệt thay, nhân sự đổi người duyệt, và phiếu không
 * được phép xem.
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
const adminToken = await apiToken(WHO.admin.email);
const hrToken = await apiToken(WHO.hr.email);
const chToken = await apiToken(WHO.ch.email);
const stamp = Date.now() % 100000;
const pick = ids => [{ stepOrder: 1, employeeIds: ids }];

const forOverride = await seedRequest(kdToken, { title: `FE-11 duyệt thay ${stamp}`, pickedApprovers: pick([WHO.mkd.id]) });
const adminOwn = await seedRequest(adminToken, { title: `FE-11 phiếu của admin ${stamp}`, pickedApprovers: pick([WHO.mkd.id]) });
const forReassign = await seedRequest(kdToken, { title: `FE-12 đổi người duyệt ${stamp}`, pickedApprovers: pick([WHO.mkd.id]) });
const forHidden = await seedRequest(kdToken, { title: `FE-13 phiếu riêng ${stamp}`, pickedApprovers: pick([WHO.mkd.id]) });
line(true, 'dựng xong bốn phiếu', [forOverride, adminOwn, forReassign, forHidden].map(r => r.code).join(', '));

// ════════════════════════ FE-11: quản trị viên duyệt thay ════════════════════════
const admin = await signIn(browser, WHO.admin.email);
await go(admin, `/general-requests/${forOverride.id}`, 4500);
let detail = await text(admin);
line(detail.includes('Duyệt thay'), 'FE-11a quản trị viên thấy nút duyệt thay ở phiếu người khác');
line(!detail.includes('Đồng ý phiếu'), 'FE-11a quản trị viên không có nút đồng ý thường vì không giữ lượt');
await shot(admin, 'FE-11a-nut-duyet-thay');

await admin.getByRole('button', { name: 'Duyệt thay', exact: true }).first().click();
await admin.waitForTimeout(1200);
const overrideBox = admin.locator('div.fixed.inset-0').filter({ hasText: 'Duyệt thay' }).last();
line(
	clean(await overrideBox.innerText()).includes('Quản trị viên quyết định thay người đang giữ lượt'),
	'FE-11b hộp thoại nói rõ việc này được ghi vào nhật ký',
);
await overrideBox.locator('textarea').fill('Gấp');
await overrideBox.getByRole('button', { name: 'Duyệt thay' }).click();
await admin.waitForTimeout(1000);
line(
	/ít nhất năm ký tự/.test(clean(await overrideBox.innerText())),
	'FE-11b lý do ngắn hơn năm ký tự bị chặn',
	clean(await overrideBox.innerText()).slice(-200),
);

await overrideBox.locator('textarea').fill('Trưởng phòng đi công tác, giám đốc đã đồng ý qua điện thoại.');
await clearToasts(admin);
await overrideBox.getByRole('button', { name: 'Duyệt thay' }).click();
let toast = await toastText(admin, 20000);
line(/Đã duyệt thay/.test(toast), 'FE-11b duyệt thay có lý do thì thành công', toast);
await admin.waitForTimeout(2000);
detail = await text(admin);
line(detail.includes('Đã duyệt'), 'FE-11b phiếu chuyển sang đã duyệt', detail.slice(0, 240));
line(detail.includes('Trưởng phòng đi công tác'), 'FE-11b lý do duyệt thay nằm trong nhật ký');
line(/duyệt thay/i.test(detail), 'FE-11b nhật ký ghi rõ đây là duyệt thay');
await shot(admin, 'FE-11b-da-duyet-thay');

const overridden = await api(adminToken, `/v1/general-requests/${forOverride.id}`);
line(overridden.json?.data?.status === 'APPROVED', 'FE-11b máy chủ ghi phiếu đã duyệt', String(overridden.json?.data?.status));
line(
	(overridden.json?.data?.timeline ?? []).some(e => e.action === 'OVERRIDE'),
	'FE-11b nhật ký máy chủ có mục duyệt thay',
);

await go(admin, `/general-requests/${adminOwn.id}`, 4000);
detail = await text(admin);
line(detail.includes(adminOwn.code), 'FE-11c quản trị viên mở được phiếu của chính mình', adminOwn.code);
line(!detail.includes('Duyệt thay'), 'FE-11c không có nút duyệt thay ở phiếu của chính mình');
line(detail.includes('Thu hồi'), 'FE-11c phiếu của mình thì có nút thu hồi');
const ownFlags = await api(adminToken, `/v1/general-requests/${adminOwn.id}`);
line(ownFlags.json?.data?.canOverride === false, 'FE-11c cờ canOverride của phiếu mình là false');
await shot(admin, 'FE-11c-phieu-cua-chinh-minh');

// ════════════════════════ FE-12: nhân sự đổi người duyệt ════════════════════════
const hr = await signIn(browser, WHO.hr.email);
await go(hr, `/general-requests/${forReassign.id}`, 4500);
detail = await text(hr);
line(detail.includes('Đổi người duyệt'), 'FE-12a nhân sự thấy nút đổi người duyệt');
await hr.getByRole('button', { name: 'Đổi người duyệt', exact: true }).first().click();
await hr.waitForTimeout(1200);
const reassignBox = hr.locator('div.fixed.inset-0').filter({ hasText: 'Đổi người duyệt' }).last();
const holderTrigger = reassignBox.locator('button').filter({ hasText: WHO.mkd.name }).first();
line(await holderTrigger.count() > 0, 'FE-12a ô người đang giữ lượt điền sẵn đúng người', clean(await reassignBox.innerText()).slice(0, 220));
const newApprover = pickerBox(reassignBox, 'Người duyệt mới');
line(await pickPerson(newApprover, hr, WHO.ch.name), 'FE-12a chọn được người duyệt mới');
await reassignBox.locator('textarea').fill('Trưởng phòng nghỉ phép dài, chuyển cho trưởng bộ phận.');
await clearToasts(hr);
await reassignBox.getByRole('button', { name: 'Đổi người duyệt' }).click();
toast = await toastText(hr, 20000);
line(/Đã đổi người duyệt/.test(toast), 'FE-12a đổi người duyệt thành công', toast);
await hr.waitForTimeout(2500);
detail = await text(hr);
line(detail.includes(WHO.ch.name), 'FE-12b phiếu hiện người duyệt mới', detail.slice(0, 300));
line(/đổi người duyệt/i.test(detail), 'FE-12b nhật ký ghi "Đổi người duyệt"');
await shot(hr, 'FE-12b-da-doi-nguoi-duyet');

const reassigned = await api(chToken, '/v1/general-requests/pending-for-me');
line(
	(reassigned.json?.data ?? []).some(r => r.id === forReassign.id),
	'FE-12b người duyệt mới nhận phiếu trong hộp chờ của mình',
);

// ════════════════════════ FE-13: không được phép xem ════════════════════════
const mkt = await signIn(browser, WHO.mkt.email);
await go(mkt, `/general-requests/${forHidden.id}`, 4500);
let hiddenText = await text(mkt);
line(
	hiddenText.includes('không tồn tại hoặc bạn không có quyền xem'),
	'FE-13a trưởng phòng khác nhận trang giải thích, không trắng trang',
	hiddenText.slice(0, 300),
);
line(hiddenText.includes('Về danh sách phiếu'), 'FE-13a trang có đường về danh sách');
line(!hiddenText.includes(forHidden.code), 'FE-13a trang không để lộ số hiệu phiếu');
await shot(mkt, 'FE-13a-khong-co-quyen-xem');

const pgd = await signIn(browser, WHO.pgd.email);
await go(pgd, `/general-requests/${forHidden.id}`, 4500);
hiddenText = await text(pgd);
line(
	hiddenText.includes('không tồn tại hoặc bạn không có quyền xem'),
	'FE-13b giám đốc không liên quan cũng nhận đúng trang đó',
	hiddenText.slice(0, 200),
);
line(pgd.errors.filter(e => !e.includes('Failed to load resource')).length === 0, 'FE-13b không có lỗi JS trên trang này', JSON.stringify(pgd.errors.slice(0, 3)));
await shot(pgd, 'FE-13b-giam-doc-khong-lien-quan');

console.log('\nlỗi console admin:', admin.errors.filter(e => !e.includes('Failed to load resource') && !e.includes('sandboxed')).slice(0, 5));
console.log('lỗi console HR:', hr.errors.filter(e => !e.includes('Failed to load resource') && !e.includes('sandboxed')).slice(0, 5));
console.log(`\nphiếu: duyệt thay=${forOverride.code} của admin=${adminOwn.code} đổi người=${forReassign.code} riêng=${forHidden.code}`);
process.exitCode = summary() ? 1 : 0;
await browser.close();
