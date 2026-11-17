/**
 * Đợt sửa lô 4a: ô nhập số (N), xung đột lưu luồng và nộp lại (C), mẫu in (P).
 *
 * Module Tài sản đang tắt trên sandbox này nên các bài N trên ô của Tài sản không bấm được ở
 * đây; phần đó phủ bằng test thành phần `tests/number-input-component.test.ts`.
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
	proposalValues,
	seedRequest,
	selectByLabel,
	shot,
	signIn,
	summary,
	text,
	toastText,
	WEB,
	WHO,
} from './helper4a.mjs';

const browser = await launch();
const hrToken = await apiToken(WHO.hr.email);
const kdToken = await apiToken(WHO.kd1.email);
const mkdToken = await apiToken(WHO.mkd.email);
const stamp = Date.now() % 100000;

/** Mẫu "Đề xuất mua sắm" (id 4) có hai trường số: số lượng và đơn giá. */
const PURCHASE = 4;

/** Giá trị biểu mẫu mẫu mua sắm, trừ hai ô số sẽ gõ tay. */
function purchaseValues(extra = {}) {
	return {
		ten_cong_ty: 'A',
		phong_ban: 'Kinh doanh',
		ngay_van_ban: '2026-11-17',
		ten_hang_hoa: 'Máy tính để bàn',
		so_luong: 2,
		don_gia: 54000000,
		muc_dich: 'Trang bị cho nhân viên mới của phòng kinh doanh.',
		ten_nguoi_de_xuat: WHO.kd1.name,
		...extra,
	};
}

// Dựng luồng hai bước có điều kiện trên mẫu mua sắm, để bài C-03 có bước bị bỏ qua.
await api(hrToken, `/v1/general-requests/templates/${PURCHASE}/flow`, {
	method: 'PUT',
	body: JSON.stringify({
		steps: [
			{ name: 'HR duyệt', approver: { kind: 'ROLE', role: 'HR' }, mode: 'ANY' },
			{
				name: 'Giám đốc phê duyệt',
				approver: { kind: 'ROLE', role: 'DIRECTOR' },
				mode: 'ANY',
				slaHours: 16,
				condition: { all: [{ field: 'don_gia', op: '>=', value: 100000000 }] },
			},
		],
	}),
});

const kd = await signIn(browser, WHO.kd1.email);

/** Ghi lại thân request để kiểm payload gửi lên thật là số JSON. */
const sent = [];
kd.on('request', req => {
	if (!/\/v1\/general-requests/.test(req.url())) return;
	const body = req.postData();
	if (body) sent.push({ url: req.url(), method: req.method(), body });
});

/** Thân request gần nhất có `fieldValues`, bất kể là lần tạo nháp hay lần lưu nháp sau đó. */
function lastFieldValues() {
	for (let i = sent.length - 1; i >= 0; i--) {
		try {
			const body = JSON.parse(sent[i].body);
			if (body && typeof body === 'object' && body.fieldValues) return body.fieldValues;
		} catch {
			// Bỏ qua request không phải JSON.
		}
	}
	return null;
}

/** Ô số của một trường trên màn gửi phiếu. */
function numberInput(page, labelText) {
	return page.locator(`label:has-text("${labelText}")`).first().locator('xpath=following::input[1]');
}

// ════════════════════════ N-01: ô tiền của phiếu đề xuất ════════════════════════
await go(kd, '/general-requests/create', 4500);
await kd.getByRole('button', { name: /^Đề xuất mua sắm/ }).first().click();
await kd.waitForTimeout(2500);
await fillByLabel(kd, 'Tiêu đề phiếu', `N-01 ô số ${stamp}`);

const donGia = numberInput(kd, 'Đơn giá');
await donGia.click();
await donGia.type('80000');
await kd.waitForTimeout(600);
line((await donGia.inputValue()) === '80.000', 'N-01 gõ 80000 thì ô hiện 80.000', await donGia.inputValue());

