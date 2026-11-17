/**
 * Rút các path và schema liên quan phiếu đề xuất, uỷ quyền duyệt từ openapi của nhánh BE.
 * In ra dạng gọn để đọc: method, path, body, query, response schema đã giải $ref một tầng.
 */
import { readFileSync } from 'node:fs';

const spec = JSON.parse(
	readFileSync('/home/tuanpham/work/hr-system/.worktrees/be-approval/docs/openapi.json', 'utf8'),
);

const want = process.argv[2] ?? 'general-requests|approval-delegations|approval/counts';
const re = new RegExp(want);

const seen = new Set();

function resolve(node, depth = 0) {
	if (!node || typeof node !== 'object' || depth > 6) return node;
	if (node.$ref) {
		const name = node.$ref.split('/').pop();
		if (seen.has(name) && depth > 0) return { $ref: name };
		seen.add(name);
		return { __schema: name, ...resolve(spec.components.schemas[name], depth + 1) };
	}
	if (Array.isArray(node)) return node.map(n => resolve(n, depth + 1));
	const out = {};
	for (const [k, v] of Object.entries(node)) {
		if (k === 'example' || k === 'examples') continue;
		out[k] = resolve(v, depth + 1);
	}
	return out;
}

for (const [path, ops] of Object.entries(spec.paths)) {
	if (!re.test(path)) continue;
	for (const [method, op] of Object.entries(ops)) {
		console.log(`\n### ${method.toUpperCase()} ${path} — ${op.summary ?? ''}`);
		if (op.parameters?.length) {
			console.log('params:', JSON.stringify(op.parameters.map(p => ({ name: p.name, in: p.in, req: p.required, schema: resolve(p.schema) }))));
		}
		const body = op.requestBody?.content?.['application/json']?.schema ?? op.requestBody?.content?.['multipart/form-data']?.schema;
		if (body) console.log('body:', JSON.stringify(resolve(body), null, 1));
		for (const [code, res] of Object.entries(op.responses ?? {})) {
			const s = res.content?.['application/json']?.schema;
			if (s) console.log(`res ${code}:`, JSON.stringify(resolve(s), null, 1).slice(0, 4000));
			else console.log(`res ${code}: ${res.description ?? ''}`);
		}
	}
}
