/**
 * FE-06 và FE-07 — từ chối, duyệt nhanh từ chuông thông báo, chuyển lượt duyệt.
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
const mkdToken = await apiToken(WHO.mkd.email);
const chToken = await apiToken(WHO.ch.email);
const stamp = Date.now() % 100000;

const pick = ids => [{ stepOrder: 1, employeeIds: ids }];

const forReject = await seedRequest(kdToken, { title: `FE-06 từ chối ${stamp}`, pickedApprovers: pick([WHO.mkd.id]) });
const forQuickOk = await seedRequest(kdToken, { title: `FE-06 duyệt nhanh ${stamp}`, pickedApprovers: pick([WHO.mkd.id]) });
const forQuickNo = await seedRequest(kdToken, { title: `FE-06 từ chối nhanh ${stamp}`, pickedApprovers: pick([WHO.mkd.id]) });
const forTransfer = await seedRequest(kdToken, { title: `FE-07 chuyển lượt ${stamp}`, pickedApprovers: pick([WHO.mkd.id]) });
const forSelfTransfer = await seedRequest(kdToken, { title: `FE-07 chuyển cho người gửi ${stamp}`, pickedApprovers: pick([WHO.mkd.id]) });
line(true, 'dựng xong năm phiếu cho hai bài', [forReject, forQuickOk, forQuickNo, forTransfer, forSelfTransfer].map(r => r.code).join(', '));

const mkd = await signIn(browser, WHO.mkd.email);

// ════════════════════════ FE-06: từ chối ════════════════════════
await go(mkd, `/general-requests/${forReject.id}`, 4000);
await mkd.getByRole('button', { name: 'Từ chối', exact: true }).first().click();
await mkd.waitForTimeout(1200);
const rejectBox = mkd.locator('div.fixed.inset-0').filter({ hasText: 'Từ chối phiếu' }).last();
line(await rejectBox.isVisible(), 'FE-06a hộp thoại từ chối mở ra');
await rejectBox.getByRole('button', { name: 'Từ chối phiếu' }).click();
await mkd.waitForTimeout(1000);
line(
	/Bạn nhập lý do từ chối trước đã/.test(clean(await rejectBox.innerText())),
	'FE-06a từ chối không lý do bị chặn ngay trong hộp thoại',
	clean(await rejectBox.innerText()).slice(-200),
);
let afterReject = await api(mkdToken, `/v1/general-requests/${forReject.id}`);
line(afterReject.json?.data?.status === 'PENDING', 'FE-06a phiếu chưa đổi trạng thái vì chưa gửi được', String(afterReject.json?.data?.status));
await shot(mkd, 'FE-06a-tu-choi-thieu-ly-do');

await rejectBox.locator('textarea').fill('Chi phí vượt kế hoạch quý, phòng xem lại hạng mục.');
await clearToasts(mkd);
await rejectBox.getByRole('button', { name: 'Từ chối phiếu' }).click();
let toast = await toastText(mkd, 20000);
line(/Đã từ chối phiếu/.test(toast), 'FE-06b từ chối có lý do thì thành công', toast);
await mkd.waitForTimeout(2000);
let detail = await text(mkd);
line(detail.includes('Bị từ chối'), 'FE-06b phiếu chuyển trạng thái Bị từ chối');
line(detail.includes('Chi phí vượt kế hoạch quý'), 'FE-06b lý do từ chối nằm trong nhật ký');
afterReject = await api(mkdToken, `/v1/general-requests/${forReject.id}`);
line(afterReject.json?.data?.status === 'REJECTED', 'FE-06b máy chủ ghi phiếu bị từ chối', String(afterReject.json?.data?.status));
await shot(mkd, 'FE-06b-da-tu-choi');

// ════════════════════════ FE-06: duyệt nhanh từ chuông ════════════════════════
await go(mkd, '/general-requests', 4000);
await mkd.locator('button[title="Thông báo"]').click();
await mkd.waitForTimeout(2500);
const panel = mkd.locator('div').filter({ hasText: 'Thông báo' }).last();
const okItem = mkd.locator('div').filter({ hasText: `FE-06 duyệt nhanh ${stamp}` }).last();
line(await okItem.count() > 0, 'FE-06c chuông có thông báo phiếu chờ duyệt');
let bellText = clean(await okItem.innerText());
line(/✓ Duyệt/.test(bellText), 'FE-06c thông báo phiếu đề xuất có nút duyệt nhanh', bellText.slice(0, 220));
await shot(mkd, 'FE-06c-chuong-thong-bao');

await okItem.getByRole('button', { name: /✓ Duyệt/ }).first().click();
await mkd.waitForTimeout(4000);
bellText = clean(await okItem.innerText());
line(/Đã duyệt thành công/.test(bellText), 'FE-06c duyệt nhanh xong hiện xác nhận ngay trong chuông', bellText.slice(0, 220));
const quickOk = await api(mkdToken, `/v1/general-requests/${forQuickOk.id}`);
line(quickOk.json?.data?.status === 'APPROVED', 'FE-06c máy chủ ghi phiếu đã duyệt', String(quickOk.json?.data?.status));
await shot(mkd, 'FE-06c-duyet-nhanh-xong');

// ════════════════════════ FE-06: từ chối nhanh từ chuông ════════════════════════
const noItem = mkd.locator('div').filter({ hasText: `FE-06 từ chối nhanh ${stamp}` }).last();
await noItem.getByRole('button', { name: /✗ Từ chối/ }).first().click();
await mkd.waitForTimeout(1200);
await noItem.locator('textarea').fill('Chưa đúng thời điểm, để quý sau.');
await noItem.getByRole('button', { name: 'Xác nhận từ chối' }).click();
await mkd.waitForTimeout(4000);
line(/Đã từ chối/.test(clean(await noItem.innerText())), 'FE-06d từ chối nhanh kèm lý do xong hiện xác nhận', clean(await noItem.innerText()).slice(0, 200));
const quickNo = await api(mkdToken, `/v1/general-requests/${forQuickNo.id}`);
line(quickNo.json?.data?.status === 'REJECTED', 'FE-06d máy chủ ghi phiếu bị từ chối', String(quickNo.json?.data?.status));
line(
	JSON.stringify(quickNo.json?.data?.steps ?? []).includes('Chưa đúng thời điểm'),
	'FE-06d lý do từ chối nhanh được lưu kèm',
	JSON.stringify(quickNo.json?.data?.steps?.[0]?.assignments?.[0]?.note),
);
await shot(mkd, 'FE-06d-tu-choi-nhanh-xong');

// ════════════════════════ FE-07: chuyển lượt duyệt ════════════════════════
await go(mkd, `/general-requests/${forTransfer.id}`, 4000);
await mkd.getByRole('button', { name: 'Chuyển lượt duyệt' }).first().click();
await mkd.waitForTimeout(1200);
const transferBox = mkd.locator('div.fixed.inset-0').filter({ hasText: 'Chuyển lượt duyệt' }).last();
line(await transferBox.isVisible(), 'FE-07a hộp thoại chuyển lượt mở ra');
const targetBox = pickerBox(transferBox, 'Người nhận lượt duyệt');
line(await pickPerson(targetBox, mkd, WHO.ch.name), 'FE-07a chọn được người nhận lượt');
await transferBox.locator('textarea').fill('Tôi đi công tác, anh Khánh xem giúp.');
await clearToasts(mkd);
await transferBox.getByRole('button', { name: 'Chuyển lượt duyệt' }).click();
toast = await toastText(mkd, 20000);
line(/Đã chuyển lượt duyệt/.test(toast), 'FE-07a chuyển lượt thành công', toast);
await mkd.waitForTimeout(2000);
detail = await text(mkd);
line(detail.includes(WHO.ch.name), 'FE-07a trang phiếu hiện người nhận lượt mới', detail.slice(0, 300));
line(/chuyển/i.test(detail), 'FE-07a nhật ký ghi việc chuyển lượt');
await shot(mkd, 'FE-07a-da-chuyen-luot');

const inboxCh = await api(chToken, '/v1/general-requests/pending-for-me');
line(
	(inboxCh.json?.data ?? []).some(r => r.id === forTransfer.id),
	'FE-07b người nhận thấy phiếu trong hộp chờ duyệt của mình',
	String((inboxCh.json?.data ?? []).length),
);

// Chuyển cho chính người gửi: máy chủ chặn, màn hiện câu của máy chủ.
await go(mkd, `/general-requests/${forSelfTransfer.id}`, 4000);
await mkd.getByRole('button', { name: 'Chuyển lượt duyệt' }).first().click();
await mkd.waitForTimeout(1200);
const transferBox2 = mkd.locator('div.fixed.inset-0').filter({ hasText: 'Chuyển lượt duyệt' }).last();
const targetBox2 = pickerBox(transferBox2, 'Người nhận lượt duyệt');
line(await pickPerson(targetBox2, mkd, WHO.kd1.name), 'FE-07c chọn được chính người gửi để thử');
await clearToasts(mkd);
await transferBox2.getByRole('button', { name: 'Chuyển lượt duyệt' }).click();
toast = await toastText(mkd, 20000);
line(toast.length > 10 && !/Đã chuyển/.test(toast), 'FE-07c chuyển cho người gửi bị chặn bằng toast', toast);
const selfTransfer = await api(mkdToken, `/v1/general-requests/${forSelfTransfer.id}`);
line(
	selfTransfer.json?.data?.currentStep?.approvers?.[0]?.id === WHO.mkd.id,
	'FE-07c lượt duyệt vẫn ở người cũ',
	JSON.stringify(selfTransfer.json?.data?.currentStep?.approvers),
);
await shot(mkd, 'FE-07c-chuyen-cho-nguoi-gui-bi-chan');

console.log('\nlỗi console:', mkd.errors.filter(e => !e.includes('Failed to load resource') && !e.includes('sandboxed')).slice(0, 5));
console.log(`\nphiếu: từ chối=${forReject.code} duyệt nhanh=${forQuickOk.code} từ chối nhanh=${forQuickNo.code} chuyển=${forTransfer.code} chuyển sai=${forSelfTransfer.code}`);
process.exitCode = summary() ? 1 : 0;
await browser.close();
