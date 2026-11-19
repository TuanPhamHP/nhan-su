/**
 * F1–F9 — lời báo lỗi của trợ lý phải còn sau khi F5.
 *
 *   SMOKE_PASSWORD='<mật khẩu sandbox>' node tests/e2e/agent-error/smoke-agent-error.mjs
 *
 * Bài này HỎI THẬT trên sandbox nên mỗi lần chạy thêm vài hội thoại; dữ liệu sandbox là dữ liệu
 * tạm nên chấp nhận được, nhưng đừng trỏ nó vào API thật.
 */
import {
	WHO,
	apiConversations,
	apiFullName,
	apiMessages,
	apiToken,
	ask,
	bubbles,
	chatOrder,
	clean,
	go,
	indexOfConversation,
	launch,
	line,
	newConversation,
	newPage,
	note,
	openConversation,
	openTranscript,
	overflow,
	setMode,
	shot,
	signIn,
	summary,
} from './helper.mjs';

const browser = await launch();
const adminToken = await apiToken(WHO.admin);

/**
 * Hội thoại có sẵn của ADMIN: 4 lượt lỗi và 1 lượt thành công.
 *
 * Tìm bằng CHÍNH ĐẶC ĐIỂM của nó (nhiều lượt lỗi nhất) chứ không lấy hội thoại đầu danh sách:
 * mỗi lần chạy bài này lại thêm vài hội thoại mới đứng trên nó.
 */
const all = await apiConversations(adminToken);
const withErrors = [];
for (const c of all) {
	const msgs = await apiMessages(adminToken, c.id);
	withErrors.push({ c, msgs, errors: msgs.filter(m => m.error !== undefined) });
}
withErrors.sort((a, b) => b.errors.length - a.errors.length);
const { c: seeded, msgs: seededMsgs, errors: seededErrors } = withErrors[0];
line(
	seededErrors.length === 4,
	'Dữ liệu sẵn có đúng như bàn giao: 4 lượt lỗi',
	`${seededErrors.length} lượt lỗi trong ${seededMsgs.length} tin`,
);
note(`hội thoại sẵn có: id=${seeded.id} "${seeded.title}"`);

// ─── F1: đang ở fail403, ADMIN hỏi một câu ───────────────────────────────────
await setMode('fail403');
let page = await signIn(browser, WHO.admin);
await go(page, '/assistant', 5000);
await newConversation(page);
await ask(page, 'Tôi còn bao nhiêu ngày phép?');

let live = await bubbles(page);
const liveError = live.find(b => b.error);
line(!!liveError, 'F1 hỏi lúc AI từ chối thì có bong bóng đỏ', JSON.stringify(live).slice(0, 200));
line(
	(liveError?.text ?? '').includes('Khoá API của trợ lý không được phép'),
	'F1 bong bóng đỏ mang đúng câu lỗi',
	liveError?.text,
);
const F1_TEXT = liveError?.text ?? '';
note(`câu lỗi lúc đang chat: "${F1_TEXT}"`);

// ─── F2: F5 rồi mở lại hội thoại vừa rồi ─────────────────────────────────────
const convs = await apiConversations(adminToken);
const fresh = convs.find(c => c.id !== seeded.id);
line(!!fresh, 'F2 lượt vừa hỏi đã thành một hội thoại trên máy chủ', `id=${fresh?.id}`);
const freshMsgs = await apiMessages(adminToken, fresh.id);
const stored = freshMsgs.find(m => m.error !== undefined);
line(!!stored, 'F2 máy chủ đã lưu trường `error` cho lượt hỏng', JSON.stringify(freshMsgs).slice(0, 200));
line(stored?.error === F1_TEXT, 'F2 câu lỗi đã lưu đúng bằng câu người dùng vừa thấy', `${stored?.error}`);

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
await openConversation(page, await indexOfConversation(adminToken, fresh.id));

const afterReload = await chatOrder(page);
const idx = afterReload.findIndex(b => b.error);
line(idx > 0, 'F2 sau khi F5 vẫn còn bong bóng đỏ', JSON.stringify(afterReload).slice(0, 220));
line(afterReload[idx]?.text === F1_TEXT, 'F2 đúng câu lỗi như lúc đang chat', afterReload[idx]?.text);
line(afterReload[idx - 1]?.role === 'user', 'F2 bong bóng đỏ nằm ngay sau câu hỏi', JSON.stringify(afterReload[idx - 1]));
note(`ảnh F2: ${await shot(page, 'F2-sau-khi-f5')}`);

