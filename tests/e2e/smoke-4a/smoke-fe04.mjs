/**
 * FE-04 và FE-05 — trưởng phòng duyệt, trả lại; người gửi sửa rồi nộp lại.
 *
 * Phiếu đầu vào dựng bằng API để bài tập trung vào thao tác trên màn: mọi quyết định đều bấm
 * thật trên giao diện.
 */
import {
	api,
	apiToken,
	clean,
	clearToasts,
	fillByLabel,
	go,
	launch,
	line,
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

const stamp = Date.now() % 100000;

// Phiếu cho FE-04: hai người duyệt lần lượt, để thấy phiếu sang bước kế sau khi đồng ý.
const forApprove = await seedRequest(kdToken, {
	title: `FE-04 duyệt hai bước ${stamp}`,
	pickedApprovers: [{ stepOrder: 1, employeeIds: [WHO.mkd.id, WHO.ch.id] }],
});
// Phiếu cho FE-05: một người duyệt, sẽ bị trả lại.
const forReturn = await seedRequest(kdToken, {
	title: `FE-05 trả lại ${stamp}`,
	pickedApprovers: [{ stepOrder: 1, employeeIds: [WHO.mkd.id] }],
});
line(!!forApprove.code && !!forReturn.code, 'dựng được hai phiếu để bấm thử', `${forApprove.code} / ${forReturn.code}`);

// ════════════════════════ FE-04: hộp thư duyệt và đồng ý ════════════════════════
const mkd = await signIn(browser, WHO.mkd.email);
const counts = await api(mkdToken, '/v1/approval/counts');
const expected = counts.json?.data?.generalRequests ?? 0;

await go(mkd, '/management/approval?tab=generalRequests', 4500);
let body = await text(mkd);
line(body.includes('Phiếu đề xuất'), 'FE-04a trang Phê duyệt có tab Phiếu đề xuất');
const tabButton = mkd.locator('button').filter({ hasText: 'Phiếu đề xuất' }).first();
const badge = clean(await tabButton.innerText()).replace('Phiếu đề xuất', '').trim();
line(badge === String(expected), 'FE-04a badge khớp số phiếu chờ của API', `badge=${badge} api=${expected}`);
line(body.includes(forApprove.code), 'FE-04a phiếu vừa gửi nằm trong tab', forApprove.code);
line(/HẠN XỬ LÝ/i.test(body), 'FE-04a bảng có cột hạn xử lý');
await shot(mkd, 'FE-04a-tab-phieu-de-xuat');

await mkd.locator('table tbody tr').filter({ hasText: forApprove.code }).first().click();
await mkd.waitForTimeout(3500);
line(/\/general-requests\/\d+$/.test(mkd.url()), 'FE-04b bấm dòng mở trang phiếu', mkd.url());
let detail = await text(mkd);
line(detail.includes('Đồng ý') && detail.includes('Từ chối'), 'FE-04b trang phiếu có nút Đồng ý và Từ chối');
line(detail.includes('Trả lại để bổ sung'), 'FE-04b có nút trả lại để bổ sung');
line(detail.includes('Chuyển lượt duyệt'), 'FE-04b có nút chuyển lượt duyệt');
line(!detail.includes('Duyệt thay'), 'FE-04b trưởng phòng không thấy nút duyệt thay');
await shot(mkd, 'FE-04b-chi-tiet-phieu-cho-duyet');

await mkd.getByRole('button', { name: 'Đồng ý', exact: true }).first().click();
await mkd.waitForTimeout(1200);
const approveBox = mkd.locator('div.fixed.inset-0').filter({ hasText: 'Đồng ý phiếu' }).last();
line(await approveBox.isVisible(), 'FE-04c hộp thoại đồng ý mở ra');
await approveBox.locator('textarea').fill('Đồng ý, phòng kinh doanh cần máy mới.');
await clearToasts(mkd);
await approveBox.getByRole('button', { name: 'Đồng ý phiếu' }).click();
let toast = await toastText(mkd, 20000);
line(/Đã đồng ý phiếu/.test(toast), 'FE-04c đồng ý kèm ghi chú thành công', toast);
await mkd.waitForTimeout(2000);
detail = await text(mkd);
line(detail.includes(WHO.ch.name), 'FE-04d phiếu sang bước kế, người giữ lượt là người thứ hai', detail.slice(0, 300));
line(detail.includes('Đồng ý, phòng kinh doanh cần máy mới.'), 'FE-04d ghi chú khi duyệt nằm trong nhật ký');
line(!detail.includes('Đồng ý phiếu'), 'FE-04d không còn nút đồng ý vì đã qua lượt của mình');
await shot(mkd, 'FE-04d-sau-khi-dong-y');

const afterApprove = await api(mkdToken, `/v1/general-requests/${forApprove.id}`);
line(afterApprove.json?.data?.currentStep?.order === 2, 'FE-04d máy chủ ghi phiếu ở bước 2', JSON.stringify(afterApprove.json?.data?.currentStep?.order));
line(afterApprove.json?.data?.canApprove === false, 'FE-04d cờ canApprove của người vừa duyệt là false');

// Tab "Chờ tôi duyệt" ở trang phiếu đề xuất cũng phải cập nhật.
await go(mkd, '/general-requests?tab=pending', 4000);
body = await text(mkd);
line(!body.includes(forApprove.code), 'FE-04e phiếu đã duyệt rời hộp chờ tôi duyệt');
line(body.includes(forReturn.code), 'FE-04e phiếu còn lại vẫn trong hộp chờ tôi duyệt', forReturn.code);
await shot(mkd, 'FE-04e-cho-toi-duyet');

// ════════════════════════ FE-05: trả lại rồi nộp lại ════════════════════════
await go(mkd, `/general-requests/${forReturn.id}`, 4000);
await mkd.getByRole('button', { name: 'Trả lại để bổ sung' }).first().click();
await mkd.waitForTimeout(1200);
const returnBox = mkd.locator('div.fixed.inset-0').filter({ hasText: 'Trả lại để bổ sung' }).last();
await clearToasts(mkd);
await returnBox.getByRole('button', { name: 'Trả lại để bổ sung' }).click();
await mkd.waitForTimeout(1000);
let boxText = clean(await returnBox.innerText());
line(/Bạn nhập cần bổ sung gì trước đã/.test(boxText), 'FE-05a trả lại mà không ghi lý do thì bị chặn', boxText.slice(-200));

await returnBox.locator('textarea').fill('Thiếu báo giá của nhà cung cấp, bạn bổ sung rồi gửi lại.');
await clearToasts(mkd);
await returnBox.getByRole('button', { name: 'Trả lại để bổ sung' }).click();
toast = await toastText(mkd, 20000);
line(/Đã trả lại phiếu/.test(toast), 'FE-05a trả lại được phiếu', toast);
await mkd.waitForTimeout(2000);
line((await text(mkd)).includes('Cần bổ sung'), 'FE-05a phiếu chuyển trạng thái Cần bổ sung');
await shot(mkd, 'FE-05a-da-tra-lai');

const kd = await signIn(browser, WHO.kd1.email);
await go(kd, '/general-requests?tab=returned', 4500);
body = await text(kd);
line(body.includes(forReturn.code), 'FE-05b người gửi thấy phiếu trong tab Cần bổ sung', forReturn.code);
line(body.includes('Thiếu báo giá') || body.includes('Bị trả lại'), 'FE-05b tab nói rõ phiếu bị trả lại', body.slice(0, 300));
const returnedTab = kd.locator('button').filter({ hasText: 'Cần bổ sung' }).first();
line(/\d/.test(clean(await returnedTab.innerText())), 'FE-05b tab Cần bổ sung có số đếm', clean(await returnedTab.innerText()));
await shot(kd, 'FE-05b-tab-can-bo-sung');

await kd.locator('a[href*="/general-requests/create?id="]').first().click();
await kd.waitForTimeout(4500);
line(kd.url().includes('/general-requests/create?id='), 'FE-05c mở màn sửa và nộp lại', kd.url());
let editText = await text(kd);
line(editText.includes('Sửa và nộp lại phiếu'), 'FE-05c màn ở chế độ nộp lại');
line(editText.includes(forReturn.code), 'FE-05c màn hiện số hiệu cũ của phiếu', forReturn.code);
line(editText.includes('bị trả lại để bổ sung'), 'FE-05c có câu nhắc phiếu bị trả lại');
const noiDung = kd.locator('label:has-text("Nội dung tờ trình")').first().locator('xpath=following::textarea[1]');
await noiDung.fill(`${proposalValues().noi_dung} Đã bổ sung báo giá của nhà cung cấp.`);
await kd.waitForTimeout(1500);
await shot(kd, 'FE-05c-sua-va-nop-lai');

await clearToasts(kd);
await kd.getByRole('button', { name: 'Nộp lại phiếu' }).click();
toast = await toastText(kd, 25000);
line(new RegExp(`Đã nộp lại phiếu ${forReturn.code}`).test(toast), 'FE-05d nộp lại giữ nguyên số hiệu', toast);
line(/vòng 2/.test(toast), 'FE-05d nộp lại thành vòng 2', toast);
await kd.waitForTimeout(3000);
const resubmitted = await text(kd);
line(resubmitted.includes('vòng 2'), 'FE-05d trang phiếu hiện vòng 2', resubmitted.slice(0, 240));
// Tiêu đề nhóm vòng in hoa bằng CSS nên so không phân biệt chữ hoa chữ thường.
line(
	/vòng 1/i.test(resubmitted) && /vòng 2 đang duyệt/i.test(resubmitted),
	'FE-05d nhật ký tách vòng 1 và vòng 2',
	resubmitted.slice(0, 600),
);
line(resubmitted.includes('Thiếu báo giá'), 'FE-05d lý do trả lại của vòng 1 vẫn đọc được');
await shot(kd, 'FE-05d-phieu-vong-2');

const afterResubmit = await api(kdToken, `/v1/general-requests/${forReturn.id}`);
line(afterResubmit.json?.data?.round === 2, 'FE-05d máy chủ ghi vòng 2', String(afterResubmit.json?.data?.round));
line(afterResubmit.json?.data?.code === forReturn.code, 'FE-05d số hiệu không đổi sau khi nộp lại');

console.log('\nlỗi console QLKD:', mkd.errors.filter(e => !e.includes('Failed to load resource') && !e.includes('sandboxed')).slice(0, 5));
console.log('lỗi console KD01:', kd.errors.filter(e => !e.includes('Failed to load resource') && !e.includes('sandboxed')).slice(0, 5));
console.log(`\nphiếu dùng cho bài này: FE-04=${forApprove.code}(#${forApprove.id}) FE-05=${forReturn.code}(#${forReturn.id})`);
process.exitCode = summary() ? 1 : 0;
await browser.close();
