/**
 * FE-08 và FE-09 — bình luận nhắc tên, mời cho ý kiến, và tệp đính kèm.
 */
import { writeFileSync } from 'node:fs';
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
const kt1Token = await apiToken(WHO.kt1.email);
const stamp = Date.now() % 100000;
const SCRATCH = '/tmp/claude-1000/-home-tuanpham-work-hr-system-nhan-su/401b686a-cf9c-48d0-8c68-e92542ad9d5b/scratchpad';

const forComment = await seedRequest(kdToken, {
	title: `FE-08 bình luận ${stamp}`,
	pickedApprovers: [{ stepOrder: 1, employeeIds: [WHO.mkd.id] }],
});
line(!!forComment.code, 'dựng được phiếu để bình luận', forComment.code);

// ════════════════════════ FE-08: bình luận nhắc tên ════════════════════════
const kd = await signIn(browser, WHO.kd1.email);
await go(kd, `/general-requests/${forComment.id}`, 4500);
const commentCard = kd.locator('section').filter({ hasText: 'Bình luận' }).last();
line((await text(kd)).includes('Chưa có bình luận nào'), 'FE-08a phiếu mới chưa có bình luận');

const editor = commentCard.locator('div[contenteditable="true"]');
await editor.click();
await editor.type('Nhờ anh xem giúp phiếu này ');
await editor.type('@Lê');
await kd.waitForTimeout(1200);
const suggestion = commentCard.getByRole('button', { name: new RegExp(WHO.mkd.name) }).first();
line(await suggestion.count() > 0, 'FE-08a gõ @ thì hiện danh sách người nhắc được');
await suggestion.click();
await kd.waitForTimeout(600);
await editor.type(' nhé.');
await shot(kd, 'FE-08a-soan-binh-luan-nhac-ten');

await clearToasts(kd);
await commentCard.getByRole('button', { name: 'Gửi bình luận' }).click();
let toast = await toastText(kd, 20000);
line(/Đã gửi bình luận/.test(toast), 'FE-08a gửi được bình luận', toast);
await kd.waitForTimeout(1500);
let cardText = clean(await commentCard.innerText());
line(cardText.includes('Nhờ anh xem giúp phiếu này'), 'FE-08a bình luận hiện trong danh sách', cardText.slice(0, 240));
line(cardText.includes(`Đã nhắc ${WHO.mkd.name}`), 'FE-08a bình luận ghi rõ đã nhắc ai', cardText.slice(0, 300));
await shot(kd, 'FE-08a-binh-luan-da-gui');

const comments = await api(kdToken, `/v1/general-requests/${forComment.id}/comments`);
line(
	(comments.json?.data ?? []).some(c => (c.mentionIds ?? []).includes(WHO.mkd.id)),
	'FE-08a máy chủ nhận đúng id người được nhắc',
	JSON.stringify(comments.json?.data?.[0]?.mentionIds),
);

// ════════════════════════ FE-08: mời cho ý kiến ════════════════════════
const mkd = await signIn(browser, WHO.mkd.email);
await go(mkd, `/general-requests/${forComment.id}`, 4500);
const watcherCard = mkd.locator('section').filter({ hasText: 'Người theo dõi' }).last();
await watcherCard.getByRole('button', { name: 'Mời cho ý kiến' }).click();
await mkd.waitForTimeout(1200);
const consultBox = mkd.locator('div.fixed.inset-0').filter({ hasText: 'Mời cho ý kiến' }).last();
line(
	clean(await consultBox.innerText()).includes('bình luận được, nhưng không có nút duyệt'),
	'FE-08b hộp thoại nói rõ người được mời không duyệt',
);
const consultPicker = pickerBox(consultBox, 'Chọn người');
line(await pickPerson(consultPicker, mkd, WHO.kt1.name), 'FE-08b chọn được người để mời');
await clearToasts(mkd);
await consultBox.getByRole('button', { name: 'Gửi lời mời' }).click();
toast = await toastText(mkd, 20000);
line(/Đã mời cho ý kiến/.test(toast), 'FE-08b mời cho ý kiến thành công', toast);
await mkd.waitForTimeout(2000);
line(clean(await watcherCard.innerText()).includes(WHO.kt1.name), 'FE-08b người được mời hiện trong danh sách theo dõi');
await shot(mkd, 'FE-08b-moi-cho-y-kien');

