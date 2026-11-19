/**
 * FE-37, FE-38, FE-39, FE-44, FE-45, FE-46: phiếu văn phòng phẩm sau UAT đợt B.
 *
 * Bài tự dựng một kỳ riêng ở tháng còn trống cho phòng A, nên không đụng tới kỳ của các bài khác.
 * Trọng tâm là những chỗ người dùng mất số mà không được báo: ô số lặng lẽ bỏ ký tự lạ (FE-37),
 * số chưa lưu mất khi chuyển thẻ tháng (FE-38), và xoá dòng không hỏi lại (FE-39).
 */
import {
	WHO,
	api,
	apiToken,
	clearToasts,
	dialog,
	go,
	launch,
	line,
	pickSearchable,
	shot,
	signIn,
	summary,
	text,
	toastText,
	ymd,
} from './helper.mjs';

const hrToken = await apiToken(WHO.hr.email);
const a1Token = await apiToken(WHO.employeeA1.email);
const mgrToken = await apiToken(WHO.managerA.email);

const sites = (await api(hrToken, '/v1/office/sites')).json?.data ?? [];
const site = sites[0];
if (!site) throw new Error('sandbox chưa có văn phòng — chạy smoke-settings.mjs trước');

const items = (await api(a1Token, '/v1/me/office/supply-items')).json?.data ?? [];
if (items.length < 4) throw new Error('danh mục trống — chạy smoke-settings.mjs trước');
const pencil = items.find(i => /Bút chì/i.test(i.name));
const plain = items.find(i => i.quota == null && i.id !== pencil?.id) ?? items[1];
if (!pencil) throw new Error('danh mục không có mặt hàng "Bút chì gỗ" để thử tìm không dấu');

