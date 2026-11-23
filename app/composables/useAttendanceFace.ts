import { useAttendanceFaceService } from '~/services/attendance-face.service';
import type {
	EmployeeFaceResponseDto,
	FaceSettingsResponseDto,
	FaceStatusItemDto,
	MyFaceStatusResponseDto,
} from '~/types/attendance.types';

/**
 * Chấm công bằng khuôn mặt cho các component: công tắc công ty, khuôn mặt của tôi, phần HR.
 *
 * Mỗi lần gọi composable có trạng thái riêng, nên thẻ hồ sơ và khối ở chi tiết nhân viên không
 * dùng chung `loading` với nhau. Lỗi ném thẳng lên để nơi gọi hiện `message` của máy chủ.
 */
export function useAttendanceFace() {
	const service = useAttendanceFaceService();

	const loading = ref(false);
	const saving = ref(false);

	async function track<T>(flag: Ref<boolean>, run: () => Promise<T>): Promise<T> {
		flag.value = true;
		try {
			return await run();
		} finally {
			flag.value = false;
		}
	}

	return {
		loading,
		saving,
		getSettings: (): Promise<FaceSettingsResponseDto> => track(loading, () => service.getSettings()),
		updateSettings: (enabled: boolean): Promise<FaceSettingsResponseDto> =>
			track(saving, () => service.updateSettings(enabled)),
		getMine: (): Promise<MyFaceStatusResponseDto> => track(loading, () => service.getMine()),
		registerMine: (photo: File): Promise<MyFaceStatusResponseDto> => track(saving, () => service.registerMine(photo)),
		listEmployees: (): Promise<FaceStatusItemDto[]> => track(loading, () => service.listEmployees()),
		getEmployee: (employeeId: number): Promise<EmployeeFaceResponseDto> =>
			track(loading, () => service.getEmployee(employeeId)),
		resetEmployee: (employeeId: number): Promise<void> => track(saving, () => service.resetEmployee(employeeId)),
	};
}