// Điền nốt các ô còn lại rồi để nháp tự lưu, xem payload.
await numberInput(kd, 'Số lượng').fill('');
await numberInput(kd, 'Số lượng').type('2');
await fillByLabel(kd, 'Tên công ty', 'A');
await fillByLabel(kd, 'Tên hàng hoá', 'Máy tính để bàn');
await fillByLabel(kd, 'Mục đích', 'Trang bị cho nhân viên mới.');
await fillByLabel(kd, 'Người đề xuất', WHO.kd1.name);
await kd.waitForTimeout(5000);
const draftValues = lastFieldValues();
line(
	draftValues?.don_gia === 80000,
	'N-01 payload gửi lên là số 80000, không phải chuỗi "80.000"',
	JSON.stringify(draftValues ?? {}),
);
await shot(kd, 'N-01-o-tien-phieu-de-xuat');

// ════════════════════════ N-10: chữ cái không vào ô ════════════════════════
await donGia.fill('');
await donGia.type('12a3');
await kd.waitForTimeout(400);
line((await donGia.inputValue()) === '123', 'N-10 gõ chữ cái vào ô số thì không hiện', await donGia.inputValue());

// ════════════════════════ N-03: phím dấu chấm thành dấu thập phân ════════════════════════
await donGia.fill('');
await donGia.type('1234.5');
await kd.waitForTimeout(400);
line((await donGia.inputValue()) === '1.234,5', 'N-03 gõ 1234.5 bằng phím dấu chấm ra 1.234,5', await donGia.inputValue());

// ════════════════════════ N-05: cắt phần lẻ quá hai chữ số ════════════════════════
await donGia.fill('');
await donGia.type('1,2345');
await kd.waitForTimeout(400);
line((await donGia.inputValue()) === '1,23', 'N-05 gõ 1,2345 thì cắt còn 1,23', await donGia.inputValue());

// ════════════════════════ N-06: con trỏ không nhảy khi sửa giữa chuỗi ════════════════════════
await donGia.fill('');
await donGia.type('1234567');
await kd.waitForTimeout(400);
line((await donGia.inputValue()) === '1.234.567', 'N-06 dựng được 1.234.567', await donGia.inputValue());
// Đặt con trỏ sau chữ số thứ tư ("1.234|.567") rồi xoá một chữ số.
await donGia.evaluate(el => el.setSelectionRange(5, 5));
await kd.keyboard.press('Backspace');
await kd.waitForTimeout(400);
const afterDelete = await donGia.inputValue();
const caret = await donGia.evaluate(el => el.selectionStart);
line(afterDelete === '123.567', 'N-06 xoá đúng chữ số đang đứng cạnh', afterDelete);
line(caret === 3, 'N-06 con trỏ đứng lại đúng chỗ, không nhảy về cuối', `caret=${caret}`);
await shot(kd, 'N-06-con-tro-giu-cho');

// ════════════════════════ N-07: dán ba kiểu chuỗi ════════════════════════
for (const [pasted, expected] of [
	['1.234.567,89', '1.234.567,89'],
	['1234567.89', '1.234.567,89'],
	['1.234', '1.234'],
]) {
	await donGia.evaluate((el, value) => {
		el.focus();
		el.select();
		const data = new DataTransfer();
		data.setData('text/plain', value);
		el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
	}, pasted);
	await kd.waitForTimeout(400);
	line((await donGia.inputValue()) === expected, `N-07 dán "${pasted}" ra "${expected}"`, await donGia.inputValue());
}
await shot(kd, 'N-07-dan-chuoi-so');

// ════════════════════════ N-14: phiếu 108 triệu, chi tiết và bản in ════════════════════════
const bigOne = await seedRequest(kdToken, {
	templateId: PURCHASE,
	title: `N-14 phiếu 108 triệu ${stamp}`,
	fieldValues: purchaseValues({ don_gia: 108000000, so_luong: 1 }),
	pickedApprovers: undefined,
});
await api(kdToken, `/v1/general-requests/${bigOne.id}/submit`, { method: 'PATCH', body: '{}' });
const hrApprove = await api(hrToken, `/v1/general-requests/${bigOne.id}/approve`, {
	method: 'PATCH',
	body: JSON.stringify({ note: 'Đồng ý.' }),
});
line(hrApprove.status === 200, 'N-14 dựng được phiếu 108 triệu đã qua bước nhân sự', `status=${hrApprove.status}`);

