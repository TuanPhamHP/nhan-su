/** In schema theo tên, giải $ref một tầng, để đọc nhanh thay vì mở cả openapi. */
import { readFileSync } from 'node:fs';

const spec = JSON.parse(
	readFileSync('/home/tuanpham/work/hr-system/.worktrees/be-approval/docs/openapi.json', 'utf8'),
);

const names = process.argv.slice(2);
if (names[0] === '--list') {
	const re = new RegExp(names[1] ?? '.', 'i');
	console.log(Object.keys(spec.components.schemas).filter(n => re.test(n)).join('\n'));
	process.exit(0);
}

function shallow(node, depth = 0) {
	if (!node || typeof node !== 'object') return node;
	if (node.$ref) {
		const name = node.$ref.split('/').pop();
		return depth === 0 ? shallow(spec.components.schemas[name], depth + 1) : `<${name}>`;
	}
	if (Array.isArray(node)) return node.map(n => shallow(n, depth));
	const out = {};
	for (const [k, v] of Object.entries(node)) {
		if (k === 'example' || k === 'examples') continue;
		out[k] = shallow(v, depth);
	}
	return out;
}

/** Gọn một property thành một dòng: type, nullable, enum, ref. */
function brief(schema) {
	const props = schema.properties ?? {};
	const req = new Set(schema.required ?? []);
	const lines = [];
	for (const [k, raw] of Object.entries(props)) {
		const v = shallow(raw, 1);
		let t = v.$ref ? `<${v.$ref.split('/').pop()}>` : (v.type ?? '');
		if (t === 'array') {
			const it = v.items ?? {};
			const itT = typeof it === 'string' ? it : (it.$ref ? `<${it.$ref.split('/').pop()}>` : it.type);
			t = `${itT}[]`;
		}
		if (v.allOf) t = (typeof v.allOf[0] === 'string' ? v.allOf[0] : JSON.stringify(v.allOf[0]));
		if (v.enum) t += ` enum(${v.enum.join('|')})`;
		if (v.nullable) t += ' | null';
		lines.push(`  ${k}${req.has(k) ? '' : '?'}: ${t}${v.description ? `   // ${v.description}` : ''}`);
	}
	return lines.join('\n');
}

for (const name of names) {
	const s = spec.components.schemas[name];
	if (!s) { console.log(`\n### ${name} — KHÔNG CÓ`); continue; }
	console.log(`\n### ${name}`);
	console.log(brief(s));
}
