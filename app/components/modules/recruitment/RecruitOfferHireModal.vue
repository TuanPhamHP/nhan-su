<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { recruitErrorCode, recruitErrorMessage } from '~/utils/recruitment.utils';
	import { formatDate } from '~/utils/date';
	import type { RecruitmentOffer } from '~/types/recruitment.types';

	/**
	 * Chuyển ứng viên đã đồng ý thành nhân viên.
	 *
	 * Mặc định tạo nhân viên mới. Ô "nối với nhân viên đã có" dùng cho hai trường hợp: nhân
	 * sự đã tạo tay hồ sơ nhân viên, hoặc lần bấm trước đã tạo xong nhân viên nhưng bước nối
	 * bị lỗi — khi đó gọi lại kèm id nhân viên vừa tạo thay vì tạo trùng một người nữa.
	 */
	const props = defineProps<{ offer: RecruitmentOffer }>();

	const emit = defineEmits<{ hired: [offer: RecruitmentOffer]; close: [] }>();

	const service = useRecruitmentService();
	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);

	const linkExisting = ref(false);
	const existingEmployeeId = ref<number | undefined>(undefined);
	const submitting = ref(false);
	const error = ref<string | null>(null);

	onMounted(() => {
		directoryStore.load().catch(() => {
			/* ô chọn nhân viên rỗng, vẫn tạo mới được */
		});
	});

	const employeeOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Chọn nhân viên...' },
		...employees.value.map(e => ({
			value: e.id as number | undefined,
			label: `${e.fullName} (${e.employeeCode})`,
		})),
	]);

	const noEmail = computed(() => !props.offer.candidate.email);

	/**
	 * Lỗi mà đường ra là nối với nhân viên đã có.
	 *
	 * `RECRUIT_HIRE_CONFLICT` nghĩa là mã hoặc email trùng một nhân viên khác;
	 * `RECRUIT_EMPLOYEE_ALREADY_LINKED` và `EMPLOYEE_ACCOUNT_IN_COMPANY` cũng vậy. Trong cả
	 * ba trường hợp, bật sẵn ô "nối với nhân viên đã có" đỡ người dùng phải tự đoán.
	 */
	const LINK_INSTEAD_CODES = [
		'RECRUIT_HIRE_CONFLICT',
		'EMPLOYEE_ACCOUNT_IN_COMPANY',
		'CONFLICT',
	];
	const suggestLinking = ref(false);

	async function hire() {
		if (linkExisting.value && existingEmployeeId.value == null) {
			error.value = 'Chọn nhân viên cần nối';
			return;
		}
		submitting.value = true;
		error.value = null;
		try {
			const saved = await service.hireFromOffer(
				props.offer.id,
				linkExisting.value ? existingEmployeeId.value : undefined,
			);
			emit('hired', saved);
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Tạo hồ sơ nhân viên thất bại');
			const code = recruitErrorCode(e);
			if (code && LINK_INSTEAD_CODES.includes(code) && !linkExisting.value) {
				// Tạo mới không xong vì đụng một nhân viên đã có: mở sẵn đường nối thay vì
				// để người dùng bấm lại y hệt và nhận cùng lỗi.
				suggestLinking.value = true;
				linkExisting.value = true;
			}
		} finally {
			submitting.value = false;
		}
	}
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Tạo hồ sơ nhân viên</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							{{ offer.candidate.fullName }} · <span class="font-mono">{{ offer.code }}</span>
						</p>
					</div>
					<button
						type="button"
						class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form class="space-y-4 p-6" @submit.prevent="hire">
					<div class="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
						<p>Hồ sơ nhân viên sẽ lấy:</p>
						<ul class="mt-1 space-y-0.5 text-xs">
							<li>Họ tên, liên hệ và thông tin cá nhân từ hồ sơ ứng viên.</li>
							<li>Phòng {{ offer.department.name }}, vị trí {{ offer.position.name }} từ offer.</li>
							<li>Ngày vào làm {{ formatDate(offer.startDate) }}, vai trò Nhân viên.</li>
							<li>CV mới nhất được đính vào giấy tờ nhân viên.</li>
						</ul>
						<p class="mt-2 text-xs">
							Lương và ngày kết thúc thử việc không được ghi sang, vì hồ sơ nhân viên không có hai
							trường đó. Hãy tạo hợp đồng thử việc ở module Hợp đồng.
						</p>
					</div>

					<p
						v-if="noEmail && !linkExisting"
						class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
					>
						Ứng viên chưa có email nên không tạo được nhân viên mới. Hãy bổ sung email ở hồ sơ ứng
						viên, hoặc nối với một nhân viên đã có.
					</p>

					<label class="flex items-start gap-2">
						<input
							v-model="linkExisting"
							type="checkbox"
							class="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
						/>
						<span class="text-sm text-gray-700 dark:text-gray-300">
							Nối với một nhân viên đã có
							<span class="block text-xs text-gray-500 dark:text-gray-400">
								Dùng khi bạn đã tạo tay hồ sơ nhân viên, hoặc lần bấm trước tạo xong nhân viên nhưng
								báo lỗi ở bước sau.
							</span>
						</span>
					</label>

					<div v-if="linkExisting" class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Nhân viên <span class="text-red-500">*</span>
						</label>
						<UiSelect v-model="existingEmployeeId" :options="employeeOptions" />
					</div>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>

					<p
						v-if="suggestLinking"
						class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
					>
						Hệ thống đã bật sẵn ô nối với nhân viên có sẵn bên trên. Hãy chọn đúng người rồi bấm lại;
						nếu người đó chưa có trong danh sách thì tạo hồ sơ nhân viên ở module Nhân viên trước.
					</p>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton
							variant="primary"
							type="submit"
							:loading="submitting"
							:disabled="noEmail && !linkExisting"
						>
							Tạo hồ sơ nhân viên
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