await go(kd, `/general-requests/${bigOne.id}`, 5000);
// Trên khổ máy tính nội dung phiếu nằm trong khung bản phiếu, nên đọc chữ trong khung đó.
const bigFrame = clean(await kd.frameLocator('iframe').locator('body').innerText());
line(bigFrame.includes('108.000.000'), 'N-14 bản phiếu hiện 108.000.000', bigFrame.slice(0, 300));
line(!bigFrame.includes('108000000'), 'N-14 không còn số viết liền trong bản phiếu');
await shot(kd, 'N-14-chi-tiet-so-co-dau-nhom');

// ════════════════════════ N-11: điện thoại dùng bàn phím số ════════════════════════
const phone = await signIn(browser, WHO.kd1.email, { phone: true });
await go(phone, '/general-requests/create', 5000);
await phone.getByRole('button', { name: /^Đề xuất mua sắm/ }).first().click();
await phone.waitForTimeout(2500);
const phoneInput = numberInput(phone, 'Đơn giá');
line((await phoneInput.getAttribute('inputmode')) === 'decimal', 'N-11 ô tiền mở bàn phím số có dấu thập phân', await phoneInput.getAttribute('inputmode'));
await phoneInput.click();
await phoneInput.type('1500000');
await phone.waitForTimeout(400);
line((await phoneInput.inputValue()) === '1.500.000', 'N-11 ô số chạy đúng trên điện thoại', await phoneInput.inputValue());
const metrics = await phone.evaluate(() => ({
	scroll: document.documentElement.scrollWidth,
	client: document.documentElement.clientWidth,
}));
line(metrics.scroll <= metrics.client + 2, 'N-11 không tràn ngang', JSON.stringify(metrics));
await shot(phone, 'N-11-dien-thoai-o-so');

// ════════════════════════ N-04, N-12, N-13: màn luồng duyệt ════════════════════════
const hr = await signIn(browser, WHO.hr.email);
const flowSent = [];
hr.on('request', req => {
	if (/\/flow$/.test(req.url()) && req.method() === 'PUT') flowSent.push(req.postData() ?? '');
});

await go(hr, `/management/settings/request-types/${PURCHASE}/flow`, 5000);
const slaInput = hr.locator('label:has-text("Hạn xử lý (giờ làm việc)")').first().locator('xpath=following::input[1]');
await slaInput.fill('');
await slaInput.type('16,5');
await hr.waitForTimeout(400);
line((await slaInput.inputValue()) === '165', 'N-04 ô số nguyên không nhận dấu phẩy', await slaInput.inputValue());
await slaInput.fill('');
await slaInput.type('16');
await hr.waitForTimeout(300);

// N-12: điều kiện số hiện có dấu nhóm nghìn và lưu đúng kiểu số.
const step2 = hr.locator('ol > li').nth(1);
let condValue = step2.locator('input[placeholder="Giá trị so sánh"]').first();
line((await condValue.inputValue()) === '100.000.000', 'N-12 mở lại điều kiện thì hiện 100.000.000', await condValue.inputValue());
await condValue.fill('');
await condValue.type('120000000');
await hr.waitForTimeout(400);
line((await condValue.inputValue()) === '120.000.000', 'N-12 gõ lại ra 120.000.000', await condValue.inputValue());
await clearToasts(hr);
await hr.getByRole('button', { name: 'Lưu luồng duyệt' }).click();
let toast = await toastText(hr, 20000);
line(/Đã lưu luồng duyệt/.test(toast), 'N-12 lưu được luồng', toast);
let flowBody = flowSent.length ? JSON.parse(flowSent.at(-1)) : null;
line(
	flowBody?.steps?.[1]?.condition?.all?.[0]?.value === 120000000,
	'N-12 payload điều kiện là số 120000000',
	JSON.stringify(flowBody?.steps?.[1]?.condition ?? {}),
);
await shot(hr, 'N-12-dieu-kien-so');

