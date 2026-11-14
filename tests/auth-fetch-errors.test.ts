/**
 * ============================================================
 * Test suite: câu lỗi ra khỏi `useAuthFetch` luôn là tiếng Việt
 * ============================================================
 *
 * Vì sao cần: trước đây lỗi không mang `error.message` (mất mạng, máy chủ trả 413 hay 502 không
 * có JSON, request tải file dạng blob) được ném nguyên lỗi của `$fetch`, nên người dùng đọc
 * `[POST] "https://…": <no response> Failed to fetch` ngay trên toast. Hàm này dùng chung cho
 * MỌI màn hình của app, nên chốt từng nhánh bằng test.
 *
 * Ký hiệu: [EDGE] trường hợp biên
 * ============================================================
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthFetch } from '~/services/http/auth.fetch';

type FakeFetchError = Error & { response?: { status: number }; data?: unknown };

function fetchError(status?: number, data?: unknown): FakeFetchError {
	const err = new Error('[POST] "http://test-api.local/v1/x": <no response> Failed to fetch') as FakeFetchError;
	if (status != null) err.response = { status };
	err.data = data;
	return err;
}

const $fetchMock = globalThis.$fetch as unknown as ReturnType<typeof vi.fn>;

async function caught(promise: Promise<unknown>): Promise<Error & { status?: number; data?: unknown }> {
	try {
		await promise;
	} catch (e) {
		return e as Error & { status?: number; data?: unknown };
	}
	throw new Error('expected rejection');
}

afterEach(() => {
	$fetchMock.mockReset();
});

describe('useAuthFetch — câu lỗi tiếng Việt', () => {
	it('giữ nguyên câu tiếng Việt của BE và mã lỗi', async () => {
		$fetchMock.mockRejectedValueOnce(
			fetchError(409, { error: { code: 'ASSET_INCIDENT_OPEN', message: 'Bạn đã gửi báo hỏng rồi.' } }),
		);
		const err = await caught(useAuthFetch()('/v1/x', { method: 'POST' }));
		expect(err.message).toBe('Bạn đã gửi báo hỏng rồi.');
		expect(err.status).toBe(409);
		expect((err.data as { error: { code: string } }).error.code).toBe('ASSET_INCIDENT_OPEN');
	});

	it('mất mạng khi gửi: nói thông tin vẫn còn, không lộ URL', async () => {
		$fetchMock.mockRejectedValueOnce(fetchError());
		const err = await caught(useAuthFetch()('/v1/x', { method: 'POST' }));
		expect(err.message).toContain('mạng bị gián đoạn');
		expect(err.message).toContain('Thông tin bạn nhập vẫn còn');
		expect(err.message).not.toContain('http');
		expect(err.status).toBeUndefined();
	});

	it('mất mạng khi tải dữ liệu: bảo kiểm kết nối rồi tải lại', async () => {
		$fetchMock.mockRejectedValueOnce(fetchError());
		const err = await caught(useAuthFetch()('/v1/x'));
		expect(err.message).toContain('Chưa tải được dữ liệu');
	});

	it('413 không có thân lỗi: câu về dung lượng', async () => {
		$fetchMock.mockRejectedValueOnce(fetchError(413, '<html>Request Entity Too Large</html>'));
		const err = await caught(useAuthFetch()('/v1/x', { method: 'POST' }));
		expect(err.message).toContain('vượt dung lượng');
		expect(err.status).toBe(413);
	});

	it('502 không có thân lỗi: câu xin lỗi', async () => {
		$fetchMock.mockRejectedValueOnce(fetchError(502, '<html>Bad Gateway</html>'));
		const err = await caught(useAuthFetch()('/v1/x', { method: 'PATCH' }));
		expect(err.message).toMatch(/^Xin lỗi, hệ thống đang gặp sự cố/);
		expect(err.status).toBe(502);
	});

	it('[EDGE] request tải file nhận lỗi dạng Blob: đọc lại để lấy câu của BE', async () => {
		const body = JSON.stringify({ error: { code: 'ASSET_REPORT_RANGE_TOO_LONG', message: 'Kỳ xuất dài tối đa 12 tháng.' } });
		$fetchMock.mockRejectedValueOnce(fetchError(400, new Blob([body], { type: 'application/json' })));
		const err = await caught(useAuthFetch()('/v1/asset-reports/accounting-export', { responseType: 'blob' }));
		expect(err.message).toBe('Kỳ xuất dài tối đa 12 tháng.');
		expect((err.data as { error: { code: string } }).error.code).toBe('ASSET_REPORT_RANGE_TOO_LONG');
	});

	it('[EDGE] Blob không phải JSON thì rơi về câu dự phòng, không lộ chữ tiếng Anh', async () => {
		$fetchMock.mockRejectedValueOnce(fetchError(500, new Blob(['Internal Server Error'])));
		const err = await caught(useAuthFetch()('/v1/assets/export', { responseType: 'blob' }));
		expect(err.message).toMatch(/^Xin lỗi/);
	});
});
