/**
 * Gọi nhanh API sandbox 4a để kiểm hình dạng response thật.
 *
 *   node api4a.mjs <email> <METHOD> <path> ['<json body>']
 */
import { readFileSync } from 'node:fs';

const API = 'http://localhost:3170';
// Mật khẩu đọc lúc chạy từ file sandbox của session BE, không ghi trong file này.
const PASSWORD = JSON.parse(readFileSync('/home/tuanpham/work/hr-system/.sandbox-4a/sandbox-4a.json', 'utf8')).password;

const [email, method = 'GET', path, body] = process.argv.slice(2);

async function token(mail) {
	const res = await fetch(`${API}/v1/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email: mail, password: PASSWORD }),
	});
	const json = await res.json();
	if (!json?.data?.accessToken) throw new Error(`đăng nhập thất bại: ${JSON.stringify(json).slice(0, 300)}`);
	return json.data.accessToken;
}

const t = await token(email);
const res = await fetch(`${API}${path}`, {
	method,
	headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
	body: body ? body : undefined,
});
const text = await res.text();
console.log('status', res.status);
try {
	console.log(JSON.stringify(JSON.parse(text), null, 1));
} catch {
	console.log(text.slice(0, 2000));
}