// N-13: phép "nằm trong" trên trường số, tách bằng dấu chấm phẩy.
await step2.locator('button:has-text("lớn hơn hoặc bằng")').first().click();
await hr.waitForTimeout(400);
await pickOption(hr, 'nằm trong danh sách');
await hr.waitForTimeout(800);
line(
	(await step2.locator('button:has-text("nằm trong danh sách")').count()) > 0,
	'N-13 đổi được phép so sang "nằm trong danh sách"',
	clean(await step2.innerText()).slice(0, 200),
);
condValue = step2.locator('input[placeholder="Giá trị so sánh"]').first();
line(
	(await condValue.getAttribute('inputmode')) === null,
	'N-13 phép nằm trong dùng ô chữ để nhập danh sách, không dùng ô số',
	String(await condValue.getAttribute('inputmode')),
);
await condValue.fill('');
await condValue.type('1.000; 2.000');
await hr.waitForTimeout(400);
const hintText = clean(await step2.innerText());
line(/dấu chấm phẩy/.test(hintText), 'N-13 có câu hướng dẫn tách bằng dấu chấm phẩy', hintText.slice(-220));
await clearToasts(hr);
await hr.getByRole('button', { name: 'Lưu luồng duyệt' }).click();
toast = await toastText(hr, 20000);
flowBody = flowSent.length ? JSON.parse(flowSent.at(-1)) : null;
line(
	JSON.stringify(flowBody?.steps?.[1]?.condition?.all?.[0]?.value) === JSON.stringify([1000, 2000]),
	'N-13 payload là mảng số [1000, 2000]',
	JSON.stringify(flowBody?.steps?.[1]?.condition?.all?.[0] ?? {}),
);
await shot(hr, 'N-13-phep-nam-trong');

// Trả luồng về trạng thái có điều kiện số, cho các bài sau.
await api(hrToken, `/v1/general-requests/templates/${PURCHASE}/flow`, {
	method: 'PUT',
	body: JSON.stringify({
		steps: [
			{ name: 'HR duyệt', approver: { kind: 'ROLE', role: 'HR' }, mode: 'ANY' },
			{
				name: 'Giám đốc phê duyệt',
				approver: { kind: 'ROLE', role: 'DIRECTOR' },
				mode: 'ANY',
				slaHours: 16,
				condition: { all: [{ field: 'don_gia', op: '>=', value: 100000000 }] },
			},
		],
	}),
});

// ════════════════════════ C-01: hai tab cùng lưu luồng ════════════════════════
const flowNow = await api(hrToken, `/v1/general-requests/templates/${PURCHASE}/flow`);
const versionBefore = flowNow.json?.data?.version ?? 0;

await go(hr, `/management/settings/request-types/${PURCHASE}/flow`, 5000);
// "Tab 1" lưu trước bằng API, đúng như người khác vừa bấm Lưu ở máy họ.
const otherSave = await api(hrToken, `/v1/general-requests/templates/${PURCHASE}/flow`, {
	method: 'PUT',
	body: JSON.stringify({
		expectedVersion: versionBefore,
		steps: [{ name: 'HR duyệt một bước', approver: { kind: 'ROLE', role: 'HR' }, mode: 'ANY' }],
	}),
});
line(otherSave.status === 200, 'C-01 dựng được tình huống người khác vừa lưu', `status=${otherSave.status}`);

await clearToasts(hr);
await hr.getByRole('button', { name: 'Lưu luồng duyệt' }).click();
toast = await toastText(hr, 20000);
line(/vừa|người khác|đã đổi|tải lại/i.test(toast), 'C-01 tab sau nhận câu lỗi của máy chủ', toast);
await hr.waitForTimeout(3500);
const reloaded = await text(hr);
line(
	reloaded.includes(`Phiên bản hiện tại ${versionBefore + 1}`),
	'C-01 trang tự tải lại luồng mới của người kia',
	reloaded.slice(0, 200),
);
const stepNames = await hr.locator('ol > li input[type="text"]').first().inputValue();
line(stepNames === 'HR duyệt một bước', 'C-01 màn hiện đúng bước của người kia', stepNames);
await shot(hr, 'C-01-xung-dot-luu-luong');