// ─── F4: bong bóng lỗi nạp lại không có nút bấm nào ──────────────────────────
const copyButtons = await page.locator('button[title*="Sao chép"]').count();
line(copyButtons === 0, 'F4 bong bóng lỗi nạp lại không có nút sao chép', `${copyButtons} nút`);
const feedbackBars = await page.locator('[data-testid="agent-feedback-bar"]').count();
line(feedbackBars === 0, 'F4 bong bóng lỗi nạp lại không có thanh chấm điểm', `${feedbackBars} thanh`);

// ─── F3: mở hội thoại có sẵn 4 lượt lỗi ──────────────────────────────────────
await openConversation(page, await indexOfConversation(adminToken, seeded.id));
const seededOnScreen = await bubbles(page);
const redOnScreen = seededOnScreen.filter(b => b.error);
line(redOnScreen.length === 4, 'F3 hội thoại có sẵn hiện đủ 4 bong bóng đỏ', `${redOnScreen.length} bong bóng đỏ`);
for (const m of seededErrors) {
	line(
		redOnScreen.some(b => b.text === m.error),
		`F3 có bong bóng đỏ đúng câu "${String(m.error).slice(0, 40)}…"`,
		redOnScreen.map(b => b.text).join(' | ').slice(0, 200),
	);
}
const ok = seededMsgs.find(m => m.role === 'assistant' && m.error === undefined);
line(
	seededOnScreen.some(b => !b.error && b.text.includes(clean(ok.text).slice(0, 20))),
	'F3 lượt thành công vẫn là bong bóng thường',
	ok.text,
);
note(`ảnh F3: ${await shot(page, 'F3-hoi-thoai-4-loi')}`);

// ─── F5: đứt giữa chừng rồi mở lại ───────────────────────────────────────────
await setMode('partial');
await newConversation(page);
await ask(page, 'Bảng công tháng 9 của tôi thế nào?');
const partialLive = (await bubbles(page)).find(b => b.error);
line(!!partialLive, 'F5 lượt đứt giữa chừng hiện bong bóng đỏ lúc đang chat', JSON.stringify(await bubbles(page)).slice(0, 200));
const F5_TEXT = partialLive?.text ?? '';
note(`câu lỗi khi đứt giữa chừng: "${F5_TEXT}"`);

const convs2 = await apiConversations(adminToken);
const partialConv = convs2.find(c => c.id !== seeded.id && c.id !== fresh.id);
const partialMsgs = await apiMessages(adminToken, partialConv.id);
const partialStored = partialMsgs.find(m => m.error !== undefined);
line(!!partialStored, 'F5 máy chủ lưu lượt đứt giữa chừng', JSON.stringify(partialMsgs).slice(0, 200));
line(
	partialStored?.text !== partialStored?.error,
	'F5 máy chủ giữ cả chữ dở lẫn câu lỗi',
	`text="${partialStored?.text}" error="${partialStored?.error}"`,
);

await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
await openConversation(page, await indexOfConversation(adminToken, partialConv.id));
const partialReloaded = (await bubbles(page)).find(b => b.error);
line(partialReloaded?.text === F5_TEXT, 'F5 mở lại hiện ĐÚNG CÂU LỖI như lúc đang chat', partialReloaded?.text);
line(
	!(partialReloaded?.text ?? '').includes(partialStored.text),
	'F5 bong bóng lỗi không hiện chữ dở',
	`chữ dở="${partialStored.text}"`,
);

// ─── F6: chuyển ok, hỏi tiếp trong hội thoại đang có lỗi ─────────────────────
await setMode('ok');
const redBefore = (await bubbles(page)).filter(b => b.error).length;
await ask(page, 'Tôi còn bao nhiêu ngày phép?');
const afterOk = await bubbles(page);
line(
	afterOk.filter(b => b.error).length === redBefore,
	'F6 hỏi lại khi AI khoẻ thì không có bong bóng đỏ mới',
	`${redBefore} → ${afterOk.filter(b => b.error).length}`,
);
line(
	afterOk.some(b => !b.error && b.text.length > 0 && !b.text.includes(F5_TEXT)),
	'F6 trợ lý trả lời bình thường',
	afterOk.map(b => b.text.slice(0, 40)).join(' | '),
);
line(page.errors.length === 0, 'F1–F6 không lỗi JS', page.errors.slice(0, 3).join(' | '));
await page.context().close();

// ─── F7: nhân viên thường ────────────────────────────────────────────────────
await setMode('fail403');
const employeeToken = await apiToken(WHO.employee);
page = await signIn(browser, WHO.employee);
await go(page, '/assistant', 5000);
await newConversation(page);
await ask(page, 'Tôi còn bao nhiêu ngày phép?');
const nvLive = (await bubbles(page)).find(b => b.error);
line(!!nvLive && nvLive.text === F1_TEXT, 'F7 nhân viên cũng thấy bong bóng đỏ đúng câu đó', nvLive?.text);

