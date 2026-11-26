// Nạp thêm dữ liệu cho trang Chi tiết kỳ (P3) vào sandbox đang chạy, sau seed-p2.cjs (và smoke-p2.mjs, đã mở kỳ
// 01/2027 của Đà Nẵng). Không đụng dev 6001.
//
//   - Kỳ 01/2027 HCM (id 5, đang đăng ký, quá hạn): 15 phòng, 8 phòng có dòng, hơn 100 mặt hàng, một nửa có giá,
//     một dòng ngoài danh mục.
//   - Kỳ 12/2026 Đà Nẵng (id 3, đã khoá): phiếu ở đủ các bước (đã cấp từ 10 ngày trước, đã chốt, còn chờ chốt) và một
//     phiếu bổ sung; kỳ 11/2026 Hà Nội (id 1) có phiếu đã nhận.
//   - Kỳ 02/2027 Hà Nội (id 7, đang đăng ký, chưa ai đăng ký): để thử Thêm phòng và Huỷ kỳ.
//
// Dòng phiếu của các phòng không có nhân viên đăng nhập được thì ghi thẳng vào DB sandbox; chốt, cấp, nhận, phiếu bổ
// sung đi qua API thật.
//
//   node tests/e2e/supply-catalog/seed-p3.cjs
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

const sql = (text, params) => drill.query(DB, text, params).then(r => r.rows);

async function requestsOf(periodId) {
	return sql(`SELECT id, "departmentId", sequence FROM office_supply_requests WHERE "periodId" = $1 ORDER BY "departmentId", sequence`, [periodId]);
}

/** Ghi dòng vào một phiếu, phần đăng ký đứng tên `employeeId`. */
async function addLines(requestId, employeeId, lines) {
	for (const line of lines) {
		const [row] = await sql(
			`INSERT INTO office_supply_request_lines ("requestId", "itemId", "customName", "customUnit", "requestedQty", note, "createdById", "updatedById", "updatedAt")
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $7, now()) RETURNING id`,
			[requestId, line.itemId ?? null, line.customName ?? null, line.customUnit ?? null, line.qty, line.note ?? null, employeeId],
		);
		await sql(`INSERT INTO office_supply_line_shares ("lineId", "employeeId", qty, "updatedAt") VALUES ($1, $2, $3, now())`, [
			row.id,
			employeeId,
			line.qty,
		]);
	}
}

