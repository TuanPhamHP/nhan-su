/**
 * FE-10 — Nhân sự cấu hình loại phiếu và luồng duyệt.
 *
 * Chạy TRƯỚC các bài gửi phiếu, vì FE-02 cần "Đề xuất đào tạo" có bước giám đốc kèm điều kiện
 * số tiền, và bước đó được dựng ở chính bài này qua giao diện.
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
	pickerBox,
	pickOption,
	pickPerson,
	selectByLabel,
	shot,
	signIn,
	summary,
	text,
	toastText,
	WHO,
} from './helper4a.mjs';

const browser = await launch();
const hrToken = await apiToken(WHO.hr.email);
const page = await signIn(browser, WHO.hr.email);

// ─── FE-10a: vào được màn loại phiếu từ trang Cài đặt ────────────────────────
await go(page, '/management/settings', 3500);
// Lần vào đầu tiên sau khi dựng server dev thì Vite còn đang dịch route, nên chờ hẳn thẻ cần
// kiểm hiện ra thay vì chờ cứng mấy giây.
await page.getByRole('link', { name: /Loại phiếu đề xuất/ }).first().waitFor({ state: 'visible', timeout: 30000 });
const settingsText = await text(page);
line(settingsText.includes('Loại phiếu đề xuất'), 'FE-10a thẻ "Loại phiếu đề xuất" hiện ở trang Cài đặt');
await page.getByRole('link', { name: /Loại phiếu đề xuất/ }).first().click();
await page.waitForTimeout(3500);
line(page.url().includes('/management/settings/request-types'), 'FE-10a bấm thẻ mở đúng trang', page.url());
const listText = await text(page);
line(listText.includes('Đề xuất đào tạo'), 'FE-10a danh sách có loại phiếu Đề xuất đào tạo');
line(/TIỀN TỐ/i.test(listText), 'FE-10a bảng có cột tiền tố số hiệu');
await shot(page, 'FE-10a-danh-sach-loai-phieu');

// ─── FE-10b: tiền tố chữ thường bị chặn ─────────────────────────────────────
const row = page.locator('table tbody tr').filter({ hasText: 'Đề xuất đào tạo' }).first();
await row.getByRole('button', { name: 'Sửa' }).click();
await page.waitForTimeout(1200);
const form = page.locator('div.fixed.inset-0').filter({ hasText: 'Sửa loại phiếu' }).last();
line(await form.isVisible(), 'FE-10b hộp thoại sửa loại phiếu mở ra');

await fillByLabel(form, 'Tiền tố số hiệu', 'dt');
await form.getByRole('button', { name: 'Lưu thay đổi' }).click();
await page.waitForTimeout(1200);
let formText = clean(await form.innerText());
line(
	formText.includes('Tiền tố gồm 1 đến 10 chữ in hoa hoặc số'),
	'FE-10b tiền tố chữ thường báo lỗi ngay cạnh ô',
	formText.slice(0, 200),
);
line(await form.isVisible(), 'FE-10b hộp thoại vẫn mở, không trắng trang');
await shot(page, 'FE-10b-tien-to-chu-thuong');

// ─── FE-10c: người theo dõi mặc định ────────────────────────────────────────
await fillByLabel(form, 'Tiền tố số hiệu', 'DT');
const watcherBox = pickerBox(form, 'Người theo dõi mặc định');
const picked = await pickPerson(watcherBox, page, WHO.kt1.name);
line(picked, 'FE-10c chọn được người theo dõi mặc định', clean(await watcherBox.innerText()).slice(0, 160));
await clearToasts(page);
await form.getByRole('button', { name: 'Lưu thay đổi' }).click();
const savedToast = await toastText(page, 15000);
line(/Đã cập nhật mẫu/.test(savedToast), 'FE-10c lưu loại phiếu thành công', savedToast);

const tpl6 = await api(hrToken, '/v1/general-requests/templates/6');
line(
	Array.isArray(tpl6.json?.data?.defaultWatcherIds) && tpl6.json.data.defaultWatcherIds.includes(WHO.kt1.id),
	'FE-10c máy chủ đã lưu người theo dõi mặc định',
	JSON.stringify(tpl6.json?.data?.defaultWatcherIds),
);
line(tpl6.json?.data?.codePrefix === 'DT', 'FE-10c tiền tố giữ đúng chữ in hoa', String(tpl6.json?.data?.codePrefix));

// ─── FE-10d: tắt mẫu rồi bật lại ────────────────────────────────────────────
await go(page, '/management/settings/request-types', 3000);
const rewardRow = page.locator('table tbody tr').filter({ hasText: 'Đề nghị khen thưởng' }).first();
await clearToasts(page);
await rewardRow.getByRole('button', { name: 'Tắt loại phiếu' }).click();
let toast = await toastText(page, 15000);
line(/Đã tắt loại phiếu/.test(toast), 'FE-10d tắt được mẫu', toast);
let tpl5 = await api(hrToken, '/v1/general-requests/templates/5');
line(tpl5.json?.data?.isActive === false, 'FE-10d máy chủ ghi mẫu đã tắt', String(tpl5.json?.data?.isActive));
line(clean(await rewardRow.innerText()).includes('Đã tắt'), 'FE-10d dòng hiện trạng thái Đã tắt');
await shot(page, 'FE-10d-tat-mau');

await clearToasts(page);
await rewardRow.getByRole('button', { name: 'Bật lại' }).click();
toast = await toastText(page, 15000);
line(/Đã bật lại loại phiếu/.test(toast), 'FE-10d bật lại được mẫu', toast);
tpl5 = await api(hrToken, '/v1/general-requests/templates/5');
line(tpl5.json?.data?.isActive === true, 'FE-10d máy chủ ghi mẫu đang dùng lại', String(tpl5.json?.data?.isActive));

// ─── FE-10e: dựng luồng hai bước có điều kiện cho Đề xuất đào tạo ───────────
// Dựng lại điểm xuất phát một bước, để chạy lại bài này nhiều lần vẫn soạn bước hai từ đầu.
await api(hrToken, '/v1/general-requests/templates/6/flow', {
	method: 'PUT',
	body: JSON.stringify({ steps: [{ name: 'HR duyệt', approver: { kind: 'ROLE', role: 'HR' }, mode: 'ANY' }] }),
});
// Dựng lại điểm xuất phát một bước, để chạy lại bài này nhiều lần vẫn soạn bước hai từ đầu.
await api(hrToken, '/v1/general-requests/templates/6/flow', {
	method: 'PUT',
	body: JSON.stringify({ steps: [{ name: 'HR duyệt', approver: { kind: 'ROLE', role: 'HR' }, mode: 'ANY' }] }),
});
const flowBefore = await api(hrToken, '/v1/general-requests/templates/6/flow');
const versionBefore = flowBefore.json?.data?.version ?? 0;

await go(page, '/management/settings/request-types', 2500);
const trainingRow = page.locator('table tbody tr').filter({ hasText: 'Đề xuất đào tạo' }).first();
await trainingRow.getByRole('link', { name: 'Luồng duyệt' }).click();
await page.waitForTimeout(3500);
line(page.url().includes('/flow'), 'FE-10e mở được màn luồng duyệt', page.url());
let flowText = await text(page);
line(flowText.includes(`Phiên bản hiện tại ${versionBefore}`), 'FE-10e màn hiện phiên bản luồng', flowText.slice(0, 160));
// Tên bước nằm trong ô nhập nên phải đọc `value`, `innerText` không có chữ trong input.
const step1Name = await page.locator('ol > li').first().locator('input[type="text"]').first().inputValue();
line(step1Name === 'HR duyệt', 'FE-10e bước đang có của luồng hiện ra', step1Name);

// Bước 1 giữ nguyên "HR duyệt". Thêm bước 2: giám đốc, chỉ khi số tiền từ 100 triệu.
await page.getByRole('button', { name: 'Thêm bước' }).click();
await page.waitForTimeout(800);
const step2 = page.locator('ol > li').nth(1);
await fillByLabel(step2, 'Tên bước', 'Giám đốc phê duyệt');
await selectByLabel(step2, page, 'Người duyệt của bước', 'Theo vai trò');
await selectByLabel(step2, page, 'Vai trò người duyệt', 'Giám đốc');
await selectByLabel(step2, page, 'Số người cần đồng ý', 'Một người đồng ý là đủ');
await fillByLabel(step2, 'Hạn xử lý (giờ làm việc)', '16');
await step2.getByRole('button', { name: 'Thêm điều kiện' }).click();
await page.waitForTimeout(600);
await step2.locator('button:has-text("Chọn trường")').first().click();
await page.waitForTimeout(400);
await pickOption(page, 'Số tiền');
await step2.locator('button:has-text("bằng")').first().click();
await page.waitForTimeout(400);
await pickOption(page, 'lớn hơn hoặc bằng');
await step2.locator('input[placeholder="Giá trị so sánh"]').fill('100000000');
await page.waitForTimeout(500);
flowText = clean(await step2.innerText());
line(
	flowText.includes('Bước này chỉ được áp dụng khi Số tiền lớn hơn hoặc bằng 100.000.000.'),
	'FE-10e màn tự diễn giải điều kiện thành câu',
	flowText.slice(-200),
);
await shot(page, 'FE-10e-soan-luong');

await clearToasts(page);
await page.getByRole('button', { name: 'Lưu luồng duyệt' }).click();
toast = await toastText(page, 20000);
line(new RegExp(`Đã lưu luồng duyệt, phiên bản ${versionBefore + 1}`).test(toast), 'FE-10e lưu luồng tăng phiên bản', toast);

const flowAfter = await api(hrToken, '/v1/general-requests/templates/6/flow');
const steps = flowAfter.json?.data?.steps ?? [];
line(flowAfter.json?.data?.version === versionBefore + 1, 'FE-10e máy chủ ghi phiên bản mới', String(flowAfter.json?.data?.version));
line(steps.length === 2, 'FE-10e luồng có hai bước', `${steps.length} bước`);
line(steps[1]?.approver?.kind === 'ROLE' && steps[1]?.approver?.role === 'DIRECTOR', 'FE-10e bước hai là vai trò Giám đốc', JSON.stringify(steps[1]?.approver));
const cond = steps[1]?.condition?.all?.[0];
line(
	cond?.field === 'so_tien' && cond?.op === '>=' && cond?.value === 100000000 && typeof cond?.value === 'number',
	'FE-10e điều kiện lưu đúng kiểu số, không phải chuỗi',
	JSON.stringify(steps[1]?.condition),
);
line(steps[1]?.slaHours === 16, 'FE-10e hạn xử lý lưu đúng 16 giờ', String(steps[1]?.slaHours));
await shot(page, 'FE-10e-luong-da-luu');

// ─── FE-10f: luồng sai do màn tự kiểm ───────────────────────────────────────
await page.getByRole('button', { name: 'Thêm bước' }).click();
await page.waitForTimeout(800);
const step3 = page.locator('ol > li').nth(2);
await fillByLabel(step3, 'Tên bước', '   ');
await selectByLabel(step3, page, 'Người duyệt của bước', 'Theo vai trò');
await clearToasts(page);
await page.getByRole('button', { name: 'Lưu luồng duyệt' }).click();
await page.waitForTimeout(1500);
const pageText = await text(page);
line(pageText.includes('Bước 3 chưa có tên.'), 'FE-10f màn báo bước thiếu tên', pageText.slice(0, 200));
line(pageText.includes('Bước 3 chưa chọn vai trò người duyệt.'), 'FE-10f màn báo bước thiếu vai trò');
const guardToast = await toastText(page, 8000);
line(/chưa hợp lệ/.test(guardToast), 'FE-10f có toast nhắc xem dòng đỏ', guardToast);
await shot(page, 'FE-10f-luong-sai-tu-kiem');

const flowUnchanged = await api(hrToken, '/v1/general-requests/templates/6/flow');
line(
	flowUnchanged.json?.data?.version === versionBefore + 1,
	'FE-10f luồng sai thì không gửi lên máy chủ, phiên bản không tăng',
	String(flowUnchanged.json?.data?.version),
);

// ─── FE-10g: câu lỗi của máy chủ khi luồng sai nghĩa ────────────────────────
// Dựng tình huống thật: nhân sự soạn điều kiện theo một trường, trường đó bị bỏ khỏi biểu mẫu
// ở tab khác, rồi mới bấm lưu. Màn phải hiện nguyên văn câu của máy chủ.
// Bài tự tạo loại phiếu riêng cho tình huống này, không mượn loại phiếu của bộ dựng dữ liệu:
// danh sách loại phiếu trên sandbox đổi theo từng lần dựng lại nên mã số không giữ nguyên.
const zTemplate = await api(hrToken, '/v1/general-requests/templates', {
	method: 'POST',
	body: JSON.stringify({
		name: `Mẫu thử điều kiện ${Date.now() % 100000}`,
		category: 'OTHER',
		codePrefix: 'DK',
		fields: [
			{ key: 'noi_dung', label: 'Nội dung', type: 'textarea', required: true },
			{ key: 'so_tien', label: 'Số tiền', type: 'number', required: true },
		],
		printTemplate: '<div><p>{{noi_dung}}</p><p>{{so_tien}}</p></div>',
	}),
});
const zId = zTemplate.json?.data?.id;
line(
	!!zId,
	'FE-10g dựng được loại phiếu để thử điều kiện theo trường bị xoá',
	`status=${zTemplate.status} ${zTemplate.text.slice(0, 200)}`,
);
await go(page, `/management/settings/request-types/${zId}/flow`, 3500);
await page.getByRole('button', { name: 'Thêm bước' }).click();
await page.waitForTimeout(800);
const zStep = page.locator('ol > li').last();
await fillByLabel(zStep, 'Tên bước', 'Buoc dieu kien');
await zStep.getByRole('button', { name: 'Thêm điều kiện' }).click();
await page.waitForTimeout(600);
await zStep.locator('button:has-text("Chọn trường")').first().click();
await page.waitForTimeout(400);
await pickOption(page, 'Số tiền');
await zStep.locator('input[placeholder="Giá trị so sánh"]').fill('5');
await page.waitForTimeout(400);

const patched = await api(hrToken, `/v1/general-requests/templates/${zId}`, {
	method: 'PATCH',
	body: JSON.stringify({
		fields: [{ key: 'noi_dung', label: 'Nội dung', type: 'textarea', required: true }],
	}),
});
line(patched.status === 200, 'FE-10g dựng được tình huống trường vừa bị bỏ khỏi biểu mẫu', `status=${patched.status}`);

await clearToasts(page);
await page.getByRole('button', { name: 'Lưu luồng duyệt' }).click();
const serverToast = await toastText(page, 20000);
line(
	/không có trong biểu mẫu/.test(serverToast),
	'FE-10g hiện nguyên văn câu lỗi của máy chủ',
	serverToast,
);
line(await page.getByRole('button', { name: 'Lưu luồng duyệt' }).isVisible(), 'FE-10g màn vẫn dùng được sau lỗi');
await shot(page, 'FE-10g-loi-may-chu');

console.log('\nlỗi console:', page.errors.filter(e => !e.includes('Failed to load resource')).slice(0, 5));
process.exitCode = summary() ? 1 : 0;
await browser.close();
