/** In luồng duyệt của mọi loại phiếu trên sandbox, để biết mẫu nào có điều kiện. */
import { readFileSync } from 'node:fs';

const API = 'http://localhost:3170';
// Mật khẩu và tài khoản đọc lúc chạy từ file sandbox của session BE, không ghi trong file này.
const sandbox = JSON.parse(readFileSync('/home/tuanpham/work/hr-system/.sandbox-4a/sandbox-4a.json', 'utf8'));

const res = await fetch(`${API}/v1/auth/login`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ email: sandbox.people.hr.email, password: sandbox.password }),
});
const t = (await res.json()).data.accessToken;

const headers = { Authorization: `Bearer ${t}` };
const list = await (await fetch(`${API}/v1/general-requests/templates`, { headers })).json();

for (const tpl of list.data.sort((a, b) => a.id - b.id)) {
	const flow = await (await fetch(`${API}/v1/general-requests/templates/${tpl.id}/flow`, { headers })).json();
	const steps = (flow.data?.steps ?? []).map(s => {
		const a = s.approver;
		const who =
			a.kind === 'SUBMITTER_PICK'
				? `PICK(${a.pick?.min}-${a.pick?.max}${a.pick?.sequential ? ',tuần tự' : ''}${a.pick?.roles?.length ? ',' + a.pick.roles.join('/') : ''})`
				: a.kind === 'ROLE'
					? `ROLE(${a.role})`
					: a.kind === 'EMPLOYEES'
						? `EMPLOYEES(${a.employeeIds})`
						: a.kind === 'MANAGER_LEVEL'
							? `MANAGER_LEVEL(${a.level})`
							: a.kind;
		const cond = s.condition ? ` IF ${JSON.stringify(s.condition)}` : '';
		return `${s.order}.${s.name}[${who},${s.mode}${s.slaHours ? ',' + s.slaHours + 'h' : ''}]${cond}`;
	});
	console.log(
		`#${tpl.id} ${tpl.name} (${tpl.codePrefix}, ${tpl.isActive ? 'bật' : 'TẮT'}, v${flow.data?.version}) fields=${tpl.fields.map(f => f.key + ':' + f.type).join(',')} watchers=${JSON.stringify(tpl.defaultWatcherIds)}`,
	);
	console.log('   ', steps.join(' | ') || '(không có bước)');
}
