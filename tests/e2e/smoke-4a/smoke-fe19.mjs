/**
 * FE-19 và FE-20 — điện thoại 390×844, và các trạng thái đang tải, rỗng, lỗi mạng.
 */
import {
	apiToken,
	clean,
	go,
	launch,
	line,
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
const stamp = Date.now() % 100000;

const phoneRequest = await seedRequest(kdToken, {
	title: `FE-19 phiếu trên điện thoại ${stamp}`,
	pickedApprovers: [{ stepOrder: 1, employeeIds: [WHO.mkd.id] }],
});

/** Trang có tràn ngang hay không: chênh lệch quá hai điểm là tràn. */
async function overflow(page) {
	return page.evaluate(() => ({
		scroll: document.documentElement.scrollWidth,
		client: document.documentElement.clientWidth,
	}));
}

async function checkNoOverflow(page, label) {
	const { scroll, client } = await overflow(page);
	line(scroll <= client + 2, `${label} không tràn ngang`, `scrollWidth=${scroll} clientWidth=${client}`);
}

// ════════════════════════ FE-19: điện thoại ════════════════════════
const phone = await signIn(browser, WHO.kd1.email, { phone: true });

await go(phone, '/general-requests', 5000);
let body = await text(phone);
line(body.includes('Phiếu đề xuất'), 'FE-19a danh sách mở được trên điện thoại');
line(body.includes('Của tôi') && body.includes('Tra cứu'), 'FE-19a thanh tab cuộn ngang vẫn đủ năm tab');
await checkNoOverflow(phone, 'FE-19a danh sách');
await shot(phone, 'FE-19a-dien-thoai-danh-sach');

// Bấm được tab trên điện thoại.
await phone.getByRole('button', { name: /Chờ tôi duyệt/ }).first().click();
await phone.waitForTimeout(3000);
line(phone.url().includes('tab=pending'), 'FE-19a bấm được tab trên điện thoại', phone.url());
await checkNoOverflow(phone, 'FE-19a tab chờ tôi duyệt');

await go(phone, '/general-requests/create', 5000);
await phone.getByRole('button', { name: /^Đề xuất đào tạo/ }).first().click();
await phone.waitForTimeout(3000);
body = await text(phone);
line(body.includes('Tiêu đề phiếu'), 'FE-19b màn gửi phiếu dựng được trên điện thoại');
line(body.includes('Chuỗi người duyệt'), 'FE-19b khối chuỗi người duyệt vẫn hiện');
await checkNoOverflow(phone, 'FE-19b màn gửi phiếu');
await shot(phone, 'FE-19b-dien-thoai-gui-phieu');

await go(phone, `/general-requests/${phoneRequest.id}`, 5000);
body = await text(phone);
line(body.includes(phoneRequest.code), 'FE-19c chi tiết phiếu mở được trên điện thoại');
// Tiêu đề khối in hoa bằng CSS nên so không phân biệt hoa thường.
line(/các bước của vòng 1/i.test(body), 'FE-19c khối các bước vẫn hiện', body.slice(0, 400));
await checkNoOverflow(phone, 'FE-19c chi tiết phiếu');
await shot(phone, 'FE-19c-dien-thoai-chi-tiet');

const hrPhone = await signIn(browser, WHO.hr.email, { phone: true });
await go(hrPhone, '/management/settings/request-types', 5000);
body = await text(hrPhone);
line(body.includes('Loại phiếu đề xuất'), 'FE-19d màn loại phiếu mở được trên điện thoại');
line(body.includes('Sửa luồng duyệt'), 'FE-19d mỗi dòng có đường vào màn luồng duyệt');
await checkNoOverflow(hrPhone, 'FE-19d màn loại phiếu');
await shot(hrPhone, 'FE-19d-dien-thoai-loai-phieu');

await go(hrPhone, '/management/settings/request-types/6/flow', 5500);
body = await text(hrPhone);
line(body.includes('Luồng duyệt'), 'FE-19e màn cấu hình luồng mở được trên điện thoại');
line(body.includes('Điều kiện để bước này được áp dụng'), 'FE-19e khối điều kiện vẫn hiện trên điện thoại');
await checkNoOverflow(hrPhone, 'FE-19e màn cấu hình luồng');
await shot(hrPhone, 'FE-19e-dien-thoai-luong-duyet');

await go(hrPhone, '/management/approval?tab=generalRequests', 5000);
body = await text(hrPhone);
line(body.includes('Phiếu đề xuất'), 'FE-19f tab phê duyệt mở được trên điện thoại');
await checkNoOverflow(hrPhone, 'FE-19f tab phê duyệt');
await shot(hrPhone, 'FE-19f-dien-thoai-tab-phe-duyet');

// ════════════════════════ FE-20: đang tải, rỗng, lỗi mạng ════════════════════════
const kd3 = await signIn(browser, WHO.kd3.email);

// Rỗng: mọi người trên sandbox đều đang theo dõi ít nhất một phiếu, nên trả danh sách rỗng từ
// lớp mạng để kiểm đúng cái cần kiểm là màn hình lúc không có dữ liệu.
await kd3.route('**/v1/general-requests/watching**', route =>
	route.fulfill({
		status: 200,
		contentType: 'application/json',
		body: JSON.stringify({ success: true, data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
	}),
);
await go(kd3, '/general-requests?tab=watching', 4500);
body = await text(kd3);
line(body.includes('Bạn chưa được thêm vào phiếu nào để theo dõi'), 'FE-20a tab rỗng có câu giải thích', body.slice(0, 260));
line(!body.includes('undefined') && !body.includes('NaN'), 'FE-20a không lộ chữ undefined hay NaN');
await shot(kd3, 'FE-20a-tab-rong');

// Đang tải: giữ chậm API danh sách rồi xem khung xương.
const kd = await signIn(browser, WHO.kd1.email);
await kd.route('**/v1/general-requests/me**', async route => {
	await new Promise(r => setTimeout(r, 2500));
	await route.continue();
});
await kd.goto('http://localhost:4020/general-requests', { waitUntil: 'domcontentloaded' });
await kd.waitForTimeout(1500);
const skeletons = await kd.locator('.animate-pulse').count();
line(skeletons > 0, 'FE-20b trong lúc tải có khung xương, không phải trang trắng', `${skeletons} khối`);
line((await text(kd)).includes('Phiếu đề xuất'), 'FE-20b đầu trang hiện ngay, không chờ dữ liệu');
await shot(kd, 'FE-20b-dang-tai');
await kd.waitForTimeout(3500);
line((await kd.locator('.animate-pulse').count()) === 0, 'FE-20b tải xong thì khung xương biến mất');
await kd.unroute('**/v1/general-requests/me**');

// Lỗi mạng: chặn hẳn API danh sách. Màn phải nói đúng là lỗi tải, không nói là chưa có phiếu.
const broken = await signIn(browser, WHO.kd1.email);
await broken.route('**/v1/general-requests/me**', route => route.abort());
await broken.goto('http://localhost:4020/general-requests', { waitUntil: 'domcontentloaded' });
await broken.waitForTimeout(6000);
body = await text(broken);
line(body.includes('Chưa tải được danh sách'), 'FE-20c lỗi mạng hiện khối lỗi trong vùng nội dung', body.slice(0, 400));
line(!body.includes('Bạn chưa gửi phiếu nào'), 'FE-20c không nói sai là người dùng chưa có phiếu nào');
line(/mạng|tải/i.test(body), 'FE-20c có câu tiếng Việt giải thích lỗi mạng', body.slice(0, 400));
line(await broken.getByRole('button', { name: 'Thử lại' }).isVisible(), 'FE-20c có nút Thử lại ngay trong trang');
line(body.includes('Phiếu đề xuất') && body.includes('Gửi phiếu mới'), 'FE-20c trang không trắng, vẫn dùng được các nút khác');
await shot(broken, 'FE-20c-loi-mang');

// Bỏ chặn rồi bấm Thử lại thì danh sách lên bình thường.
await broken.unroute('**/v1/general-requests/me**');
await broken.getByRole('button', { name: 'Thử lại' }).click();
await broken.waitForTimeout(4000);
body = await text(broken);
line(!body.includes('Chưa tải được danh sách'), 'FE-20c bấm Thử lại thì tải lại được', body.slice(0, 200));

// Lỗi mạng ở trang chi tiết: trang vẫn giải thích, không trắng.
const brokenDetail = await signIn(browser, WHO.kd1.email);
await brokenDetail.route(`**/v1/general-requests/${phoneRequest.id}`, route => route.abort());
await brokenDetail.goto(`http://localhost:4020/general-requests/${phoneRequest.id}`, { waitUntil: 'domcontentloaded' });
await brokenDetail.waitForTimeout(6000);
body = await text(brokenDetail);
line(body.includes('Chưa tải được phiếu này'), 'FE-20d chi tiết phiếu lỗi mạng hiện khối lỗi', body.slice(0, 400));
line(
	!body.includes('không tồn tại hoặc bạn không có quyền xem'),
	'FE-20d không nói sai là phiếu không tồn tại',
);
line(await brokenDetail.getByRole('button', { name: 'Thử lại' }).isVisible(), 'FE-20d có nút Thử lại');
await shot(brokenDetail, 'FE-20d-chi-tiet-loi-mang');

console.log('\nlỗi console điện thoại:', phone.errors.filter(e => !e.includes('Failed to load resource') && !e.includes('sandboxed')).slice(0, 5));
process.exitCode = summary() ? 1 : 0;
await browser.close();
