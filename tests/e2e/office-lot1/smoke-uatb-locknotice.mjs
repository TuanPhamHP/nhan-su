/**
 * Băng "HCNS đã khoá kỳ này lúc …" chỉ hiện khi phiếu còn CHỜ HCNS CHỐT.
 *
 * Thấy trong ảnh `fe-46-receive-phone.png` của đợt B: phiếu đã cấp, đang mở hộp nhận hàng, mà
 * đầu trang vẫn nhắc chuyện khoá kỳ. Lúc đó việc của phòng là nhận hàng và đối chiếu số, nên câu
 * kia chỉ làm người đọc tưởng mình vừa mất lượt đăng ký.
 */
import { WHO, api, apiToken, go, launch, line, shot, signIn, summary, text, ymd } from './helper.mjs';

const a1Token = await apiToken(WHO.employeeA1.email);
const hrToken = await apiToken(WHO.hr.email);

/**
 * Bài tự dựng phiếu CHỜ CHỐT của riêng mình.
 *
 * Dựa vào phiếu còn sót của bài khác thì có lúc sandbox không còn phiếu nào ở trạng thái đó, và
 * bài đỏ vì thiếu dữ liệu chứ không vì lỗi sản phẩm.
 */
async function makeLockedRequest() {
	const sites = ((await api(hrToken, '/v1/office/sites')).json?.data ?? []).filter(s => s.isActive);
	const periods = (await api(hrToken, '/v1/office/supply-periods')).json?.data ?? [];
	const items = (await api(a1Token, '/v1/me/office/supply-items')).json?.data ?? [];
	if (!sites.length || !items.length) throw new Error('chưa có văn phòng hoặc danh mục — chạy smoke-settings.mjs trước');

	for (const site of sites) {
		const taken = new Set(periods.filter(p => p.officeSite.id === site.id).map(p => p.month));
		for (let offset = 0; offset <= 12; offset++) {
			const at = new Date();
			const next = new Date(at.getFullYear(), at.getMonth() + offset, 1);
			const month = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
			if (taken.has(month)) continue;

			const created = await api(hrToken, '/v1/office/supply-periods', {
				method: 'POST',
				body: JSON.stringify({
					officeSiteId: site.id,
					month,
					deadline: ymd(new Date(Date.now() + 4 * 86400000)),
					departmentIds: [WHO.employeeA1.departmentId],
				}),
			});
			if (created.status >= 400) continue;
			const period = created.json.data;
			const list = (await api(a1Token, '/v1/me/office/supply-requests')).json?.data ?? [];
			const request = list.find(r => r.period.id === period.id);
			if (!request) continue;
			await api(a1Token, `/v1/me/office/supply-requests/${request.id}/lines`, {
				method: 'POST',
				body: JSON.stringify({ itemId: items[0].id, requestedQty: 2 }),
			});
			await api(hrToken, `/v1/office/supply-periods/${period.id}/lock`, { method: 'POST' });
			console.log(`dựng phiếu chờ chốt: ${request.id} ở kỳ ${period.title} (${site.name})`);
			return request.id;
		}
	}
	return null;
}

const requests = (await api(a1Token, '/v1/me/office/supply-requests')).json?.data ?? [];

let locked = requests.find(r => r.status === 'LOCKED' && r.lineCount > 0 && r.period?.status === 'LOCKED');
if (!locked) {
	const id = await makeLockedRequest();
	if (id) {
		const fresh = (await api(a1Token, '/v1/me/office/supply-requests')).json?.data ?? [];
		locked = fresh.find(r => r.id === id);
	}
}
const moved = requests.find(r => ['FINALIZED', 'ISSUED', 'RECEIVED'].includes(r.status) && r.period?.status === 'LOCKED');
console.log(
	`phiếu chờ chốt: ${locked?.id ?? 'không có'} (${locked?.statusLabel ?? ''}); phiếu đã qua bước chốt: ${moved?.id ?? 'không có'} (${moved?.statusLabel ?? ''})`,
);

const browser = await launch();
const a1 = await signIn(browser, WHO.employeeA1.email);
const BANNER = /HCNS đã khoá kỳ này lúc/;

if (locked) {
	await go(a1, `/office/supplies?request_id=${locked.id}`, 4500);
	const lockedText = (await text(a1)).replace(/\s+/g, ' ');
	line(
		BANNER.test(lockedText),
		'Phiếu đang chờ HCNS chốt thì VẪN có băng khoá kỳ',
		lockedText.match(/HCNS đã khoá kỳ này[^.]*\./)?.[0] ?? lockedText.slice(0, 160),
	);
	console.log('ảnh:', await shot(a1, 'locknotice-locked-request'));
} else {
	line(false, 'Phiếu đang chờ HCNS chốt thì VẪN có băng khoá kỳ', 'sandbox không còn phiếu nào ở trạng thái chờ chốt');
}

if (moved) {
	await go(a1, `/office/supplies?request_id=${moved.id}`, 4500);
	const movedText = (await text(a1)).replace(/\s+/g, ' ');
	line(
		!BANNER.test(movedText),
		`Phiếu "${moved.statusLabel}" KHÔNG còn băng khoá kỳ`,
		movedText.match(/HCNS đã khoá kỳ này[^.]*\./)?.[0] ?? 'không thấy băng, đúng như mong đợi',
	);
	line(
		movedText.includes(moved.statusLabel),
		'Trạng thái thật của phiếu vẫn hiện ở viên trạng thái',
		moved.statusLabel,
	);
	console.log('ảnh:', await shot(a1, 'locknotice-issued-request'));
} else {
	line(false, 'Phiếu đã qua bước chốt thì không còn băng khoá kỳ', 'sandbox không có phiếu nào đã chốt, cấp hay nhận');
}

line(a1.errors.length === 0, 'Không có lỗi JavaScript', a1.errors.slice(0, 2).join(' | '));

await browser.close();
process.exit(summary() ? 1 : 0);
