// Nạp thêm dữ liệu cho trang Kỳ văn phòng phẩm (P2) vào sandbox đang chạy (sandbox.cjs): thêm phòng ban cho đủ
// 9 phòng (có tên dài), hai văn phòng nữa và các kỳ ở đủ trạng thái. Chạy một lần sau khi sandbox báo READY.
//
//   - Văn phòng Đà Nẵng: kỳ 12/2026 đã khoá, chưa có kỳ 01/2027 → trang phải gợi ý mở kỳ.
//   - Văn phòng HCM (tên dài): kỳ 12/2026 đã đóng, kỳ 01/2027 quá hạn mà chưa khoá (sửa hạn chót trong DB sandbox).
//
// Trạng thái CLOSED và hạn chót trong quá khứ không tạo được qua API (máy chủ chặn), nên ghi thẳng vào DB sandbox.
//
//   node tests/e2e/supply-catalog/seed-p2.cjs
const fs = require('fs');
const drill = require('/home/tuanpham/work/hr-system/.sandbox-supply/drill-p1.cjs');

const ACCOUNTS = '/home/tuanpham/work/hr-system/.sandbox-supply/p1-accounts.json';
const DB = 'hr_t_p1';

async function api(token, method, url, body) {
	const res = await fetch(`${drill.API}${url}`, {
		method,
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	});
	const json = await res.json().catch(() => null);
	if (res.status >= 300) throw new Error(`${method} ${url}: ${res.status} ${JSON.stringify(json)}`);
	return json.data;
}

async function main() {
	if (drill.PG_PORT !== 55477) throw new Error('Không phải cổng Postgres của sandbox P1');
	const acc = JSON.parse(fs.readFileSync(ACCOUNTS, 'utf8'));
	const admin = await drill.login(acc.people.admin);

	const names = [
		'Phòng Kinh doanh',
		'Phòng Marketing và Truyền thông thương hiệu',
		'Phòng Công nghệ thông tin',
		'Phòng Chăm sóc khách hàng',
		'Phòng Pháp chế',
		'Phòng Mua hàng',
		'Ban Kiểm soát nội bộ và Quản trị rủi ro doanh nghiệp',
	];
	for (const name of names) await api(admin, 'POST', '/departments', { name });
	const departments = (await api(admin, 'GET', '/departments?pagination=false')) ?? [];
	const allIds = (Array.isArray(departments) ? departments : departments.items ?? []).map(d => d.id);

	const dn = await api(admin, 'POST', '/office/sites', { name: 'Văn phòng Đà Nẵng' });
	const hcm = await api(admin, 'POST', '/office/sites', {
		name: 'Văn phòng Hồ Chí Minh, chi nhánh Quận 7, tòa nhà Saigon Riverside tầng 12',
	});

	const dnDec = await api(admin, 'POST', '/office/supply-periods', {
		officeSiteId: dn.id,
		month: '2026-12',
		deadline: '2026-12-20',
		departmentIds: allIds.slice(0, 4),
	});
	await api(admin, 'POST', `/office/supply-periods/${dnDec.id}/lock`);

	const hcmDec = await api(admin, 'POST', '/office/supply-periods', {
		officeSiteId: hcm.id,
		month: '2026-12',
		deadline: '2026-12-15',
		departmentIds: allIds,
	});
	const hcmJan = await api(admin, 'POST', '/office/supply-periods', {
		officeSiteId: hcm.id,
		month: '2027-01',
		deadline: '2026-12-26',
		departmentIds: allIds,
	});
	await drill.query(DB, `UPDATE office_supply_periods SET status = 'CLOSED', "lockedAt" = now(), "closedAt" = now() WHERE id = $1`, [
		hcmDec.id,
	]);
	await drill.query(DB, `UPDATE office_supply_periods SET deadline = '2026-11-20' WHERE id = $1`, [hcmJan.id]);

	console.log(`seed-p2 xong: ${allIds.length} phòng; ĐN kỳ ${dnDec.id} khoá; HCM kỳ ${hcmDec.id} đóng, kỳ ${hcmJan.id} quá hạn`);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