// ════════════════════════ FE-08: người được mời chỉ bình luận ════════════════════════
const kt1 = await signIn(browser, WHO.kt1.email);
await go(kt1, `/general-requests/${forComment.id}`, 4500);
let kt1Text = await text(kt1);
line(kt1Text.includes(forComment.code), 'FE-08c người được mời mở được phiếu', forComment.code);
line(!/\bĐồng ý\b/.test(kt1Text), 'FE-08c người được mời KHÔNG có nút Đồng ý', kt1Text.slice(0, 300));
line(!kt1Text.includes('Từ chối'), 'FE-08c người được mời KHÔNG có nút Từ chối');
line(kt1Text.includes('Gửi bình luận'), 'FE-08c người được mời bình luận được');

const kt1Card = kt1.locator('section').filter({ hasText: 'Bình luận' }).last();
const kt1Editor = kt1Card.locator('div[contenteditable="true"]');
await kt1Editor.click();
await kt1Editor.type('Ý kiến kế toán: chi phí này nằm trong ngân sách quý.');
await clearToasts(kt1);
await kt1Card.getByRole('button', { name: 'Gửi bình luận' }).click();
toast = await toastText(kt1, 20000);
line(/Đã gửi bình luận/.test(toast), 'FE-08c người được mời gửi được bình luận', toast);
await kt1.waitForTimeout(1500);
line(
	clean(await kt1Card.innerText()).includes('Ý kiến kế toán'),
	'FE-08c bình luận của người được mời hiện ra',
);
const kt1Detail = await api(kt1Token, `/v1/general-requests/${forComment.id}`);
line(kt1Detail.json?.data?.canApprove === false, 'FE-08c cờ canApprove của người được mời là false');
line(kt1Detail.json?.data?.canComment === true, 'FE-08c cờ canComment của người được mời là true');
await shot(kt1, 'FE-08c-nguoi-duoc-moi-binh-luan');

