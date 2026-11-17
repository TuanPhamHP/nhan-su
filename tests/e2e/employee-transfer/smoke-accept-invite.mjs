/**
 * F4 — người được giữ song song nhận lời mời của công ty thứ hai.
 *
 *   SMOKE_PASSWORD='<mật khẩu sandbox>' SMOKE_INVITE_TOKEN='<token trong email>' \
 *     node tests/e2e/employee-transfer/smoke-accept-invite.mjs
 *
 * Tách khỏi `smoke-transfer.mjs` vì link lời mời DÙNG MỘT LẦN: bài kia chạy lại bao nhiêu lần
 * cũng được, còn bài này chỉ đúng ở lần chạy đầu, lần sau máy chủ trả "link đã được sử dụng".
 */
import { WHO, apiLogin, clean, go, launch, line, note, shot, shotStrip, signIn, summary } from './helper.mjs';

const TOKEN = process.env.SMOKE_INVITE_TOKEN;
if (!TOKEN) {
	console.error('Thiếu SMOKE_INVITE_TOKEN — lấy token trong link lời mời rồi chạy lại.');
	process.exit(2);
}

const before = await apiLogin(WHO.hrAlpha.email);
const beforeCodes = (before.requiresCompanySelection ? before.companies : [before.company]).map(c => c.code);
line(beforeCodes.length === 1, 'F4 trước khi nhận: tài khoản chỉ thuộc một công ty', beforeCodes.join(', '));
note(`công ty trước khi nhận: ${beforeCodes.join(', ')}`);

const browser = await launch();
const page = await signIn(browser, WHO.hrAlpha.email);

const headerBefore = clean(
	await page.locator('[data-testid="company-switcher"], [data-testid="company-name"]').first().innerText(),
);
line(headerBefore.includes('alpha'), 'F4 đang đăng nhập ở công ty cũ', headerBefore);
line(
	(await page.locator('[data-testid="company-switcher"]').count()) === 0,
	'F4 chưa có bộ chọn công ty, vì mới thuộc một công ty',
);
note(`ảnh trước khi nhận: ${await shot(page, 'F4-truoc-khi-nhan', { selector: 'header' })}`);

// ─── Mở link lời mời ngay trong phiên đang đăng nhập ──────────────────────────
await go(page, `/accept-invite?token=${TOKEN}`, 5000);
const invitePage = clean(await page.locator('[data-testid="accept-invite"]').first().innerText());
line(invitePage.includes('Lời mời tham gia công ty'), 'F4 mở được trang lời mời', invitePage.slice(0, 160));
note(`ảnh trang lời mời: ${await shot(page, 'F4-trang-loi-moi')}`);

/**
 * Tài khoản tạo từ dữ liệu trước G1 thì BE bắt đặt mật khẩu mới. Gặp trường hợp đó thì DỪNG, vì
 * đặt mật khẩu mới sẽ đổi mật khẩu chung của sandbox và làm hỏng mọi bài kiểm còn lại của cả hai
 * session; báo lại cho BE chứ không tự làm.
 */
if ((await page.locator('[data-testid="accept-invite-password"]').count()) > 0) {
	line(false, 'F4 nhận lời mời không phải đặt lại mật khẩu', 'BE trả AUTH_INVITE_PASSWORD_REQUIRED — dừng, không đổi mật khẩu sandbox');
	await shot(page, 'F4-doi-mat-khau-khong-mong-doi');
	await browser.close();
	process.exit(summary() === 0 ? 0 : 1);
}

await page.getByRole('button', { name: /Nhận lời mời/i }).first().click();
await page.locator('[data-testid="accept-invite-success"]').waitFor({ state: 'visible', timeout: 60000 });
const success = clean(await page.locator('[data-testid="accept-invite-success"]').first().innerText());
line(success.includes('Bạn đã tham gia'), 'F4 nhận lời mời thành công', success.slice(0, 160));
const joined = success.match(/Bạn đã tham gia ([^\n]+?)(?: Bạn| Hãy|$)/)?.[1]?.trim() ?? '';
note(`công ty vừa tham gia: ${joined}`);
note(`ảnh nhận xong: ${await shot(page, 'F4-nhan-xong')}`);

// ─── Bộ chọn công ty phải có thêm công ty mới, không cần đăng nhập lại ────────
await go(page, '/', 5000);
line(
	(await page.locator('[data-testid="company-switcher"]').count()) === 1,
	'F4 thanh trên đổi thành bộ chọn công ty ngay sau khi nhận',
);
await page.locator('[data-testid="company-switcher"]').first().click();
await page.locator('[data-testid="company-menu"]').first().waitFor({ state: 'visible', timeout: 15000 });
const menu = clean(await page.locator('[data-testid="company-menu"]').first().innerText());
line(menu.includes(joined || 'gamma'), `F4 bộ chọn có thêm ${joined}`, menu);
line(menu.includes('alpha'), 'F4 bộ chọn vẫn giữ công ty cũ, vì đây là giữ song song', menu);
line(menu.includes('Đang làm việc'), 'F4 bộ chọn đánh dấu công ty đang mở', menu);
const codes = await page.locator('[data-company-menu] [data-company-code]').evaluateAll(els =>
	els.map(el => el.getAttribute('data-company-code')),
);
line(codes.length === 2, 'F4 bộ chọn có đúng hai công ty', codes.join(', '));
note(`ảnh bộ chọn: ${await shotStrip(page, 'F4-bo-chon-cong-ty', 420)}`);

// ─── API cũng phải thấy hai công ty ───────────────────────────────────────────
const after = await apiLogin(WHO.hrAlpha.email);
const afterCodes = (after.requiresCompanySelection ? after.companies : [after.company]).map(c => c.code);
line(afterCodes.length === 2, 'F4 API: đăng nhập lại thấy hai công ty', afterCodes.join(', '));
line(
	after.requiresCompanySelection === true,
	'F4 API: lần đăng nhập sau có bước chọn công ty',
	String(after.requiresCompanySelection),
);

line(page.errors.length === 0, 'F4 không lỗi JS', page.errors.slice(0, 3).join(' | '));
const net = [...new Set(page.netFails)];
if (net.length) note(`F4: ${net.length} request trả mã lỗi → ${net.join(' | ')}`);

await browser.close();
process.exit(summary() === 0 ? 0 : 1);