// Dựng lại luồng hai bước cho bài C-03.
await api(hrToken, `/v1/general-requests/templates/${PURCHASE}/flow`, {
	method: 'PUT',
	body: JSON.stringify({
		steps: [
			{ name: 'HR duyệt', approver: { kind: 'ROLE', role: 'HR' }, mode: 'ANY' },
			{
				name: 'Giám đốc phê duyệt',
				approver: { kind: 'ROLE', role: 'DIRECTOR' },
				mode: 'ANY',
				slaHours: 16,
				condition: { all: [{ field: 'don_gia', op: '>=', value: 100000000 }] },
			},
		],
	}),
});

// ════════════════════════ C-02: nộp lại không đổi người chọn ════════════════════════
const returned = await seedRequest(kdToken, {
	title: `C-02 nộp lại ${stamp}`,
	pickedApprovers: [{ stepOrder: 1, employeeIds: [WHO.mkd.id] }],
});
const returnRes = await api(mkdToken, `/v1/general-requests/${returned.id}/return`, {
	method: 'PATCH',
	body: JSON.stringify({ note: 'Bạn bổ sung báo giá.' }),
});
line(returnRes.status === 200, 'C-02 dựng được phiếu bị trả lại', `status=${returnRes.status}`);

await go(kd, `/general-requests/create?id=${returned.id}`, 5500);
let editText = await text(kd);
line(editText.includes('Sửa và nộp lại phiếu'), 'C-02 mở được màn nộp lại');
const pickBox = pickerBox(kd, 'Người duyệt bạn chọn');
line(
	(await pickBox.getByRole('button', { name: `Bỏ chọn ${WHO.mkd.name}` }).count()) > 0,
	'C-02 người duyệt vòng trước được điền sẵn',
	clean(await pickBox.innerText()).slice(0, 160),
);
await clearToasts(kd);
await kd.getByRole('button', { name: 'Nộp lại phiếu' }).click();
toast = await toastText(kd, 25000);
line(/Đã nộp lại phiếu/.test(toast) && /vòng 2/.test(toast), 'C-02 nộp lại được, lên vòng 2', toast);
await kd.waitForTimeout(2500);
const afterResubmit = await api(kdToken, `/v1/general-requests/${returned.id}`);
line(afterResubmit.json?.data?.round === 2, 'C-02 máy chủ ghi vòng 2', String(afterResubmit.json?.data?.round));
line(
	afterResubmit.json?.data?.currentStep?.approvers?.[0]?.id === WHO.mkd.id,
	'C-02 vẫn đúng người duyệt cũ',
	JSON.stringify(afterResubmit.json?.data?.currentStep?.approvers),
);
await shot(kd, 'C-02-nop-lai-giu-nguoi-duyet');

// ════════════════════════ C-03: câu lý do bỏ bước ════════════════════════
await go(kd, '/general-requests/create', 4500);
await kd.getByRole('button', { name: /^Đề xuất mua sắm/ }).first().click();
await kd.waitForTimeout(2500);
await fillByLabel(kd, 'Tiêu đề phiếu', `C-03 tám mươi triệu ${stamp}`);
const price = numberInput(kd, 'Đơn giá');
await price.click();
await price.type('80000000');
await kd.waitForTimeout(4000);
const chain = clean(await kd.locator('section').filter({ hasText: 'Chuỗi người duyệt' }).last().innerText());
line(/từ 100\.000\.000 trở lên/.test(chain), 'C-03 câu lý do bỏ bước có số với dấu nhóm nghìn', chain.slice(0, 400));
line(!/>=|100000000/.test(chain), 'C-03 không còn ký hiệu toán và số viết liền', chain.slice(0, 400));
await shot(kd, 'C-03-cau-ly-do-bo-buoc');