async function main() {
	if (drill.PG_PORT !== 55477) throw new Error('Không phải cổng Postgres của sandbox P1');
	const acc = JSON.parse(fs.readFileSync(ACCOUNTS, 'utf8'));
	const admin = await drill.login(acc.people.admin);
	const hanh = await drill.login(acc.people.hanh);
	const me = await api(admin, 'GET', '/employees/me');

	// 15 phòng: thêm 6 phòng tên dài.
	for (const name of [
		'Phòng Đào tạo và Phát triển nguồn nhân lực',
		'Phòng Kế hoạch tổng hợp',
		'Phòng Quan hệ cổ đông',
		'Phòng Xuất nhập khẩu',
		'Phòng Thiết kế sản phẩm',
		'Phòng Dịch vụ hậu mãi và Bảo hành',
	]) {
		await api(admin, 'POST', '/departments', { name });
	}
	const departments = await api(admin, 'GET', '/departments?pagination=false');
	const allIds = (Array.isArray(departments) ? departments : departments.items ?? []).map(d => d.id);

	// Thêm 70 mặt hàng để bảng có hơn 100 dòng; một nửa danh mục có giá.
	const group = await api(admin, 'POST', '/office/supply-groups', { name: 'Vật tư in ấn và đóng gói dùng cho kho' });
	const extra = [];
	for (let i = 1; i <= 70; i++) {
		const item = await api(admin, 'POST', '/office/supply-items', {
			groupId: group.id,
			name: `Vật tư thử nghiệm số ${String(i).padStart(2, '0')}${i % 9 === 0 ? ' loại đặc biệt khổ lớn dùng cho máy in công nghiệp' : ''}`,
			unit: i % 3 ? 'Cái' : 'Hộp',
		});
		extra.push(item.id);
	}
	const catalogIds = [...Object.values(acc.items), ...extra];
	for (const [index, id] of catalogIds.entries()) {
		if (index % 2 === 0) await api(admin, 'PATCH', `/office/supply-items/${id}`, { unitPrice: 5000 + index * 1000 });
	}

	// Kỳ 01/2027 HCM: 15 phòng, 8 phòng có dòng.
	await api(admin, 'POST', '/office/supply-periods/5/departments', { departmentIds: allIds });
	const hcm = (await requestsOf(5)).filter(r => r.sequence === 0);
	for (const [index, req] of hcm.slice(0, 8).entries()) {
		const lines = catalogIds
			.filter((_, i) => (i + index) % 3 === 0 || (index === 0 && i < 105))
			.map((itemId, i) => ({ itemId, qty: 1 + ((i * 7 + index) % 12) }));
		if (index === 0) lines.push({ customName: 'Pin sạc dự phòng 20000mAh', customUnit: 'Cục', qty: 2, note: 'Cho phòng họp' });
		await addLines(req.id, me.id, lines);
	}

	// Kỳ 12/2026 Đà Nẵng (đã khoá): phiếu ở đủ các bước.
	const dn = (await requestsOf(3)).filter(r => r.sequence === 0);
	for (const [index, req] of dn.entries()) {
		await addLines(req.id, me.id, catalogIds.slice(index * 4, index * 4 + 6).map((itemId, i) => ({ itemId, qty: 2 + i })));
	}
	const byDept = new Map(dn.map(r => [r.departmentId, r.id]));
	const hcnsReq = byDept.get(1);
	const others = dn.filter(r => r.departmentId !== 1).map(r => r.id);
	if (hcnsReq) {
		await api(admin, 'POST', `/office/supply-requests/${hcnsReq}/finalize`, { lines: [] });
		await api(admin, 'POST', `/office/supply-requests/${hcnsReq}/issue`);
		await api(hanh, 'POST', `/me/office/supply-requests/${hcnsReq}/receive`, { lines: [] });
	}
	const [issuedReq, finalizedReq] = others;
	if (issuedReq) {
		await api(admin, 'POST', `/office/supply-requests/${issuedReq}/finalize`, { lines: [] });
		await api(admin, 'POST', `/office/supply-requests/${issuedReq}/issue`);
	}
	if (finalizedReq) await api(admin, 'POST', `/office/supply-requests/${finalizedReq}/finalize`, { lines: [] });
	const supplementDept = dn.find(r => r.id === finalizedReq)?.departmentId;
	if (supplementDept) {
		await api(admin, 'POST', '/office/supply-periods/3/supplements', {
			departmentId: supplementDept,
			note: 'Thiếu giấy in cho đợt quyết toán',
			lines: [{ itemId: catalogIds[1], requestedQty: 3 }],
		});
	}

	// Phiếu đã cấp từ 10 ngày trước: qua mốc ba ngày làm việc nên HCNS "Ghi đã giao thay" được.
	if (issuedReq) {
		await sql(`UPDATE office_supply_requests SET "issuedAt" = now() - interval '10 days' WHERE id = $1`, [issuedReq]);
	}

	// Kỳ 02/2027 Hà Nội: hai phòng, chưa ai đăng ký, để thử Thêm phòng và Huỷ kỳ.
	const spare = await api(admin, 'POST', '/office/supply-periods', {
		officeSiteId: 1,
		month: '2027-02',
		deadline: '2027-01-25',
		departmentIds: [1, 2],
	});

	// HCNS không thuộc kỳ Đà Nẵng: phiếu "đã nhận" lấy ở kỳ 11/2026 Hà Nội (id 1), phiếu HCNS đang đã chốt.
	const hn = (await requestsOf(1)).find(r => r.departmentId === 1 && r.sequence === 0);
	if (hn) {
		await api(admin, 'POST', `/office/supply-requests/${hn.id}/issue`);
		await api(hanh, 'POST', `/me/office/supply-requests/${hn.id}/receive`, { lines: [] });
	}

	console.log(
		`seed-p3 xong: kỳ thử huỷ ${spare.id}; ${allIds.length} phòng, ${catalogIds.length} mặt hàng; kỳ 5 có ${hcm.length} phòng; kỳ 3: HCNS ${hcnsReq} đã nhận, ${issuedReq} đã cấp, ${finalizedReq} đã chốt + bổ sung`,
	);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
