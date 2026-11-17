/**
 * Ô nhập số trên các màn Tài sản: N-02, N-03, N-05 đến N-10, N-15.
 *
 * Module ASSET vừa được bật trên sandbox nên bấm thật được. Dữ liệu tài sản đang trống, bài này
 * tự tạo một thiết bị và một dịch vụ qua giao diện rồi dùng lại cho các bài sau.
 */
import {
	api,
	apiToken,
	clean,
	clearToasts,
	go,
	launch,
	line,
	pickOption,
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
const stamp = Date.now() % 100000;

const hr = await signIn(browser, WHO.hr.email);

/** Thân request đã gửi, để kiểm payload là số JSON. */
const sent = [];
hr.on('request', req => {
	if (!/\/v1\/assets/.test(req.url())) return;
	const body = req.postData();
	if (body) sent.push({ url: req.url(), method: req.method(), body });
});

function lastJson(pattern, method) {
	for (let i = sent.length - 1; i >= 0; i--) {
		if (!pattern.test(sent[i].url)) continue;
		if (method && sent[i].method !== method) continue;
		try {
			return JSON.parse(sent[i].body);
		} catch {
			return null;
		}
	}
	return null;
}

/** Ô nhập ngay sau một nhãn trong hộp thoại tài sản. */
function fieldAfter(scope, labelText) {
	return scope.locator(`label:has-text("${labelText}")`).first().locator('xpath=following::input[1]');
}

await go(hr, '/management/assets', 5000);
let body = await text(hr);
line(body.includes('Thêm tài sản'), 'mở được trang Tài sản sau khi bật module', body.slice(0, 200));

// ════════════════════════ N-02, N-05, N-06, N-07, N-10: ô Nguyên giá ════════════════════════
await hr.getByRole('button', { name: 'Thêm tài sản' }).first().click();
await hr.waitForTimeout(2500);
const form = hr.locator('div.fixed.inset-0').last();
line(await form.isVisible(), 'N-02 hộp thoại thêm tài sản mở ra');

const cost = fieldAfter(form, 'Nguyên giá');
await cost.click();
await cost.type('1234,59');
await hr.waitForTimeout(400);
line((await cost.inputValue()) === '1.234,59', 'N-02 gõ 1234,59 thì ô hiện 1.234,59', await cost.inputValue());

await cost.fill('');
await cost.type('1234.5');
await hr.waitForTimeout(400);
line((await cost.inputValue()) === '1.234,5', 'N-03 gõ 1234.5 bằng phím dấu chấm ra 1.234,5', await cost.inputValue());

await cost.fill('');
await cost.type('1,2345');
await hr.waitForTimeout(400);
line((await cost.inputValue()) === '1,23', 'N-05 ô tiền cắt phần lẻ còn hai chữ số', await cost.inputValue());

await cost.fill('');
await cost.type('1234567');
await cost.evaluate(el => el.setSelectionRange(5, 5));
await hr.keyboard.press('Backspace');
await hr.waitForTimeout(400);
line((await cost.inputValue()) === '123.567', 'N-06 xoá giữa chuỗi ra 123.567', await cost.inputValue());
line((await cost.evaluate(el => el.selectionStart)) === 3, 'N-06 con trỏ không nhảy về cuối', String(await cost.evaluate(el => el.selectionStart)));

for (const [pasted, expected] of [
	['1.234.567,89', '1.234.567,89'],
	['1234567.89', '1.234.567,89'],
	['1.234', '1.234'],
]) {
	await cost.evaluate((el, value) => {
		el.focus();
		el.select();
		const data = new DataTransfer();
		data.setData('text/plain', value);
		el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
	}, pasted);
	await hr.waitForTimeout(350);
	line((await cost.inputValue()) === expected, `N-07 ô tiền tài sản dán "${pasted}" ra "${expected}"`, await cost.inputValue());
}

await cost.fill('');
await cost.type('18a500b000,5');
await hr.waitForTimeout(400);
line((await cost.inputValue()) === '18.500.000,5', 'N-10 chữ cái bị bỏ, phần số vẫn đúng', await cost.inputValue());
await shot(hr, 'N-02-o-nguyen-gia-tai-san');

// ════════════════════════ N-04: ô số nguyên của tài sản ════════════════════════
const warranty = fieldAfter(form, 'Bảo hành (tháng)');
await warranty.click();
await warranty.type('12,5');
await hr.waitForTimeout(400);
line((await warranty.inputValue()) === '125', 'N-04 ô số tháng không nhận dấu phẩy', await warranty.inputValue());
await warranty.fill('');
await warranty.type('12');

// ════════════════════════ N-15: tỷ giá 0 với tiền tệ ngoại tệ ════════════════════════
await fieldAfter(form, 'Tên tài sản').fill(`Máy tính thử ô số ${stamp}`);
// `UiSelectInput` của màn tài sản mở bằng một div có tabindex, không phải nút, và có ô gõ tìm.
const categoryTrigger = form
	.locator('label:has-text("Loại tài sản")')
	.first()
	.locator('xpath=following::div[@tabindex="0"][1]');
await categoryTrigger.click();
await hr.waitForTimeout(600);
const categorySearch = form.locator('input[placeholder="Tìm kiếm..."]').first();
await categorySearch.fill('Laptop');
await hr.waitForTimeout(800);
const categoryOption = hr.locator('[class*="option"]', { hasText: 'Laptop' }).first();
if (await categoryOption.count()) await categoryOption.click();
else await hr.keyboard.press('Enter');
await hr.waitForTimeout(600);
line(
	clean(await categoryTrigger.innerText()).length > 0 && !/Chọn Nhóm/.test(clean(await categoryTrigger.innerText())),
	'N-15 chọn được loại tài sản',
	clean(await categoryTrigger.innerText()),
);
const currency = fieldAfter(form, 'Tiền tệ');
await currency.fill('USD');
const rate = fieldAfter(form, 'Tỷ giá');
await rate.click();
await rate.type('0');
await hr.waitForTimeout(300);
line((await rate.inputValue()) === '0', 'N-15 ô tỷ giá nhận số 0, không tự sửa thành 1', await rate.inputValue());
await clearToasts(hr);
await form.getByRole('button', { name: /Lưu|Tạo/ }).last().click();
let toast = await toastText(hr, 20000);
line(toast.length > 5 && !/Đã tạo/.test(toast), 'N-15 máy chủ chặn tỷ giá 0 và màn hiện câu lỗi', toast);
line(await form.isVisible(), 'N-15 hộp thoại vẫn mở, không trắng trang');
await shot(hr, 'N-15-ty-gia-khong');

// Sửa lại cho hợp lệ rồi lưu: tiền tệ VND, nguyên giá 18.500.000,5.
await currency.fill('VND');
await rate.fill('');
await cost.fill('');
await cost.type('18500000,5');
await hr.waitForTimeout(400);
await clearToasts(hr);
await form.getByRole('button', { name: /Lưu|Tạo/ }).last().click();
toast = await toastText(hr, 25000);
line(/Đã tạo|Đã lưu/.test(toast), 'N-02 tạo được tài sản với nguyên giá có số lẻ', toast);

const created = lastJson(/\/v1\/assets$/, 'POST');
line(created?.cost === 18500000.5, 'N-02 payload nguyên giá là số 18500000.5', JSON.stringify({ cost: created?.cost, warrantyMonths: created?.warrantyMonths }));
line(created?.warrantyMonths === 12, 'N-04 payload số tháng là số nguyên 12', String(created?.warrantyMonths));
line(!('exchangeRate' in (created ?? {})) || created?.exchangeRate === undefined, 'N-08 ô tỷ giá xoá hết thì không gửi lên, không gửi 0', JSON.stringify(created?.exchangeRate));
await shot(hr, 'N-08-payload-o-trong');

// ════════════════════════ N-09: mở sửa tài sản có nguyên giá số lẻ ════════════════════════
await hr.waitForTimeout(2500);
await go(hr, '/management/assets', 5000);
const row = hr.locator('table tbody tr').filter({ hasText: `Máy tính thử ô số ${stamp}` }).first();
line((await row.count()) > 0, 'N-09 tài sản vừa tạo có trong danh sách');
// Dòng mở chi tiết bằng NuxtLink ở tên tài sản, không phải bằng cách bấm cả dòng.
const detailHref = await row.locator('a[href^="/management/assets/"]').first().getAttribute('href');
await go(hr, detailHref, 5000);
let detailText = await text(hr);
line(/18\.500\.000/.test(detailText), 'N-09 trang chi tiết hiện nguyên giá có dấu nhóm nghìn', detailText.slice(0, 400));

// Nút sửa nằm trong menu "Tác vụ", các mục của menu teleport ra body nên bấm bằng evaluate.
await hr.getByRole('button', { name: 'Tác vụ' }).first().click();
await hr.waitForTimeout(700);
const editItem = hr.locator('button', { hasText: 'Chỉnh sửa' }).last();
line((await editItem.count()) > 0, 'N-09 menu Tác vụ có mục Chỉnh sửa');
await editItem.evaluate(el => el.click());
await hr.waitForTimeout(3000);
const editForm = hr.locator('div.fixed.inset-0').last();
const editCost = fieldAfter(editForm, 'Nguyên giá');
line((await editCost.inputValue()) === '18.500.000,5', 'N-09 mở sửa thì ô hiện 18.500.000,5', await editCost.inputValue());
await shot(hr, 'N-09-mo-sua-tai-san');
await editForm.getByRole('button', { name: 'Đóng' }).last().click();
await hr.waitForTimeout(1000);

// ════════════════════════ N-11: ô số tài sản trên điện thoại ════════════════════════
const phone = await signIn(browser, WHO.hr.email, { phone: true });
await go(phone, '/management/assets', 5000);
await phone.getByRole('button', { name: 'Thêm tài sản' }).first().click();
await phone.waitForTimeout(2500);
const phoneForm = phone.locator('div.fixed.inset-0').last();
const phoneCost = fieldAfter(phoneForm, 'Nguyên giá');
line((await phoneCost.getAttribute('inputmode')) === 'decimal', 'N-11 ô tiền tài sản mở bàn phím số thập phân', await phoneCost.getAttribute('inputmode'));
await phoneCost.click();
await phoneCost.type('2500000');
await phone.waitForTimeout(400);
line((await phoneCost.inputValue()) === '2.500.000', 'N-11 ô số tài sản chạy đúng trên điện thoại', await phoneCost.inputValue());
const metrics = await phone.evaluate(() => ({
	scroll: document.documentElement.scrollWidth,
	client: document.documentElement.clientWidth,
}));
line(metrics.scroll <= metrics.client + 2, 'N-11 hộp thoại tài sản không tràn ngang trên điện thoại', JSON.stringify(metrics));
await shot(phone, 'N-11-dien-thoai-o-so-tai-san');

console.log('\nlỗi console HR:', hr.errors.filter(e => !e.includes('Failed to load resource') && !e.includes('sandboxed')).slice(0, 5));
process.exitCode = summary() ? 1 : 0;
await browser.close();