// ════════════════════════ FE-09: tệp đính kèm ════════════════════════
writeFileSync(`${SCRATCH}/fe09-bao-gia.pdf`, '%PDF-1.4\n% bao gia\n');
writeFileSync(`${SCRATCH}/fe09-anh.png`, Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'));
writeFileSync(`${SCRATCH}/fe09-sai-loai.txt`, 'tep nay khong duoc phep');
for (let i = 1; i <= 11; i++) writeFileSync(`${SCRATCH}/fe09-them-${i}.pdf`, `%PDF-1.4\n% tep ${i}\n`);

const draft = await seedRequest(kdToken, { title: `FE-09 đính kèm ${stamp}` });
await go(kd, `/general-requests/create?id=${draft.id}`, 5000);
const fileCard = kd.locator('section').filter({ hasText: 'Tệp đính kèm' }).last();
line(await fileCard.isVisible(), 'FE-09a màn sửa phiếu nháp có khối tệp đính kèm');

await fileCard.locator('input[type="file"]').setInputFiles([`${SCRATCH}/fe09-bao-gia.pdf`, `${SCRATCH}/fe09-anh.png`]);
await kd.waitForTimeout(6000);
let fileText = clean(await fileCard.innerText());
line(fileText.includes('fe09-bao-gia.pdf') && fileText.includes('fe09-anh.png'), 'FE-09a tải lên được PDF và ảnh', fileText.slice(0, 250));
line(/2 \/ 10 tệp/.test(fileText), 'FE-09a khối đếm đúng số tệp', fileText.slice(0, 120));
await shot(kd, 'FE-09a-dinh-kem-pdf-va-anh');

await clearToasts(kd);
await fileCard.locator('input[type="file"]').setInputFiles([`${SCRATCH}/fe09-sai-loai.txt`]);
await kd.waitForTimeout(2500);
fileText = clean(await fileCard.innerText());
const wrongToast = await toastText(kd, 6000);
line(
	/không|chỉ nhận|định dạng/i.test(fileText + wrongToast),
	'FE-09b tệp sai loại bị báo lỗi',
	`${fileText.slice(-200)} | ${wrongToast}`,
);
// Tên tệp bị từ chối nằm trong CÂU LỖI, nên chỉ kiểm danh sách tệp đã lên và số tệp ở máy chủ.
line(
	(await fileCard.locator('li').filter({ hasText: 'fe09-sai-loai.txt' }).count()) === 0,
	'FE-09b tệp sai loại không vào danh sách tệp đã lên',
);
const afterWrong = await api(kdToken, `/v1/general-requests/${draft.id}`);
line(
	(afterWrong.json?.data?.attachments ?? []).length === 2,
	'FE-09b máy chủ vẫn chỉ có hai tệp hợp lệ',
	String((afterWrong.json?.data?.attachments ?? []).length),
);
await shot(kd, 'FE-09b-tep-sai-loai');

// Nạp cho đủ mười tệp rồi thử tệp thứ mười một.
for (let i = 1; i <= 8; i++) {
	await api(kdToken, `/v1/general-requests/${draft.id}`);
}
const filler = Array.from({ length: 8 }, (_, i) => `${SCRATCH}/fe09-them-${i + 1}.pdf`);
await fileCard.locator('input[type="file"]').setInputFiles(filler);
await kd.waitForTimeout(12000);
fileText = clean(await fileCard.innerText());
line(/10 \/ 10 tệp/.test(fileText), 'FE-09c nạp được đủ mười tệp', fileText.slice(0, 120));
line(
	/Phiếu đã có đủ mười tệp/.test(fileText),
	'FE-09c đủ mười tệp thì ô tải lên nói rõ phải gỡ bớt',
	fileText.slice(-250),
);
const dropzoneInput = fileCard.locator('input[type="file"]');
line(await dropzoneInput.isDisabled(), 'FE-09c ô chọn tệp bị khoá khi đã đủ mười tệp');
await shot(kd, 'FE-09c-du-muoi-tep');

// Mở một tệp: trang gọi link ký rồi mở cửa sổ mới.
await clearToasts(kd);
const popupPromise = kd.context().waitForEvent('page', { timeout: 20000 }).catch(() => null);
await fileCard.getByRole('button', { name: 'Mở tệp' }).first().click();
const popup = await popupPromise;
if (popup) {
	await popup.waitForURL(/X-Amz-Signature|token=|\.pdf/, { timeout: 20000 }).catch(() => {});
	line(/X-Amz-Signature|token=|\.pdf/.test(popup.url()), 'FE-09d mở tệp bằng link ký', popup.url().slice(0, 120));
	await popup.close();
} else {
	line(false, 'FE-09d mở tệp bằng link ký', 'không thấy cửa sổ mới');
}

// Gỡ một tệp rồi kiểm số đếm.
await clearToasts(kd);
await fileCard.getByRole('button', { name: 'Gỡ' }).first().click();
toast = await toastText(kd, 20000);
line(/Đã gỡ tệp/.test(toast), 'FE-09e gỡ được tệp', toast);
await kd.waitForTimeout(2500);
fileText = clean(await fileCard.innerText());
line(/9 \/ 10 tệp/.test(fileText), 'FE-09e số đếm giảm sau khi gỡ', fileText.slice(0, 120));
await shot(kd, 'FE-09e-sau-khi-go-tep');

console.log('\nlỗi console KD01:', kd.errors.filter(e => !e.includes('Failed to load resource') && !e.includes('sandboxed')).slice(0, 5));
console.log('lỗi console KT01:', kt1.errors.filter(e => !e.includes('Failed to load resource') && !e.includes('sandboxed')).slice(0, 5));
console.log(`\nphiếu: bình luận=${forComment.code}(#${forComment.id}) nháp đính kèm=#${draft.id}`);
process.exitCode = summary() ? 1 : 0;
await browser.close();