// Thêm một lượt đứt giữa chừng để màn ADMIN ở F8 có cả hai dạng lỗi.
await setMode('partial');
await ask(page, 'Bảng công tháng 9 của tôi thế nào?');
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
const nvConv = (await apiConversations(employeeToken))[0];
await openConversation(page, await indexOfConversation(employeeToken, nvConv.id));
const nvReloaded = (await bubbles(page)).filter(b => b.error);
line(nvReloaded.length === 2, 'F7 nhân viên F5 xong vẫn còn đủ hai bong bóng đỏ', `${nvReloaded.length} bong bóng`);
line(page.errors.length === 0, 'F7 không lỗi JS', page.errors.slice(0, 3).join(' | '));
await page.context().close();

// ─── F8: ADMIN xem hội thoại của nhân viên ───────────────────────────────────
const nvMsgs = await apiMessages(employeeToken, nvConv.id);
const nvPartial = nvMsgs.find(m => m.error !== undefined && m.text !== m.error);
const nvPlain = nvMsgs.find(m => m.error !== undefined && m.text === m.error);

const nvName = await apiFullName(employeeToken);
page = await signIn(browser, WHO.admin);
await go(page, '/agent-usage', 8000);
await openTranscript(page, nvName, nvConv);
note(`đang xem hội thoại của ${nvName}: id=${nvConv.id}, ${nvConv.messageCount} tin nhắn`);

const boxes = await page.locator('[data-testid="agent-transcript-error"]').allInnerTexts();
line(boxes.length >= 1, 'F8 màn ADMIN có khung lỗi đỏ', `${boxes.length} khung`);
line(boxes.some(t => clean(t) === nvPlain.error), 'F8 khung lỗi mang đúng câu lỗi đã lưu', boxes.join(' | '));

const transcriptText = clean(await page.locator('[data-testid="agent-conversation-transcript"]').innerText());
if (nvPartial) {
	line(transcriptText.includes(nvPartial.text), 'F8 lượt đứt giữa chừng vẫn hiện chữ dở', nvPartial.text);
	line(boxes.some(t => clean(t) === nvPartial.error), 'F8 và có khung lỗi riêng bên dưới', nvPartial.error);
}
const repeated = transcriptText.split(nvPlain.error).length - 1;
line(repeated === 1, 'F8 không lặp câu lỗi hai lần', `thấy ${repeated} lần`);
note(`ảnh F8: ${await shot(page, 'F8-man-admin-xem-hoi-thoai', { selector: '[data-testid="agent-conversation-transcript"]' })}`);
line(page.errors.length === 0, 'F8 không lỗi JS', page.errors.slice(0, 3).join(' | '));
await page.context().close();

// ─── F9: màn hình điện thoại ─────────────────────────────────────────────────
page = await signIn(browser, WHO.admin, { phone: true });
await go(page, '/assistant', 6000);
await openConversation(page, await indexOfConversation(adminToken, seeded.id));
let box = await overflow(page);
line(box.scroll <= box.client + 1, 'F9 khung chat trên điện thoại không tràn ngang', JSON.stringify(box));
const wrapped = await page.evaluate(() => {
	const el = [...document.querySelectorAll('[class*="rounded-tl-md"]')].find(e => e.className.includes('bg-red-50'));
	if (!el) return null;
	const r = el.getBoundingClientRect();
	return { width: Math.round(r.width), height: Math.round(r.height), viewport: window.innerWidth };
});
line(!!wrapped && wrapped.width <= wrapped.viewport, 'F9 bong bóng lỗi nằm trong bề ngang màn hình', JSON.stringify(wrapped));
line(!!wrapped && wrapped.height > 40, 'F9 chữ lỗi xuống dòng chứ không bị cắt', JSON.stringify(wrapped));
note(`ảnh F9 (chat): ${await shot(page, 'F9-dien-thoai-chat')}`);

await go(page, '/agent-usage', 8000);
await openTranscript(page, nvName, nvConv);
box = await overflow(page);
line(box.scroll <= box.client + 1, 'F9 màn ADMIN trên điện thoại không tràn ngang', JSON.stringify(box));
note(`ảnh F9 (màn ADMIN): ${await shot(page, 'F9-dien-thoai-man-admin')}`);
line(page.errors.length === 0, 'F9 không lỗi JS', page.errors.slice(0, 3).join(' | '));

const net = [...new Set(page.netFails)];
if (net.length) note(`${net.length} request trả mã lỗi → ${net.join(' | ')}`);

await setMode('fail403');
await browser.close();
process.exit(summary() === 0 ? 0 : 1);
