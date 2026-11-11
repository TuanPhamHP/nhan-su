<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { recruitErrorMessage } from '~/utils/recruitment.utils';
	import type { RecruitmentJob } from '~/types/recruitment.types';

	/**
	 * Hội đồng của một tin.
	 *
	 * Route là `PUT` thay TOÀN BỘ: ai không có trong danh sách gửi lên sẽ bị gỡ, kể cả
	 * trưởng phòng mà hệ thống tự thêm lúc tạo tin và người phỏng vấn tự thêm khi đặt lịch.
	 * Vì vậy form luôn mở với đủ danh sách hiện có và gửi lại nguyên danh sách sau khi sửa.
	 *
	 * Hai cờ quyết định thứ thành viên thấy và nhận:
	 * - `canViewOffer`: xem lương mong muốn và offer của tin này.
	 * - `notifyNewApplications`: nhận thông báo khi có hồ sơ mới.
	 */
	const props = defineProps<{ job: RecruitmentJob }>();

	const emit = defineEmits<{ saved: [job: RecruitmentJob]; close: [] }>();

	const service = useRecruitmentService();
	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);

	interface Row {
		employeeId: number;
		fullName: string;
		roleLabel: string;
		canViewOffer: boolean;
		notifyNewApplications: boolean;
	}

	const rows = ref<Row[]>(
		props.job.team.map(m => ({
			employeeId: m.employee.id,
			fullName: m.employee.fullName,
			roleLabel: m.roleLabel,
			canViewOffer: m.canViewOffer,
			notifyNewApplications: m.notifyNewApplications,
		})),
	);

	const addId = ref<number | undefined>(undefined);
	const submitting = ref(false);
	const error = ref<string | null>(null);

	onMounted(() => {
		directoryStore.load().catch(() => {
			error.value = 'Không tải được danh sách nhân viên';
		});
	});

	const addOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Thêm thành viên...' },
		...employees.value
			.filter(e => !rows.value.some(r => r.employeeId === e.id))
			.map(e => ({
				value: e.id as number | undefined,
				label: `${e.fullName} (${e.employeeCode})`,
			})),
	]);

	function addMember() {
		if (addId.value == null) return;
		const emp = employees.value.find(e => e.id === addId.value);
		if (!emp) return;
		rows.value.push({
			employeeId: emp.id,
			fullName: emp.fullName,
			roleLabel: emp.role,
			canViewOffer: false,
			notifyNewApplications: false,
		});
		addId.value = undefined;
	}

	function removeMember(employeeId: number) {
		rows.value = rows.value.filter(r => r.employeeId !== employeeId);
	}

	async function save() {
		if (rows.value.length > 50) {
			error.value = 'Hội đồng tối đa 50 người';
			return;
		}
		submitting.value = true;
		error.value = null;
		try {
			const saved = await service.saveJobTeam(props.job.id, {
				members: rows.value.map(r => ({
					employeeId: r.employeeId,
					canViewOffer: r.canViewOffer,
					notifyNewApplications: r.notifyNewApplications,
				})),
			});
			emit('saved', saved);
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Lưu hội đồng thất bại');
		} finally {
			submitting.value = false;
		}
	}
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Hội đồng tuyển dụng</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ job.code }} · {{ job.title }}</p>
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

				<div class="max-h-[70vh] space-y-4 overflow-y-auto p-6">
					<p class="text-sm text-gray-600 dark:text-gray-300">
						Thành viên hội đồng xem được mọi hồ sơ của tin này và mở được CV, kể cả khi họ mang vai trò
						Nhân viên. Người bị gỡ khỏi đây mất quyền xem ngay, nên hãy kiểm lại danh sách trước khi lưu.
					</p>

					<div class="flex flex-wrap items-end gap-2">
						<div class="min-w-[16rem] flex-1">
							<UiSelect v-model="addId" :options="addOptions" />
						</div>
						<CommonAppButton variant="outline" size="sm" :disabled="addId == null" @click="addMember">
							Thêm
						</CommonAppButton>
					</div>

					<div v-if="!rows.length" class="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
						Hội đồng đang trống. Người được giao phỏng vấn sẽ tự được thêm khi bạn đặt lịch.
					</div>

					<div v-else class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-gray-200 text-left dark:border-gray-700">
									<th class="py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Thành viên</th>
									<th class="py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Xem offer</th>
									<th class="py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Báo hồ sơ mới</th>
									<th class="py-2" />
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
								<tr v-for="row in rows" :key="row.employeeId">
									<td class="py-2.5">
										<p class="font-medium text-gray-900 dark:text-white">{{ row.fullName }}</p>
										<p class="text-xs text-gray-400">{{ row.roleLabel }}</p>
									</td>
									<td class="py-2.5 text-center">
										<input
											v-model="row.canViewOffer"
											type="checkbox"
											class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
											:aria-label="`Cho ${row.fullName} xem offer`"
										/>
									</td>
									<td class="py-2.5 text-center">
										<input
											v-model="row.notifyNewApplications"
											type="checkbox"
											class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
											:aria-label="`Báo hồ sơ mới cho ${row.fullName}`"
										/>
									</td>
									<td class="py-2.5 text-right">
										<button
											type="button"
											class="text-xs text-rose-600 hover:underline dark:text-rose-400"
											@click="removeMember(row.employeeId)"
										>
											Gỡ
										</button>
									</td>
								</tr>
							</tbody>
						</table>
					</div>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>
				</div>

				<div class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
					<CommonAppButton variant="secondary" @click="emit('close')">Huỷ</CommonAppButton>
					<CommonAppButton variant="primary" :loading="submitting" @click="save">Lưu hội đồng</CommonAppButton>
				</div>
			</div>
		</div>
	</Teleport>
</template>
