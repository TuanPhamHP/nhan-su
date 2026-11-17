/**
 * FE-01, FE-02, FE-03 — nhân viên kinh doanh gửi phiếu.
 *
 * Ba thứ cần thấy: danh sách chọn người duyệt không có chính mình, chuỗi duyệt đổi theo giá trị
 * biểu mẫu (bước giám đốc chỉ hiện khi số tiền từ 100 triệu), và lỗi nhập sai hiện cạnh ô chứ
 * không làm trắng trang.
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
	pickPerson,
	proposalValues,
	shot,
	signIn,
	summary,
	text,
	toastText,
	WHO,
} from './helper4a.mjs';

const browser = await launch();
const page = await signIn(browser, WHO.kd1.email);
const hrToken = await apiToken(WHO.hr.email);

/** Điền biểu mẫu "Tờ trình BGĐ" trên màn gửi phiếu. */
async function fillProposalForm(title) {
	const values = proposalValues();
	await fillByLabel(page, 'Tiêu đề phiếu', title);
	for (const [label, value] of [
		['Số tờ trình', values.so_to_trinh],
		['Tên công ty', values.ten_cong_ty],
		['Về việc', values.ve_viec],
		['Căn cứ 1', values.can_cu_1],
		['Nội dung', values.noi_dung],
		['Tên giám đốc', values.ten_giam_doc],
		['Người đề nghị', values.ten_nguoi_de_nghi],
	]) {
		const label_ = page.locator(`label:has-text("${label}")`).first();
		if (await label_.count()) await fillByLabel(page, label, value);
	}
	// Ngày văn bản: ô ngày dùng chung nhận chữ dạng dd/mm/yyyy.
	const dateInput = page.locator('input[placeholder="dd/mm/yyyy"]').first();
	if (await dateInput.count()) {
		await dateInput.fill('16/11/2026');
		await dateInput.press('Tab');
	}
	// Phòng ban: ô chọn lấy danh sách từ danh mục phòng ban.
	const phongBanLabel = page.locator('label:has-text("Phòng ban")').first();
	if (await phongBanLabel.count()) {
		await phongBanLabel.locator('xpath=following::button[1]').click();
		await page.waitForTimeout(500);
		const option = page.getByRole('button', { name: 'Kinh doanh', exact: true }).last();
		if (await option.count()) await option.evaluate(el => el.click());
	}
	await page.waitForTimeout(1500);
}

// ════════════════════════ FE-01: gửi Tờ trình BGĐ ════════════════════════
await go(page, '/general-requests/create', 4000);
let body = await text(page);
line(body.includes('Tờ trình BGĐ'), 'FE-01a màn gửi phiếu liệt kê loại phiếu đang dùng');
line(!body.includes('Hỏi nhân viên'), 'FE-01a loại phiếu đã tắt không hiện ở màn gửi');
await shot(page, 'FE-01a-chon-loai-phieu');

await page.getByRole('button', { name: /^Tờ trình BGĐ/ }).first().click();
await page.waitForTimeout(2500);
await fillProposalForm('Tờ trình mua máy tính (FE-01)');

// Chuỗi duyệt: bước người gửi chọn, danh sách không có chính mình.
let chain = clean(await page.locator('section').filter({ hasText: 'Chuỗi người duyệt' }).last().innerText());
line(chain.includes('Người duyệt do người gửi chọn'), 'FE-01b chuỗi hiện bước người gửi chọn', chain.slice(0, 200));
line(/Chọn 1 đến 5 người/.test(chain), 'FE-01b nói rõ chọn được bao nhiêu người', chain.slice(0, 240));

const pickBox = pickerBox(page, 'Người duyệt bạn chọn');
await pickBox.locator('input[type="text"]').last().fill(WHO.kd1.name);
await page.waitForTimeout(900);
const selfSearch = clean(await pickBox.innerText());
line(
	selfSearch.includes('Không tìm thấy ai phù hợp'),
	'FE-01b danh sách chọn người duyệt không có chính mình',
	selfSearch.slice(0, 200),
);
await shot(page, 'FE-01b-khong-chon-duoc-chinh-minh');