/** Tháng còn trống của văn phòng này, để mở kỳ riêng cho bài. */
const periods = (await api(hrToken, '/v1/office/supply-periods')).json?.data ?? [];
const taken = new Set(periods.filter(p => p.officeSite.id === site.id).map(p => p.month));
let month = null;
for (let offset = 1; offset <= 24 && !month; offset++) {
	const at = new Date();
	const candidate = new Date(at.getFullYear(), at.getMonth() + offset, 1);
	const value = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}`;
	if (!taken.has(value)) month = value;
}
if (!month) throw new Error('không còn tháng trống để mở kỳ cho bài này');

const deadline = ymd(new Date(Date.now() + 6 * 24 * 60 * 60 * 1000));
const created = await api(hrToken, '/v1/office/supply-periods', {
	method: 'POST',
	body: JSON.stringify({
		officeSiteId: site.id,
		month,
		deadline,
		departmentIds: [WHO.employeeA1.departmentId],
	}),
});
if (created.status >= 400) throw new Error(`không mở được kỳ: ${created.status} ${created.text.slice(0, 200)}`);
const period = created.json.data;
console.log(`bài dùng kỳ ${period.title} (id ${period.id}), hạn chót ${deadline}`);

const myRequests = (await api(a1Token, '/v1/me/office/supply-requests')).json?.data ?? [];
const request = myRequests.find(r => r.period.id === period.id);
if (!request) throw new Error('phòng A không có phiếu trong kỳ vừa mở');

const browser = await launch();
const a1 = await signIn(browser, WHO.employeeA1.email);
await go(a1, `/office/supplies?request_id=${request.id}`, 4000);
line((await text(a1)).includes(period.title), 'FE-37 mở đúng phiếu của kỳ vừa mở', period.title);

const addBox = a1.locator('section', { hasText: 'Thêm mặt hàng' }).first();

// ─── FE-45: tìm không dấu, và mặt hàng đã có trong phiếu ──────────────────────
await pickSearchable(addBox, a1, 0, 'but chi', 'Bút chì');
await a1.waitForTimeout(500);
const pickedLabel = await addBox.locator('[class*="selectedLabel"]').first().innerText();
line(
	/Bút chì/.test(pickedLabel),
	'FE-45 gõ "but chi" không dấu vẫn tìm ra Bút chì gỗ',
	pickedLabel.replace(/\s+/g, ' ').slice(0, 80),
);
console.log('ảnh:', await shot(a1, 'fe-45-search-no-tone'));

// ─── FE-37: ô số bỏ ký tự lạ thì phải nói ra ──────────────────────────────────
const qtyBox = addBox.locator('input[role="spinbutton"]').first();
await qtyBox.click();
await qtyBox.type('2,5');
await a1.waitForTimeout(600);
const typed = await qtyBox.inputValue();
const addText = () => addBox.innerText().then(t => t.replace(/\s+/g, ' '));
line(
	(await addText()).includes('Số lượng là số nguyên'),
	'FE-37 gõ "2,5" thì ô nói ngay là số nguyên, không im lặng thành 25',
	`ô ghi "${typed}"`,
);
await addBox.getByRole('button', { name: 'Thêm dòng' }).first().click();
await a1.waitForTimeout(1200);
line(
	// UAT đợt C: câu nhắc gọn lại thành "Số lượng là số nguyên, ví dụ 2" ở cả ô và ở câu chặn,
	// vì câu "đang có chữ không phải chữ số" bị chê khó hiểu.
	(await addText()).includes('Số lượng là số nguyên, ví dụ 2'),
	'FE-37 bấm Thêm dòng khi ô đang sai thì bị chặn kèm câu chỉ việc cần làm',
	(await addText()).slice(0, 160),
);
line(
	(await qtyBox.inputValue()) === '2,5',
	'FE-37 ô GIỮ NGUYÊN chữ người dùng gõ, không âm thầm đổi "2,5" thành 25',
	`ô đang là "${await qtyBox.inputValue()}"`,
);
console.log('ảnh:', await shot(a1, 'fe-37-qty-comma'));

// Xoá trắng rồi gõ lại số đúng thì câu nhắc tắt và thêm được dòng.
await qtyBox.fill('');
await a1.waitForTimeout(500);
await qtyBox.type('3');
await a1.waitForTimeout(400);
line(
	!(await addText()).includes('Số lượng là số nguyên'),
	'FE-37 gõ lại số đúng thì câu nhắc tắt',
	(await addText()).slice(0, 120),
);
await clearToasts(a1);
await addBox.getByRole('button', { name: 'Thêm dòng' }).first().click();
const addToast = await toastText(a1, 15000);
line(/Đã thêm dòng/.test(addToast), 'FE-37 thêm được dòng sau khi sửa số', addToast);

// Nút không còn xám: bấm khi chưa chọn mặt hàng thì nói thiếu gì.
await clearToasts(a1);
await addBox.getByRole('button', { name: 'Thêm dòng' }).first().click();
await a1.waitForTimeout(1000);
line(
	(await addText()).includes('Bạn chọn mặt hàng trong danh mục trước'),
	'FE-37 bấm Thêm dòng khi chưa chọn mặt hàng thì được nói thiếu gì',
	(await addText()).slice(0, 160),
);

// Mặt hàng đã có trong phiếu: vẫn tìm thấy, và được chỉ xuống dòng đang có.
await pickSearchable(addBox, a1, 0, 'but chi', 'Bút chì');
await a1.waitForTimeout(800);
line(
	(await addText()).includes('đã có trong phiếu, bạn sửa số ở dòng bên dưới'),
	'FE-45 chọn mặt hàng đã có trong phiếu thì được chỉ đường, không còn "Không tìm thấy kết quả"',
	(await addText()).match(/[^.]*đã có trong phiếu[^.]*\./)?.[0] ?? '',
);
console.log('ảnh:', await shot(a1, 'fe-45-already-in-request'));

// Gõ tay một mặt hàng đã có trong danh mục, viết không dấu: máy chủ chặn và nêu tên đúng.
await a1.getByRole('button', { name: /Mặt hàng không có trong danh mục/ }).first().click();
await a1.waitForTimeout(600);
const customBox = a1.locator('section', { hasText: 'Thêm mặt hàng' }).first();
await customBox.locator('input[placeholder*="Pin 3A"]').first().fill('but chi go');
await customBox.locator('input[placeholder*="Đôi"]').first().fill('Chiếc');
await customBox.locator('input[role="spinbutton"]').last().fill('2');
await clearToasts(a1);
await customBox.getByRole('button', { name: 'Thêm', exact: true }).click();
await a1.waitForTimeout(2500);
const customText = (await customBox.innerText()).replace(/\s+/g, ' ');
line(
	/danh mục/i.test(customText) && /Bút chì/i.test(customText),
	'FE-45 gõ tay "but chi go" thì máy chủ chặn và nêu tên đúng trong danh mục',
	customText.match(/"[^"]*"[^.]*\./)?.[0]?.slice(0, 160) ?? customText.slice(0, 160),
);
console.log('ảnh:', await shot(a1, 'fe-45-custom-in-catalog'));

// ─── FE-38: số chưa lưu không được mất khi chuyển thẻ tháng ───────────────────
// Thêm một dòng nữa rồi sửa số của nó mà KHÔNG bấm Lưu.
await pickSearchable(a1.locator('section', { hasText: 'Thêm mặt hàng' }).first(), a1, 0, plain.name.slice(0, 8), plain.name.slice(0, 8));
await a1.locator('section', { hasText: 'Thêm mặt hàng' }).first().locator('input[role="spinbutton"]').first().fill('4');
await clearToasts(a1);
await a1.locator('section', { hasText: 'Thêm mặt hàng' }).first().getByRole('button', { name: 'Thêm dòng' }).click();
await toastText(a1, 15000);
await a1.waitForTimeout(1500);

const pencilRow = a1.locator('div.p-4', { hasText: 'Bút chì' }).first();
await pencilRow.locator('input[role="spinbutton"]').first().fill('12');
await a1.waitForTimeout(400);

// Chuyển sang thẻ phiếu khác (kỳ của bài khác) rồi quay lại.
const otherTab = a1.locator('button', { hasText: 'dòng' }).filter({ hasNotText: period.title }).first();
if (await otherTab.count()) {
	await clearToasts(a1);
	await otherTab.click();
	await a1.waitForTimeout(3000);
	await a1
		.locator('button', { hasText: period.title })
		.filter({ hasText: period.officeSite.name })
		.first()
		.click();
	await a1.waitForTimeout(3000);
	const kept = await a1
		.locator('div.p-4', { hasText: 'Bút chì' })
		.first()
		.locator('input[role="spinbutton"]')
		.first()
		.inputValue();
	line(kept === '12', 'FE-38 số đã gõ được lưu khi rời ô, chuyển thẻ tháng không làm mất', `ô ghi ${kept}`);
	const saved = (await api(a1Token, `/v1/me/office/supply-requests/${request.id}`)).json?.data;
	const savedQty = (saved?.lines ?? []).find(l => /Bút chì/.test(l.name))?.requestedQty;
	line(savedQty === 12, 'FE-38 máy chủ đã nhận số 12, không chỉ hiện trên màn', `máy chủ ghi ${savedQty}`);
} else {
	line(true, 'FE-38 chỉ có một phiếu nên không có thẻ khác để chuyển; kiểm bằng rời trang', '');
	await go(a1, '/office/rooms', 2500);
	await go(a1, '/office/supplies', 3500);
	const saved = (await api(a1Token, `/v1/me/office/supply-requests/${request.id}`)).json?.data;
	const savedQty = (saved?.lines ?? []).find(l => /Bút chì/.test(l.name))?.requestedQty;
	line(savedQty === 12, 'FE-38 rời trang cũng lưu số đã gõ', `máy chủ ghi ${savedQty}`);
}
console.log('ảnh:', await shot(a1, 'fe-38-qty-kept'));

// ─── FE-39: xoá dòng phải hỏi lại ─────────────────────────────────────────────
await go(a1, `/office/supplies?request_id=${request.id}`, 4000);
const rowToDelete = a1.locator('div.p-4', { hasText: plain.name }).first();
await rowToDelete.getByRole('button', { name: 'Xoá', exact: true }).click();
await a1.waitForTimeout(1200);
const confirmBox = dialog(a1, 'Xoá dòng khỏi phiếu');
line((await confirmBox.count()) > 0, 'FE-39 bấm Xoá thì hỏi lại trước, không xoá ngay');
const confirmText = (await confirmBox.innerText()).replace(/\s+/g, ' ');
line(
	confirmText.includes(plain.name) && /số đang xin/.test(confirmText) && /nhập lần cuối/.test(confirmText),
	'FE-39 hộp hỏi lại nêu tên mặt hàng, số đang xin và người nhập cuối',
	confirmText.slice(0, 200),
);
console.log('ảnh:', await shot(a1, 'fe-39-delete-confirm'));
await confirmBox.getByRole('button', { name: 'Thôi' }).click();
await a1.waitForTimeout(800);
const stillThere = (await api(a1Token, `/v1/me/office/supply-requests/${request.id}`)).json?.data;
line(
	(stillThere?.lines ?? []).some(l => l.name === plain.name),
	'FE-39 bấm Thôi thì dòng vẫn còn',
);
await rowToDelete.getByRole('button', { name: 'Xoá', exact: true }).click();
await a1.waitForTimeout(1000);
await clearToasts(a1);
await dialog(a1, 'Xoá dòng khỏi phiếu').getByRole('button', { name: 'Xoá dòng' }).click();
const deleteToast = await toastText(a1, 15000);
line(/Đã xoá dòng/.test(deleteToast), 'FE-39 xác nhận thì xoá được dòng', deleteToast);

// ─── FE-44: HCNS khoá sớm có hỏi lại; phiếu của phòng nói rõ đã khoá ──────────
const hr = await signIn(browser, WHO.hr.email);
await go(hr, `/management/office/supply-periods/${period.id}`, 4000);
await hr.getByRole('button', { name: 'Khoá sớm' }).first().click();
await hr.waitForTimeout(1000);
const lockBoxText = (await text(hr)).replace(/\s+/g, ' ');
line(
	/Khoá kỳ .* ngay bây giờ thì các phòng không nhập hay sửa được nữa/.test(lockBoxText),
	'FE-44 "Khoá sớm" hỏi lại kèm hậu quả thay vì khoá ngay',
	lockBoxText.match(/Khoá kỳ[^.]*\./)?.[0]?.slice(0, 200) ?? '',
);
line(
	/hạn chót còn \d+ ngày/.test(lockBoxText),
	'FE-44 hộp hỏi lại nói còn mấy ngày tới hạn',
	lockBoxText.match(/hạn chót còn \d+ ngày/)?.[0] ?? '',
);
console.log('ảnh:', await shot(hr, 'fe-44-lock-confirm'));
await clearToasts(hr);
await hr.getByRole('button', { name: 'Khoá kỳ ngay' }).first().click();
const lockToast = await toastText(hr, 15000);
line(/Đã khoá kỳ/.test(lockToast), 'FE-44 xác nhận thì khoá được kỳ', lockToast);

await go(a1, `/office/supplies?request_id=${request.id}`, 4500);
const lockedText = (await text(a1)).replace(/\s+/g, ' ');
line(
	/HCNS đã khoá kỳ này lúc .*, phiếu không sửa được nữa/.test(lockedText),
	'FE-44 phiếu của phòng nói rõ kỳ bị khoá lúc nào và làm gì tiếp',
	lockedText.match(/HCNS đã khoá kỳ này[^.]*\./)?.[0] ?? lockedText.slice(0, 200),
);
line(
	(await a1.locator('input[role="spinbutton"]').count()) === 0,
	'FE-44 phiếu đã khoá thì không còn ô nhập nào',
);
console.log('ảnh:', await shot(a1, 'fe-44-locked-notice'));

// ─── FE-46: nhận hàng trên điện thoại ─────────────────────────────────────────
// Chốt và cấp qua API để tới được bước nhận hàng.
const detail = (await api(hrToken, `/v1/office/supply-requests/${request.id}`)).json?.data;
const finalize = await api(hrToken, `/v1/office/supply-requests/${request.id}/finalize`, {
	method: 'POST',
	body: JSON.stringify({
		lines: (detail?.lines ?? []).map(l => ({ lineId: l.id, finalQty: l.requestedQty })),
	}),
});
line(finalize.status < 400, 'FE-46 chốt phiếu qua API để tới bước nhận hàng', `status ${finalize.status}`);
const issue = await api(hrToken, `/v1/office/supply-requests/${request.id}/issue`, { method: 'POST' });
line(issue.status < 400, 'FE-46 cấp hàng qua API', `status ${issue.status}`);

const phone = await signIn(browser, WHO.managerA.email, { phone: true });
await go(phone, `/office/supplies?request_id=${request.id}`, 4500);
await phone.getByRole('button', { name: 'Đã nhận', exact: true }).first().click();
await phone.waitForTimeout(1500);
const receiveBox = dialog(phone, 'Xác nhận đã nhận hàng');
line((await receiveBox.count()) > 0, 'FE-46 mở được hộp xác nhận đã nhận trên điện thoại');
const receiveText = (await receiveBox.innerText()).replace(/\s+/g, ' ');
line(
	/Thực nhận/.test(receiveText) && /Ghi chú/.test(receiveText) && /HCNS đã chốt/.test(receiveText),
	'FE-46 mỗi mặt hàng là một khối dọc: tên, đã chốt, ô thực nhận, ô ghi chú',
	receiveText.slice(0, 200),
);
const qtyInputs = await receiveBox.locator('input[role="spinbutton"]').all();
const boxes = [];
for (const input of qtyInputs.slice(0, 3)) {
	const box = await input.boundingBox();
	if (box) boxes.push(Math.round(box.width));
}
line(
	boxes.every(w => w > 150),
	'FE-46 ô thực nhận rộng rãi trên điện thoại, không co lại thành ô trống',
	`bề rộng ô: ${boxes.join(', ')}px`,
);
line(
	(await phone.evaluate(() => document.documentElement.scrollWidth)) <= 391,
	'FE-46 hộp nhận hàng không tràn ngang trên điện thoại',
);
console.log('ảnh:', await shot(phone, 'fe-46-receive-phone'));

// Nhận thiếu một dòng rồi lưu.
const firstQty = receiveBox.locator('input[role="spinbutton"]').first();
const finalNumber = Number((await firstQty.inputValue()).replace(/\D/g, '')) || 1;
await firstQty.fill(String(Math.max(finalNumber - 1, 0)));
await receiveBox.locator('input[placeholder*="thiếu"]').first().fill('Kho giao thiếu 1, hẹn tuần sau');
await clearToasts(phone);
await receiveBox.getByRole('button', { name: 'Xác nhận đã nhận', exact: true }).click();
const receiveToast = await toastText(phone, 20000);
line(/Đã ghi nhận hàng/.test(receiveToast), 'FE-46 ghi được đã nhận kèm dòng nhận thiếu', receiveToast);
console.log('ảnh:', await shot(phone, 'fe-46-received'));

// ─── FE-49: chuông HCNS sau khi phòng nhận thiếu ──────────────────────────────
// Phòng A là phòng duy nhất của kỳ này, nên lần nhận vừa rồi vừa là "nhận thiếu" vừa là phiếu
// cuối cùng của kỳ: HCNS phải nhận hai thông báo, và bấm vào thì mở trang kỳ.
await hr.waitForTimeout(2500);
const hrNotifs = (await api(hrToken, '/v1/notifications?page=1&limit=20')).json?.data ?? [];
const receivedNotifs = hrNotifs.filter(n => n.type === 'OFFICE_SUPPLY_RECEIVED');
line(
	receivedNotifs.length >= 2,
	'FE-49 chuông HCNS có hai thông báo nhận hàng (nhận thiếu và kỳ đã nhận xong)',
	receivedNotifs.map(n => `${n.title ?? ''} ${n.body ?? ''}`.trim().slice(0, 70)).join(' || ') ||
		`chỉ có ${receivedNotifs.length}`,
);
line(
	receivedNotifs.every(n => n.refType === 'office_supply_period'),
	'FE-49 thông báo nhận hàng trỏ tới kỳ, không trỏ tới phiếu',
	receivedNotifs.map(n => `${n.refType}:${n.refId}`).join(', '),
);

await go(hr, '/management', 3500);
await hr.locator('button[title="Thông báo"]').first().click();
await hr.waitForTimeout(2500);
const hrPanel = (await text(hr)).replace(/\s+/g, ' ');
line(/nhận/i.test(hrPanel) && /văn phòng phẩm|kỳ/i.test(hrPanel), 'FE-49 thông báo nhận hàng hiện trong chuông HCNS');
console.log('ảnh:', await shot(hr, 'fe-49-hr-bell'));
const receivedItem = hr.locator('p,div', { hasText: /nhận thiếu|đã nhận/i }).last();
if (await receivedItem.count()) {
	await receivedItem.click();
	await hr.waitForTimeout(3500);
	line(
		/\/management\/office\/supply-periods\/\d+/.test(hr.url()),
		'FE-49 bấm thông báo mở đúng trang kỳ của HCNS',
		hr.url(),
	);
	console.log('ảnh:', await shot(hr, 'fe-49-hr-period-opened'));
} else {
	line(false, 'FE-49 không tìm thấy thông báo nhận hàng trong chuông để bấm', hrPanel.slice(0, 200));
}

for (const [name, page] of [
	['EMPA1', a1],
	['HCNS', hr],
	['trưởng phòng (điện thoại)', phone],
]) {
	line(page.errors.length === 0, `FE-37..FE-46 không có lỗi JavaScript (${name})`, page.errors.slice(0, 2).join(' | '));
	console.log(`response 4xx của ${name}:`, [...new Set(page.apiErrors)].join(' | ') || 'không có');
}

console.log(`kỳ của bài: ${period.id} (${period.title}), phiếu ${request.id}`);
await browser.close();
process.exit(summary() ? 1 : 0);
