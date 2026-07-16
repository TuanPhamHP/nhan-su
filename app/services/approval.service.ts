import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type { ApprovalCountsResponseDto } from '~/types/approval.types';
import type { LeaveRequest, QueryLeaveRequestParams } from '~/types/leave.types';
import type { MakeupRequestResponse, QueryMakeupRequestParams } from '~/types/makeup-attendance.types';
import type { ViolationRequest, QueryViolationRequestParams } from '~/types/violation.types';
import type { OvertimeRequestResponse, QueryOvertimeParams } from '~/types/overtime.types';
import type { BusinessTripResponse, QueryBusinessTripsParams } from '~/types/business-trip.types';
import type { OnlineWorkRequestResponse, QueryOnlineWorkParams } from '~/types/online-work-request.types';

export const useApprovalService = () => {
	const authFetch = useAuthFetch();

	return {
		async listLeaveRequests(params?: QueryLeaveRequestParams): Promise<{ data: LeaveRequest[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<LeaveRequest>>('/v1/approval/leave-requests', { params });
			return { data: res.data, meta: res.meta };
		},

		async getLeaveRequest(id: number): Promise<LeaveRequest> {
			const res = await authFetch<ApiResponse<LeaveRequest>>(`/v1/approval/leave-requests/${id}`);
			return res.data;
		},

		async listMakeupAttendance(params?: QueryMakeupRequestParams): Promise<{ data: MakeupRequestResponse[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<MakeupRequestResponse>>('/v1/approval/makeup-attendance', { params });
			return { data: res.data, meta: res.meta };
		},

		async getMakeupAttendance(id: string): Promise<MakeupRequestResponse> {
			const res = await authFetch<ApiResponse<MakeupRequestResponse>>(`/v1/approval/makeup-attendance/${id}`);
			return res.data;
		},

		async listViolationRequests(params?: QueryViolationRequestParams): Promise<{ data: ViolationRequest[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<ViolationRequest>>('/v1/approval/violation-requests', { params });
			return { data: res.data, meta: res.meta };
		},

		async getViolationRequest(id: number): Promise<ViolationRequest> {
			const res = await authFetch<ApiResponse<ViolationRequest>>(`/v1/approval/violation-requests/${id}`);
			return res.data;
		},

		async listOvertimeRequests(params?: QueryOvertimeParams): Promise<{ data: OvertimeRequestResponse[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<OvertimeRequestResponse>>('/v1/approval/overtime-requests', { params });
			return { data: res.data, meta: res.meta };
		},

		async getOvertimeRequest(id: number): Promise<OvertimeRequestResponse> {
			const res = await authFetch<ApiResponse<OvertimeRequestResponse>>(`/v1/approval/overtime-requests/${id}`);
			return res.data;
		},

		async listBusinessTrips(params?: QueryBusinessTripsParams): Promise<{ data: BusinessTripResponse[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<BusinessTripResponse>>('/v1/approval/business-trips', { params });
			return { data: res.data, meta: res.meta };
		},

		async getBusinessTrip(id: number): Promise<BusinessTripResponse> {
			const res = await authFetch<ApiResponse<BusinessTripResponse>>(`/v1/approval/business-trips/${id}`);
			return res.data;
		},

		async listOnlineWorkRequests(params?: QueryOnlineWorkParams): Promise<{ data: OnlineWorkRequestResponse[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<OnlineWorkRequestResponse>>('/v1/approval/online-work-requests', { params });
			return { data: res.data, meta: res.meta };
		},

		async getOnlineWorkRequest(id: number): Promise<OnlineWorkRequestResponse> {
			const res = await authFetch<ApiResponse<OnlineWorkRequestResponse>>(`/v1/approval/online-work-requests/${id}`);
			return res.data;
		},

		async getCounts(): Promise<ApprovalCountsResponseDto> {
			const res = await authFetch<ApiResponse<ApprovalCountsResponseDto>>('/v1/approval/counts');
			return res.data;
		},
	};
};