line(await pickPerson(pickBox, page, WHO.mkd.name), 'FE-01c chọn được trưởng phòng làm người duyệt');
await page.waitForTimeout(1500);
line(await pickPerson(pickBox, page, WHO.ch.name), 'FE-01c chọn thêm người duyệt thứ hai');
await page.waitForTimeout(2500);
chain = clean(await page.locator('section').filter({ hasText: 'Chuỗi người duyệt' }).last().innerText());
line(
	chain.includes(WHO.mkd.name) && chain.includes(WHO.ch.name),
	'FE-01c chuỗi tính lại theo người vừa chọn',
	chain.slice(0, 300),
);
await shot(page, 'FE-01c-chuoi-sau-khi-chon');

await clearToasts(page);
await page.getByRole('button', { name: 'Gửi phiếu' }).click();
const sentToast = await toastText(page, 25000);
line(/Đã gửi phiếu, số hiệu TT-\d+\/\d{4}/.test(sentToast), 'FE-01d gửi xong hiện số hiệu TT-…', sentToast);
await page.waitForTimeout(3000);
line(/\/general-requests\/\d+$/.test(page.url()), 'FE-01d mở thẳng trang phiếu vừa gửi', page.url());
const detail = await text(page);
line(/TT-\d+\/\d{4}/.test(detail), 'FE-01d trang phiếu hiện số hiệu', detail.slice(0, 200));
line(detail.includes('Chờ duyệt'), 'FE-01d phiếu ở trạng thái chờ duyệt');
line(detail.includes(WHO.mkd.name), 'FE-01d bước đầu đang chờ trưởng phòng');
await shot(page, 'FE-01d-phieu-vua-gui');

// ════════════════ FE-02: chuỗi duyệt đổi theo số tiền ════════════════
// Bộ dựng dữ liệu của BE kết thúc khi luồng loại phiếu này còn một bước "HR duyệt", nên bài tự
// dựng lại luồng hai bước có điều kiện số tiền, thay vì dựa vào trạng thái dở của bộ kia.
const templates = await api(hrToken, '/v1/general-requests/templates');
const training = (templates.json?.data ?? []).find(t => t.name === 'Đề xuất đào tạo');
line(!!training, 'FE-02 sandbox có loại phiếu Đề xuất đào tạo', JSON.stringify((templates.json?.data ?? []).map(t => t.name)));
const trainingFlow = await api(hrToken, `/v1/general-requests/templates/${training.id}/flow`);
const installed = await api(hrToken, `/v1/general-requests/templates/${training.id}/flow`, {
	method: 'PUT',
	body: JSON.stringify({
		expectedVersion: trainingFlow.json?.data?.version ?? 0,
		steps: [
			{ name: 'HR duyệt', approver: { kind: 'ROLE', role: 'HR' }, mode: 'ANY' },
			{
				name: 'Giám đốc phê duyệt',
				approver: { kind: 'ROLE', role: 'DIRECTOR' },
				mode: 'ANY',
				condition: { all: [{ field: 'so_tien', op: '>=', value: 100000000 }] },
			},
		],
	}),
});
line(installed.status === 200, 'FE-02 dựng được luồng hai bước có điều kiện số tiền', `status=${installed.status} ${installed.text.slice(0, 200)}`);

await go(page, '/general-requests/create', 4000);
await page.getByRole('button', { name: /^Đề xuất đào tạo/ }).first().click();
await page.waitForTimeout(2500);
await fillByLabel(page, 'Tiêu đề phiếu', 'Đề xuất đào tạo 80 triệu (FE-02)');
await fillByLabel(page, 'Nội dung', 'Khoá đào tạo kỹ năng bán hàng cho mười nhân viên.');
await fillByLabel(page, 'Số tiền', '80000000');
await page.waitForTimeout(3000);

const chainBox = page.locator('section').filter({ hasText: 'Chuỗi người duyệt' }).last();
let chain80 = clean(await chainBox.innerText());
line(chain80.includes('HR duyệt'), 'FE-02a bước nhân sự luôn có trong chuỗi', chain80.slice(0, 240));
line(chain80.includes('Giám đốc phê duyệt'), 'FE-02a bước giám đốc vẫn hiện để người gửi thấy');
line(chain80.includes('Bỏ qua'), 'FE-02a bước giám đốc được đánh dấu bỏ qua khi 80 triệu');
line(
	/điều kiện|không khớp|Số tiền/i.test(chain80),
	'FE-02a có câu giải thích vì sao bước bị bỏ qua',
	chain80.slice(0, 400),
);
await shot(page, 'FE-02a-80-trieu-bo-qua-giam-doc');

