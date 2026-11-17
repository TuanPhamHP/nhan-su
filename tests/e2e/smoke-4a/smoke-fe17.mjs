/**
 * FE-17 và FE-18 — bản in không biến ký tự thành thẻ, và đơn cũ sau nâng cấp.
 */
import {
	api,
	apiToken,
	clean,
	clearToasts,
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

const RAW = '<b>chữ đậm</b> và <script>alert(1)</script>';

// ════════════════════════ FE-17: in phiếu có ký tự HTML ════════════════════════
const forPrint = await seedRequest(kdToken, {
	title: `FE-17 bản in ${stamp}`,
	fieldValues: proposalValues({ noi_dung: `Đề nghị mua máy: ${RAW}`, ve_viec: `Mua máy ${RAW}` }),
	pickedApprovers: [{ stepOrder: 1, employeeIds: [WHO.mkd.id] }],
});
const approved = await api(mkdToken, `/v1/general-requests/${forPrint.id}/approve`, {
	method: 'PATCH',
	body: JSON.stringify({ note: 'Đồng ý.' }),
});
line(approved.status === 200 && approved.json?.data?.status === 'APPROVED', 'dựng được phiếu đã duyệt để in', forPrint.code);

const kd = await signIn(browser, WHO.kd1.email);
await go(kd, `/general-requests/${forPrint.id}`, 5000);
let body = await text(kd);
line(body.includes('In phiếu'), 'FE-17a phiếu đã duyệt có nút in');

// Khung xem nội dung trong trang: ký tự thô, không thành chữ đậm.
const frame = kd.frameLocator('iframe');
const frameText = clean(await frame.locator('body').innerText());
line(frameText.includes('<b>chữ đậm</b>'), 'FE-17a khung nội dung hiện ký tự thô', frameText.slice(0, 200));
const boldInFrame = await frame.locator('body b').count();
const scriptInFrame = await frame.locator('body script').count();
line(boldInFrame === 0, 'FE-17a không sinh thẻ in đậm từ chữ người dùng gõ', String(boldInFrame));
line(scriptInFrame === 0, 'FE-17a không sinh thẻ script', String(scriptInFrame));
await shot(kd, 'FE-17a-noi-dung-ky-tu-tho');

// Bản in: ký tự thô, có số hiệu ở đầu trang.
//
// Từ đợt sửa, bản in dựng trong một iframe sandbox ngay trong trang thay cho `window.open` cộng
// `document.write`, vì cửa sổ `about:blank` chạy cùng origin nên mã trong mẫu in sẽ chạy bằng
// phiên của người bấm in. Bài này vì thế đọc nội dung của iframe đó. Lệnh in do chính khung đó
// gọi (`contentWindow.print()`), nằm trong realm khác nên không đếm được từ trang cha; bằng
// chứng đã in là máy chủ tăng số lần in ở khẳng định cuối.
await clearToasts(kd);
await kd.getByRole('button', { name: /^In phiếu/ }).first().click();
await kd.waitForTimeout(4000);
const printFrame = kd.locator('iframe[sandbox]').last();
const printSandbox = await printFrame.getAttribute('sandbox');
line(
	/allow-same-origin/.test(printSandbox ?? '') && !/allow-scripts/.test(printSandbox ?? ''),
	'FE-17b bấm in dựng khung bản in không cho chạy script',
	printSandbox,
);
const printBody = printFrame.contentFrame();
const printText = clean(await printBody.locator('body').innerText());
line(printText.includes('<b>chữ đậm</b>'), 'FE-17b bản in hiện ký tự thô, không thành chữ đậm', printText.slice(0, 300));
// Bản in có một thẻ in đậm của chính dòng số hiệu do trang thêm vào, nên chỉ kiểm rằng chữ
// người dùng gõ không trở thành thẻ.
line(
	(await printBody.locator('b').filter({ hasText: 'chữ đậm' }).count()) === 0,
	'FE-17b chữ người dùng gõ không thành thẻ in đậm trong bản in',
);
line(
	(await printBody.locator('b').filter({ hasText: forPrint.code }).count()) === 1,
	'FE-17b dòng số hiệu của bản in là markup của trang, không phải của người dùng',
);
line((await printBody.locator('body script').count()) === 0, 'FE-17b bản in không có thẻ script');
line(printText.includes(forPrint.code), 'FE-17b bản in có số hiệu phiếu', forPrint.code);
// Khung in thật là 0×0 và ẩn, nên nới ra cho ảnh chụp đọc được rồi mới chụp.
await printFrame.evaluate(el => {
	el.style.position = 'static';
	el.style.visibility = 'visible';
	el.style.width = '860px';
	el.style.height = '620px';
	el.style.border = '1px solid #9ca3af';
	el.scrollIntoView();
});
await kd.waitForTimeout(600);
await shot(kd, 'FE-17b-ban-in');

const printed = await api(kdToken, `/v1/general-requests/${forPrint.id}`);
line((printed.json?.data?.printCount ?? 0) >= 1, 'FE-17b máy chủ đếm số lần in', String(printed.json?.data?.printCount));

// ════════════════════════ FE-18: đơn cũ của công ty khác ════════════════════════
const old = await signIn(browser, 'e1@old.drill');
line(!old.url().includes('/login'), 'FE-18a đăng nhập được công ty cũ', old.url());
await go(old, '/general-requests', 5000);
body = await text(old);
line(body.includes('Phiếu đề xuất'), 'FE-18a mở được danh sách phiếu');
line(/TT-\d+\/2026/.test(body), 'FE-18a đơn cũ đã có số hiệu sau nâng cấp', body.match(/TT-\d+\/2026/)?.[0] ?? '');
line(body.includes('Đã duyệt') && body.includes('Chờ duyệt'), 'FE-18a danh sách có cả đơn đã duyệt và đơn đang chờ');
await shot(old, 'FE-18a-danh-sach-don-cu');

// Đơn đã duyệt: các bước và nhật ký đọc được.
await go(old, '/general-requests/4', 5000);
let detail = await text(old);
line(detail.includes('TT-0002/2026'), 'FE-18b mở được đơn đã duyệt', detail.slice(0, 160));
line(detail.includes('Đã duyệt'), 'FE-18b đơn hiện trạng thái đã duyệt');
line(detail.includes('Người duyệt 1') && detail.includes('Người duyệt 2'), 'FE-18b hiện đủ các bước của đơn cũ');
line(/nhật ký duyệt/i.test(detail), 'FE-18b có phần nhật ký duyệt');
line(detail.includes('Không có hạn') || !detail.includes('Hạn xử lý'), 'FE-18b đơn cũ không có hạn xử lý, màn không bịa ra hạn');
await shot(old, 'FE-18b-don-cu-da-duyet');

// Đơn đang chờ: bước hiện tại và người giữ lượt.
await go(old, '/general-requests/3', 5000);
detail = await text(old);
line(detail.includes('TT-0001/2026'), 'FE-18c mở được đơn đang chờ');
line(detail.includes('Chờ duyệt'), 'FE-18c đơn hiện trạng thái chờ duyệt');
line(detail.includes('Người duyệt 2'), 'FE-18c hiện đúng bước đang chờ', detail.slice(0, 300));
line(old.errors.filter(e => !e.includes('Failed to load resource') && !e.includes('sandboxed')).length === 0, 'FE-18c không có lỗi JS khi xem đơn cũ', JSON.stringify(old.errors.slice(0, 3)));
await shot(old, 'FE-18c-don-cu-dang-cho');

console.log('\nlỗi console KD01:', kd.errors.filter(e => !e.includes('Failed to load resource') && !e.includes('sandboxed')).slice(0, 5));
console.log('lỗi console công ty cũ:', old.errors.filter(e => !e.includes('Failed to load resource') && !e.includes('sandboxed')).slice(0, 5));
process.exitCode = summary() ? 1 : 0;
await browser.close();