// ════════════════════════ P-01: bản in bỏ trống căn cứ 2 và 3 ════════════════════════
const printable = await seedRequest(kdToken, {
	title: `P-01 bản in ${stamp}`,
	fieldValues: { ...proposalValues(), can_cu_2: undefined, can_cu_3: undefined },
	pickedApprovers: [{ stepOrder: 1, employeeIds: [WHO.mkd.id] }],
});
await api(mkdToken, `/v1/general-requests/${printable.id}/approve`, { method: 'PATCH', body: JSON.stringify({ note: 'Đồng ý.' }) });

await go(kd, `/general-requests/${printable.id}`, 5000);
const frameText = clean(await kd.frameLocator('iframe').locator('body').innerText());
line(!/\{\{/.test(frameText), 'P-01 khung nội dung không còn {{…}} của trường để trống', frameText.slice(0, 300));
const emptyBullets = await kd.frameLocator('iframe').locator('li').count();
line(emptyBullets === 1, 'P-01 chỉ còn một dòng căn cứ có nội dung', `${emptyBullets} dòng`);
await shot(kd, 'P-01-ban-in-khong-con-o-trong');

// ════════════════════════ P-02, P-03: mẫu in có mã độc và nút trong mẫu ════════════════════════
const badTemplate = await api(hrToken, '/v1/general-requests/templates', {
	method: 'POST',
	body: JSON.stringify({
		name: `Mẫu thử bảo mật ${stamp}`,
		category: 'OTHER',
		codePrefix: 'BM',
		fields: [{ key: 'noi_dung', label: 'Nội dung', type: 'textarea', required: true }],
		printTemplate:
			'<div><h1>MẪU THỬ</h1><script>window.__danger = 1; alert(1)</script>' +
			'<img src="x" onerror="window.__danger = 2; alert(2)">' +
			'<button class="preview-badge" onclick="window.print()">In trang này</button>' +
			'<p>{{noi_dung}}</p></div>',
	}),
});
const badId = badTemplate.json?.data?.id;
line(!!badId, 'P-02 dựng được loại phiếu có mã độc trong mẫu in', `id=${badId}`);

let dialogs = 0;
hr.on('dialog', async d => {
	dialogs++;
	await d.dismiss();
});

// Xem trước ở màn sửa loại phiếu.
await go(hr, '/management/settings/request-types', 4000);
const badRow = hr.locator('table tbody tr').filter({ hasText: `Mẫu thử bảo mật ${stamp}` }).first();
await badRow.getByRole('button', { name: 'Sửa loại phiếu' }).click();
await hr.waitForTimeout(1500);
const form = hr.locator('div.fixed.inset-0').filter({ hasText: 'Sửa loại phiếu' }).last();
await form.getByRole('button', { name: 'Preview' }).click();
await hr.waitForTimeout(2500);
const previewFrame = form.locator('iframe');
line(await previewFrame.count() > 0, 'P-02 xem trước mẫu in dựng trong iframe, không dùng v-html');
line((await previewFrame.getAttribute('sandbox')) === 'allow-same-origin', 'P-02 iframe xem trước không cho chạy script', await previewFrame.getAttribute('sandbox'));
const previewText = clean(await hr.frameLocator('div.fixed.inset-0 iframe').locator('body').innerText());
line(previewText.includes('MẪU THỬ'), 'P-02 xem trước vẫn hiện nội dung mẫu', previewText.slice(0, 160));
const previewDanger = await hr.evaluate(() => window.__danger ?? null);
line(dialogs === 0 && previewDanger === null, 'P-02 không có hộp alert và không có mã nào chạy ở màn xem trước', `dialogs=${dialogs} danger=${previewDanger}`);
await shot(hr, 'P-02a-xem-truoc-khong-chay-script');
await form.getByRole('button', { name: 'Hủy' }).click();
await hr.waitForTimeout(800);

// Mở chi tiết một phiếu dùng mẫu đó rồi bấm In.
// Loại phiếu mới có luồng mặc định "người gửi chọn", nên phải chọn người lúc gửi.
const badRequest = await seedRequest(kdToken, {
	templateId: badId,
	title: `P-02 phiếu mẫu độc ${stamp}`,
	fieldValues: { noi_dung: 'Nội dung bình thường.' },
	pickedApprovers: [{ stepOrder: 1, employeeIds: [WHO.mkd.id] }],
});
const badApprove = await api(mkdToken, `/v1/general-requests/${badRequest.id}/approve`, {
	method: 'PATCH',
	body: JSON.stringify({ note: 'Đồng ý.' }),
});
line(badApprove.status === 200, 'P-02 dựng được phiếu đã duyệt theo mẫu đó', `status=${badApprove.status}`);

let kdDialogs = 0;
kd.on('dialog', async d => {
	kdDialogs++;
	await d.dismiss();
});
await go(kd, `/general-requests/${badRequest.id}`, 5000);
const detailDanger = await kd.evaluate(() => window.__danger ?? null);
line(kdDialogs === 0 && detailDanger === null, 'P-02 mở chi tiết phiếu không chạy mã của mẫu', `dialogs=${kdDialogs} danger=${detailDanger}`);

// Bấm In: cửa sổ in là iframe sandbox nên chặn mã, và nút trong mẫu bị ẩn.
await kd.evaluate(() => {
	// Không để hộp thoại in của trình duyệt chặn bài chạy tiếp.
	window.__printed = 0;
	const original = window.print.bind(window);
	window.print = () => {
		window.__printed++;
	};
	void original;
});
await clearToasts(kd);
await kd.getByRole('button', { name: /^In phiếu/ }).first().click();
await kd.waitForTimeout(4000);
const printFrame = kd.locator('iframe[sandbox]').last();
const printSandbox = await printFrame.getAttribute('sandbox');
line(/allow-same-origin/.test(printSandbox ?? '') && !/allow-scripts/.test(printSandbox ?? ''), 'P-02 cửa sổ in là iframe sandbox không cho chạy script', printSandbox);
const printDanger = await kd.evaluate(() => window.__danger ?? null);
line(kdDialogs === 0 && printDanger === null, 'P-02 bấm In cũng không chạy mã của mẫu', `dialogs=${kdDialogs} danger=${printDanger}`);
const printSrcdoc = (await printFrame.getAttribute('srcdoc')) ?? '';
line(!/<script/i.test(printSrcdoc) && !/onerror=/i.test(printSrcdoc), 'P-02 nội dung bản in đã bị lọc thẻ script và onerror', printSrcdoc.slice(0, 200));
line(/display:none/.test(printSrcdoc) && /preview-badge/.test(printSrcdoc), 'P-03 bản in ẩn nút "In trang này" của mẫu', printSrcdoc.slice(printSrcdoc.indexOf('preview-badge') - 60, printSrcdoc.indexOf('preview-badge') + 40));
await shot(kd, 'P-02b-in-khong-chay-script');

// P-03 trên mẫu Tờ trình thật.
await go(kd, `/general-requests/${printable.id}`, 4500);
await kd.evaluate(() => {
	window.print = () => {};
});
await kd.getByRole('button', { name: /^In phiếu/ }).first().click();
await kd.waitForTimeout(3500);
const proposalSrcdoc = (await kd.locator('iframe[sandbox]').last().getAttribute('srcdoc')) ?? '';
line(/preview-badge[^}]*display:none/.test(proposalSrcdoc.replace(/\s+/g, '')) || /\.preview-badge,\.no-print\{display:none!important\}/.test(proposalSrcdoc.replace(/\s+/g, '')), 'P-03 bản in Tờ trình có CSS ẩn nút trong mẫu', proposalSrcdoc.slice(0, 200));
line(!/\{\{/.test(proposalSrcdoc), 'P-03 bản in Tờ trình không còn ô trống dạng {{…}}');
await shot(kd, 'P-03-ban-in-to-trinh');

console.log('\nlỗi console KD01:', kd.errors.filter(e => !e.includes('Failed to load resource') && !e.includes('sandboxed')).slice(0, 5));
console.log('lỗi console HR:', hr.errors.filter(e => !e.includes('Failed to load resource') && !e.includes('sandboxed')).slice(0, 5));
process.exitCode = summary() ? 1 : 0;
await browser.close();