await fillByLabel(page, 'Số tiền', '120000000');
await page.waitForTimeout(3500);
const chain120 = clean(await chainBox.innerText());
line(!chain120.includes('Bỏ qua'), 'FE-02b 120 triệu thì không còn bước nào bị bỏ qua', chain120.slice(0, 300));
line(
	chain120.includes(WHO.gd.name) && chain120.includes(WHO.pgd.name),
	'FE-02b bước giám đốc hiện đủ hai giám đốc',
	chain120.slice(0, 400),
);
await shot(page, 'FE-02b-120-trieu-hien-hai-giam-doc');

await clearToasts(page);
await page.getByRole('button', { name: 'Gửi phiếu' }).click();
const trainToast = await toastText(page, 25000);
line(/Đã gửi phiếu, số hiệu DT-/.test(trainToast), 'FE-02c gửi được phiếu đào tạo', trainToast);
await page.waitForTimeout(2500);
const trainDetail = await text(page);
line(trainDetail.includes('HR duyệt'), 'FE-02c phiếu đang ở bước nhân sự');
line(
	trainDetail.includes('Giám đốc phê duyệt'),
	'FE-02c bước giám đốc nằm trong chuỗi của phiếu vì số tiền từ 100 triệu',
);
await shot(page, 'FE-02c-phieu-dao-tao-da-gui');

// ════════════════ FE-03: thiếu trường bắt buộc, nhập chữ vào ô số ════════════════
await go(page, '/general-requests/create', 4000);
await page.getByRole('button', { name: /^Đề xuất đào tạo/ }).first().click();
await page.waitForTimeout(2500);
await clearToasts(page);
await page.getByRole('button', { name: 'Gửi phiếu' }).click();
await page.waitForTimeout(1500);
let formText = await text(page);
line(
	formText.includes('Tiêu đề phiếu phải có ít nhất ba ký tự'),
	'FE-03a thiếu tiêu đề thì báo ngay cạnh ô',
	formText.slice(0, 240),
);

await fillByLabel(page, 'Tiêu đề phiếu', 'Phiếu thiếu trường (FE-03)');
await clearToasts(page);
await page.getByRole('button', { name: 'Gửi phiếu' }).click();
const missingToast = await toastText(page, 20000);
await page.waitForTimeout(1200);
formText = await text(page);
line(/bắt buộc/.test(missingToast + formText), 'FE-03b thiếu trường bắt buộc thì có câu tiếng Việt', missingToast);
line(formText.includes('"Nội dung" là bắt buộc.'), 'FE-03b câu lỗi của máy chủ nằm cạnh ô Nội dung', formText.slice(0, 400));
line(formText.includes('"Số tiền" là bắt buộc.'), 'FE-03b câu lỗi nằm cạnh ô Số tiền');
line(formText.includes('Gửi phiếu'), 'FE-03b trang vẫn còn biểu mẫu, không trắng');
await shot(page, 'FE-03b-thieu-truong-bat-buoc');

// Ô số: gõ chữ thì ô number không nhận, nên gửi lên là rỗng và máy chủ báo bắt buộc.
await fillByLabel(page, 'Nội dung', 'Nội dung hợp lệ.');
const amount = page.locator('label:has-text("Số tiền")').first().locator('xpath=following::input[1]');
await amount.fill('');
await amount.type('một trăm triệu');
await page.waitForTimeout(800);
line((await amount.inputValue()) === '', 'FE-03c ô số không nhận chữ', await amount.inputValue());
await clearToasts(page);
await page.getByRole('button', { name: 'Gửi phiếu' }).click();
const textToast = await toastText(page, 20000);
await page.waitForTimeout(1000);
formText = await text(page);
line(
	formText.includes('"Số tiền" là bắt buộc.') || /Số tiền/.test(textToast),
	'FE-03c gõ chữ vào ô số thì vẫn có lỗi tiếng Việt cạnh ô',
	`${textToast} | ${formText.slice(0, 200)}`,
);
line(page.url().includes('/general-requests/create'), 'FE-03c vẫn ở màn gửi phiếu', page.url());
await shot(page, 'FE-03c-chu-trong-o-so');

console.log('\nlỗi console:', page.errors.filter(e => !e.includes('Failed to load resource')).slice(0, 5));
process.exitCode = summary() ? 1 : 0;
await browser.close();
