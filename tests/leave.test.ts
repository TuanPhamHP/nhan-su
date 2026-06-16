/**
 * ============================================================
 * Test suite: Module Xin Nghỉ (Leave Request)
 * ============================================================
 *
 * Cấu trúc:
 *   1. leave.utils       — pure functions (no mocks)
 *   2. LeaveRequestService — service layer (HTTP transport mocked)
 *   3. useLeaveRequests   — composable state (service via HTTP mock)
 *   4. DTO / type shapes  — structural / invariant checks
 *   5. Edge cases         — boundaries, error paths, concurrency
 *
 * Ký hiệu trong tên test:
 *   [EDGE]  — boundary value hoặc trường hợp bất thường
 *   [BNDRY] — boundary value chính xác tại điểm ngưỡng
 *   [ERR]   — kiểm tra luồng lỗi / error propagation
 * ============================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── vi.hoisted: khai báo trước khi vi.mock hoisting ─────────────────────────
// Bắt buộc dùng vi.hoisted vì vi.mock được hoisted lên đầu file,
// trước khi bất kỳ const nào được khởi tạo.
const mockFetch = vi.hoisted(() => vi.fn())

// ─── Module mocks ─────────────────────────────────────────────────────────────
// Mock HTTP transport layer — service sẽ dùng mockFetch thay vì $fetch thật
vi.mock('~/services/http/auth.fetch', () => ({
	useAuthFetch: () => mockFetch,
}))

// ─── Imports (SAU vi.mock) ────────────────────────────────────────────────────
import { MAX_LATE_EARLY_MINUTES, isOverLateEarlyLimit, getLateEarlyWarningMessage } from '~/utils/leave.utils'
import { useLeaveRequestService } from '~/services/leave-request.service'
import { useLeaveRequests } from '~/composables/useLeaveRequests'
import type {
	LeaveRequest,
	LeavePreviewResponse,
	LeaveRequestSummary,
	CreateLeaveRequestDto,
} from '~/types/leave.types'

// ─── Test fixtures ────────────────────────────────────────────────────────────

function apiWrap<T>(data: T) {
	return { success: true, data }
}

function pageWrap<T>(items: T[], total = items.length) {
	return {
		success: true,
		data: items,
		meta: { page: 1, limit: 10, total, totalPages: Math.max(1, Math.ceil(total / 10)) },
	}
}

const BASE_REQUEST: LeaveRequest = {
	id: 1,
	employee: { id: 10, fullName: 'Nguyễn Văn A', employeeCode: 'EMP001', department: 'Phòng IT' },
	leaveType: { id: 2, name: 'Nghỉ phép năm', code: 'ANNUAL' },
	startDate: '2026-06-10',
	endDate: '2026-06-12',
	totalDays: 3,
	reason: 'Việc gia đình',
	status: 'PENDING',
	halfDayPeriod: null,
	lateMinutes: null,
	earlyMinutes: null,
	approvedBy: null,
	approvedAt: null,
	rejectNote: null,
	assignedApprover: { id: 5, fullName: 'Trần Thị B', email: 'b@company.com' },
	createdAt: '2026-06-08T10:00:00Z',
	canBeRevoked: true,
	canBeRemoved: false,
	timeline: null,
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. PURE FUNCTIONS — leave.utils
// ═════════════════════════════════════════════════════════════════════════════

describe('leave.utils — pure functions', () => {
	// ── MAX_LATE_EARLY_MINUTES ───────────────────────────────────────────────

	it('TC01: hằng số MAX_LATE_EARLY_MINUTES phải bằng 120', () => {
		expect(MAX_LATE_EARLY_MINUTES).toBe(120)
	})

	// ── isOverLateEarlyLimit ─────────────────────────────────────────────────

	it('TC02 [BNDRY]: đúng 120 phút → KHÔNG vượt ngưỡng (strictly greater than)', () => {
		// Boundary: điều kiện là > 120, không phải >= 120
		expect(isOverLateEarlyLimit(120)).toBe(false)
	})

	it('TC03 [BNDRY]: 121 phút → vượt ngưỡng', () => {
		expect(isOverLateEarlyLimit(121)).toBe(true)
	})

	it('TC04: 0 phút → không vượt ngưỡng', () => {
		expect(isOverLateEarlyLimit(0)).toBe(false)
	})

	it('TC05 [EDGE]: số âm → không vượt ngưỡng (input không hợp lệ nhưng không được crash)', () => {
		expect(isOverLateEarlyLimit(-1)).toBe(false)
	})

	it('TC06: giá trị lớn (240 phút) → vượt ngưỡng', () => {
		expect(isOverLateEarlyLimit(240)).toBe(true)
	})

	it('TC07 [BNDRY]: 119 phút → không vượt, 120 không vượt, 121 vượt (tam điểm biên)', () => {
		expect(isOverLateEarlyLimit(119)).toBe(false)
		expect(isOverLateEarlyLimit(120)).toBe(false)
		expect(isOverLateEarlyLimit(121)).toBe(true)
	})

	// ── getLateEarlyWarningMessage ───────────────────────────────────────────

	it('TC08: LATE warning chứa "đi muộn" và "nửa ngày"', () => {
		const msg = getLateEarlyWarningMessage('LATE')
		expect(msg).toContain('đi muộn')
		expect(msg).toContain('nửa ngày')
	})

	it('TC09: EARLY warning chứa "về sớm" và "nửa ngày"', () => {
		const msg = getLateEarlyWarningMessage('EARLY')
		expect(msg).toContain('về sớm')
		expect(msg).toContain('nửa ngày')
	})

	it('TC10 [EDGE]: LATE và EARLY trả về chuỗi khác nhau', () => {
		expect(getLateEarlyWarningMessage('LATE')).not.toBe(getLateEarlyWarningMessage('EARLY'))
	})
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. SERVICE LAYER — useLeaveRequestService
// ═════════════════════════════════════════════════════════════════════════════

describe('LeaveRequestService', () => {
	let service: ReturnType<typeof useLeaveRequestService>

	beforeEach(() => {
		vi.clearAllMocks()
		service = useLeaveRequestService()
	})

	it('TC11: findAll — trả về data[] và meta đúng cấu trúc', async () => {
		mockFetch.mockResolvedValue(pageWrap([BASE_REQUEST]))
		const result = await service.findAll()
		expect(result.data).toHaveLength(1)
		expect(result.data[0].id).toBe(1)
		expect(result.meta).toMatchObject({ page: 1, total: 1 })
	})

	it('TC12: findAll — truyền query params vào fetch đúng', async () => {
		mockFetch.mockResolvedValue(pageWrap([]))
		await service.findAll({ status: 'PENDING', page: 2, limit: 20 })
		expect(mockFetch).toHaveBeenCalledWith(
			'/v1/leave-requests',
			expect.objectContaining({ params: { status: 'PENDING', page: 2, limit: 20 } }),
		)
	})

	it('TC13: findMe — gọi endpoint /v1/leave-requests/me', async () => {
		mockFetch.mockResolvedValue(pageWrap([]))
		await service.findMe()
		expect(mockFetch).toHaveBeenCalledWith('/v1/leave-requests/me', expect.anything())
	})

	it('TC14: findOne — gọi endpoint đúng và unwrap data', async () => {
		mockFetch.mockResolvedValue(apiWrap(BASE_REQUEST))
		const result = await service.findOne(1)
		expect(mockFetch).toHaveBeenCalledWith('/v1/leave-requests/1', expect.anything())
		expect(result.id).toBe(1)
		expect(result.status).toBe('PENDING')
	})

	it('TC15: preview — POST đến /preview với body đúng', async () => {
		const preview: LeavePreviewResponse = {
			totalDays: 3,
			paidDays: 2,
			unpaidDays: 1,
			leaveCode: 'P+KL',
			warningMessage: null,
			remainingAfter: 7,
			currentBalance: 10,
		}
		mockFetch.mockResolvedValue(apiWrap(preview))
		const dto: CreateLeaveRequestDto = { leaveTypeId: 1, startDate: '2026-06-10', endDate: '2026-06-12' }
		const result = await service.preview(dto)
		expect(mockFetch).toHaveBeenCalledWith(
			'/v1/leave-requests/preview',
			expect.objectContaining({ method: 'POST', body: dto }),
		)
		expect(result.paidDays + result.unpaidDays).toBe(result.totalDays)
	})

	it('TC16: create — POST trả về request mới với status PENDING', async () => {
		mockFetch.mockResolvedValue(apiWrap(BASE_REQUEST))
		const dto: CreateLeaveRequestDto = {
			leaveTypeId: 2,
			startDate: '2026-06-10',
			endDate: '2026-06-10',
			reason: 'Test lý do',
		}
		const result = await service.create(dto)
		expect(mockFetch).toHaveBeenCalledWith(
			'/v1/leave-requests',
			expect.objectContaining({ method: 'POST', body: dto }),
		)
		expect(result.status).toBe('PENDING')
	})

	it('TC17: getSummary — trả về thống kê đúng cấu trúc', async () => {
		const summary: LeaveRequestSummary = { pending: 3, approvedThisMonth: 5, rejected: 1, cancelled: 2 }
		mockFetch.mockResolvedValue(apiWrap(summary))
		const result = await service.getSummary()
		expect(result.pending).toBe(3)
		expect(result.approvedThisMonth).toBe(5)
	})

	it('TC18: approve — PATCH đến /:id/approve, trả về status APPROVED', async () => {
		const approved = { ...BASE_REQUEST, status: 'APPROVED' as const }
		mockFetch.mockResolvedValue(apiWrap(approved))
		const result = await service.approve(1)
		expect(mockFetch).toHaveBeenCalledWith(
			'/v1/leave-requests/1/approve',
			expect.objectContaining({ method: 'PATCH' }),
		)
		expect(result.status).toBe('APPROVED')
	})

	it('TC19: reject — PATCH với rejectNote trong body', async () => {
		const rejected = { ...BASE_REQUEST, status: 'REJECTED' as const, rejectNote: 'Thiếu giấy tờ' }
		mockFetch.mockResolvedValue(apiWrap(rejected))
		const result = await service.reject(1, 'Thiếu giấy tờ')
		expect(mockFetch).toHaveBeenCalledWith(
			'/v1/leave-requests/1/reject',
			expect.objectContaining({ method: 'PATCH', body: { rejectNote: 'Thiếu giấy tờ' } }),
		)
		expect(result.rejectNote).toBe('Thiếu giấy tờ')
	})

	it('TC20: cancel — PATCH đến /:id/cancel, trả về status CANCELLED', async () => {
		const cancelled = { ...BASE_REQUEST, status: 'CANCELLED' as const }
		mockFetch.mockResolvedValue(apiWrap(cancelled))
		const result = await service.cancel(1)
		expect(mockFetch).toHaveBeenCalledWith(
			'/v1/leave-requests/1/cancel',
			expect.objectContaining({ method: 'PATCH' }),
		)
		expect(result.status).toBe('CANCELLED')
	})

	it('TC21: remove — DELETE, không throw (void return)', async () => {
		mockFetch.mockResolvedValue(undefined)
		await expect(service.remove(1)).resolves.not.toThrow()
		expect(mockFetch).toHaveBeenCalledWith('/v1/leave-requests/1', expect.objectContaining({ method: 'DELETE' }))
	})

	it('TC22 [ERR]: lỗi từ service được propagate lên caller', async () => {
		mockFetch.mockRejectedValue(new Error('Không đủ số ngày nghỉ'))
		await expect(
			service.create({ leaveTypeId: 1, startDate: '2026-06-10', endDate: '2026-06-10' }),
		).rejects.toThrow('Không đủ số ngày nghỉ')
	})

	it('TC23 [EDGE]: reject với rejectNote rỗng — vẫn gửi body', async () => {
		mockFetch.mockResolvedValue(apiWrap(BASE_REQUEST))
		await service.reject(1, '')
		expect(mockFetch).toHaveBeenCalledWith(
			'/v1/leave-requests/1/reject',
			expect.objectContaining({ body: { rejectNote: '' } }),
		)
	})
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. COMPOSABLE — useLeaveRequests
// ═════════════════════════════════════════════════════════════════════════════

describe('useLeaveRequests composable', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('TC24: state khởi tạo — mảng rỗng, không loading', () => {
		const { requests, loading, meta, summary } = useLeaveRequests()
		expect(requests.value).toEqual([])
		expect(loading.value).toBe(false)
		expect(meta.value).toBeNull()
		expect(summary.value).toBeNull()
	})

	it('TC25: fetchAll — cập nhật requests và meta', async () => {
		mockFetch.mockResolvedValue(pageWrap([BASE_REQUEST]))
		const { requests, meta, fetchAll } = useLeaveRequests()
		await fetchAll()
		expect(requests.value).toHaveLength(1)
		expect(requests.value[0].id).toBe(1)
		expect(meta.value?.total).toBe(1)
	})

	it('TC26: fetchAll — loading = true trong khi fetch, false sau khi xong', async () => {
		mockFetch.mockResolvedValue(pageWrap([]))
		const { loading, fetchAll } = useLeaveRequests()
		const promise = fetchAll()
		// Kiểm tra NGAY SAU khi gọi (trước await nội bộ đầu tiên):
		// loading.value = true được set SYNCHRONOUSLY trước await service.findAll()
		expect(loading.value).toBe(true)
		await promise
		expect(loading.value).toBe(false)
	})

	it('TC27: fetchMyRequests — gọi endpoint /me', async () => {
		mockFetch.mockResolvedValue(pageWrap([]))
		const { fetchMyRequests } = useLeaveRequests()
		await fetchMyRequests()
		expect(mockFetch).toHaveBeenCalledWith('/v1/leave-requests/me', expect.anything())
	})

	it('TC28: approveRequest — cập nhật item trong list thành APPROVED', async () => {
		const approved = { ...BASE_REQUEST, status: 'APPROVED' as const }
		mockFetch.mockResolvedValueOnce(pageWrap([BASE_REQUEST])).mockResolvedValueOnce(apiWrap(approved))
		const { requests, fetchAll, approveRequest } = useLeaveRequests()
		await fetchAll()
		await approveRequest(1)
		expect(requests.value[0].status).toBe('APPROVED')
	})

	it('TC29: rejectRequest — cập nhật status và rejectNote trong list', async () => {
		const rejected = { ...BASE_REQUEST, status: 'REJECTED' as const, rejectNote: 'Không hợp lệ' }
		mockFetch.mockResolvedValueOnce(pageWrap([BASE_REQUEST])).mockResolvedValueOnce(apiWrap(rejected))
		const { requests, fetchAll, rejectRequest } = useLeaveRequests()
		await fetchAll()
		await rejectRequest(1, 'Không hợp lệ')
		expect(requests.value[0].status).toBe('REJECTED')
		expect(requests.value[0].rejectNote).toBe('Không hợp lệ')
	})

	it('TC30: cancelRequest — cập nhật status thành CANCELLED', async () => {
		const cancelled = { ...BASE_REQUEST, status: 'CANCELLED' as const }
		mockFetch.mockResolvedValueOnce(pageWrap([BASE_REQUEST])).mockResolvedValueOnce(apiWrap(cancelled))
		const { requests, fetchAll, cancelRequest } = useLeaveRequests()
		await fetchAll()
		await cancelRequest(1)
		expect(requests.value[0].status).toBe('CANCELLED')
	})

	it('TC31: removeRequest — item bị xóa khỏi list', async () => {
		const second = { ...BASE_REQUEST, id: 2, employee: { ...BASE_REQUEST.employee, id: 11 } }
		mockFetch.mockResolvedValueOnce(pageWrap([BASE_REQUEST, second])).mockResolvedValueOnce(undefined)
		const { requests, fetchAll, removeRequest } = useLeaveRequests()
		await fetchAll()
		expect(requests.value).toHaveLength(2)
		await removeRequest(1)
		expect(requests.value).toHaveLength(1)
		expect(requests.value[0].id).toBe(2)
	})

	it('TC32 [EDGE]: approveRequest với id không tồn tại trong list — không crash, list không đổi', async () => {
		// _replaceInList: khi idx === -1, splice không được gọi
		mockFetch.mockResolvedValueOnce(pageWrap([])).mockResolvedValueOnce(apiWrap({ ...BASE_REQUEST, id: 999 }))
		const { requests, fetchAll, approveRequest } = useLeaveRequests()
		await fetchAll()
		await expect(approveRequest(999)).resolves.not.toThrow()
		expect(requests.value).toHaveLength(0)
	})

	it('TC33 [ERR]: fetchSummary thất bại — SILENT, không throw, summary vẫn null', async () => {
		// fetchSummary được wrap trong try/catch không re-throw (non-critical)
		mockFetch.mockRejectedValue(new Error('Network error'))
		const { summary, fetchSummary } = useLeaveRequests()
		await expect(fetchSummary()).resolves.not.toThrow()
		expect(summary.value).toBeNull()
	})

	it('TC34 [ERR]: fetchAll thất bại — loading reset về false qua finally block', async () => {
		mockFetch.mockRejectedValue(new Error('Server 500'))
		const { loading, fetchAll } = useLeaveRequests()
		await expect(fetchAll()).rejects.toThrow('Server 500')
		// finally { loading.value = false } phải chạy dù có lỗi
		expect(loading.value).toBe(false)
	})

	it('TC35 [EDGE]: fetchAll với filter params — params được truyền đúng', async () => {
		mockFetch.mockResolvedValue(pageWrap([]))
		const { fetchAll } = useLeaveRequests()
		await fetchAll({ status: 'APPROVED', departmentId: 3, page: 1, limit: 5 })
		expect(mockFetch).toHaveBeenCalledWith(
			'/v1/leave-requests',
			expect.objectContaining({
				params: { status: 'APPROVED', departmentId: 3, page: 1, limit: 5 },
			}),
		)
	})
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. DTO & TYPE INVARIANTS
// ═════════════════════════════════════════════════════════════════════════════

describe('DTO và type invariants', () => {
	it('TC36: CreateLeaveRequestDto — chỉ required fields (ANNUAL)', () => {
		const dto: CreateLeaveRequestDto = {
			leaveTypeId: 1,
			startDate: '2026-06-10',
			endDate: '2026-06-12',
		}
		expect(dto.leaveTypeId).toBe(1)
		expect(dto.halfDayPeriod).toBeUndefined()
		expect(dto.lateMinutes).toBeUndefined()
		expect(dto.earlyMinutes).toBeUndefined()
	})

	it('TC37: CreateLeaveRequestDto — HALF_DAY với halfDayPeriod hợp lệ', () => {
		const dto: CreateLeaveRequestDto = {
			leaveTypeId: 3,
			startDate: '2026-06-10',
			endDate: '2026-06-10',
			halfDayPeriod: 'MORNING',
		}
		expect(['MORNING', 'AFTERNOON']).toContain(dto.halfDayPeriod)
	})

	it('TC38: CreateLeaveRequestDto — LATE với lateMinutes = 30 (không vượt ngưỡng)', () => {
		const dto: CreateLeaveRequestDto = {
			leaveTypeId: 4,
			startDate: '2026-06-10',
			endDate: '2026-06-10',
			lateMinutes: 30,
		}
		expect(isOverLateEarlyLimit(dto.lateMinutes!)).toBe(false)
	})

	it('TC39 [BNDRY]: LeavePreviewResponse — paidDays + unpaidDays === totalDays (invariant)', () => {
		const preview: LeavePreviewResponse = {
			totalDays: 5,
			paidDays: 3,
			unpaidDays: 2,
			leaveCode: 'P+KL',
			warningMessage: null,
			remainingAfter: 5,
			currentBalance: 8,
		}
		expect(preview.paidDays + preview.unpaidDays).toBe(preview.totalDays)
	})

	it('TC40: LeavePreviewResponse — fully paid (unpaidDays = 0, leaveCode = P)', () => {
		const preview: LeavePreviewResponse = {
			totalDays: 3,
			paidDays: 3,
			unpaidDays: 0,
			leaveCode: 'P',
			warningMessage: null,
			remainingAfter: 7,
			currentBalance: 10,
		}
		expect(preview.leaveCode).toBe('P')
		expect(preview.paidDays + preview.unpaidDays).toBe(preview.totalDays)
	})

	it('TC41 [EDGE]: LeavePreviewResponse — fully unpaid (balance = 0, leaveCode = KL)', () => {
		const preview: LeavePreviewResponse = {
			totalDays: 3,
			paidDays: 0,
			unpaidDays: 3,
			leaveCode: 'KL',
			warningMessage: 'Số ngày nghỉ phép năm đã hết',
			remainingAfter: 0,
			currentBalance: 0,
		}
		expect(preview.leaveCode).toBe('KL')
		expect(preview.warningMessage).not.toBeNull()
		expect(preview.paidDays + preview.unpaidDays).toBe(preview.totalDays)
	})

	it('TC42: LeaveRequest — tất cả nullable fields có thể là null', () => {
		const req: LeaveRequest = {
			...BASE_REQUEST,
			halfDayPeriod: null,
			lateMinutes: null,
			earlyMinutes: null,
			approvedBy: null,
			approvedAt: null,
			rejectNote: null,
			assignedApprover: null,
			reason: null,
			timeline: null,
		}
		// Không được throw khi access nullable fields
		expect(req.halfDayPeriod).toBeNull()
		expect(req.approvedBy).toBeNull()
		expect(req.reason).toBeNull()
		expect(req.timeline).toBeNull()
	})
})

// ═════════════════════════════════════════════════════════════════════════════
// 5. EDGE CASES NÂNG CAO
// ═════════════════════════════════════════════════════════════════════════════

describe('Edge cases — boundary & error paths', () => {
	beforeEach(() => vi.clearAllMocks())

	it('TC43 [EDGE]: findAll với danh sách rỗng — meta.total = 0, data = []', async () => {
		mockFetch.mockResolvedValue(pageWrap([]))
		const service = useLeaveRequestService()
		const result = await service.findAll()
		expect(result.data).toEqual([])
		expect(result.meta.total).toBe(0)
	})

	it('TC44 [ERR]: cancel đơn đã CANCELLED — lỗi từ API được propagate', async () => {
		mockFetch.mockRejectedValue(new Error('Đơn đã được hủy trước đó'))
		const service = useLeaveRequestService()
		await expect(service.cancel(1)).rejects.toThrow('Đơn đã được hủy trước đó')
	})

	it('TC45 [ERR]: approve đơn đã APPROVED — lỗi từ API được propagate', async () => {
		mockFetch.mockRejectedValue(new Error('Đơn đã được duyệt'))
		const service = useLeaveRequestService()
		await expect(service.approve(1)).rejects.toThrow('Đã được duyệt')
	})

	it('TC46 [EDGE]: loading flag reset khi fetchAll bị reject', async () => {
		mockFetch.mockRejectedValue(new Error('timeout'))
		const { loading, fetchAll } = useLeaveRequests()
		try {
			await fetchAll()
		} catch {}
		expect(loading.value).toBe(false)
	})

	it('TC47 [EDGE]: fetchAll nhiều lần liên tiếp — chỉ giữ kết quả lần cuối', async () => {
		const firstResult = [BASE_REQUEST]
		const secondResult = [{ ...BASE_REQUEST, id: 99 }]
		mockFetch
			.mockResolvedValueOnce(pageWrap(firstResult))
			.mockResolvedValueOnce(pageWrap(secondResult))
		const { requests, fetchAll } = useLeaveRequests()
		await fetchAll()
		expect(requests.value[0].id).toBe(1)
		await fetchAll()
		expect(requests.value[0].id).toBe(99)
		expect(requests.value).toHaveLength(1)
	})

	it('TC48 [EDGE]: preview trả về warningMessage khi LATE > 120 phút', async () => {
		// Khi tạo đơn LATE với 150 phút → backend trả về warning
		const preview: LeavePreviewResponse = {
			totalDays: 0.5,
			paidDays: 0.5,
			unpaidDays: 0,
			leaveCode: 'P',
			warningMessage: getLateEarlyWarningMessage('LATE'),
			remainingAfter: 4.5,
			currentBalance: 5,
		}
		mockFetch.mockResolvedValue(apiWrap(preview))
		const service = useLeaveRequestService()
		const result = await service.preview({
			leaveTypeId: 4,
			startDate: '2026-06-10',
			endDate: '2026-06-10',
			lateMinutes: 150,
		})
		expect(result.warningMessage).toContain('nửa ngày')
		expect(isOverLateEarlyLimit(150)).toBe(true)
	})

	it('TC49 [EDGE]: removeRequest với id không tồn tại trong list — không crash', async () => {
		mockFetch.mockResolvedValue(undefined)
		const { requests, removeRequest } = useLeaveRequests()
		// requests ban đầu rỗng
		await expect(removeRequest(999)).resolves.not.toThrow()
		expect(requests.value).toHaveLength(0)
	})

	it('TC50 [EDGE]: findAll với tất cả filter params — params được truyền đúng', async () => {
		mockFetch.mockResolvedValue(pageWrap([]))
		const service = useLeaveRequestService()
		await service.findAll({
			employeeId: 10,
			departmentId: 3,
			status: 'REJECTED',
			leaveTypeId: 2,
			startDate: '2026-01-01',
			endDate: '2026-12-31',
			page: 3,
			limit: 5,
		})
		expect(mockFetch).toHaveBeenCalledWith(
			'/v1/leave-requests',
			expect.objectContaining({
				params: expect.objectContaining({
					status: 'REJECTED',
					startDate: '2026-01-01',
					endDate: '2026-12-31',
				}),
			}),
		)
	})
})
