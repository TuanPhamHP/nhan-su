<script setup lang="ts">
	import { useOfficeService } from '~/services/office.service';
	import { officeErrorMessage } from '~/utils/office.utils';
	import type { SupplyRequest } from '~/types/office.types';

	/**
	 * Bấm Đã nhận cho một phiếu đã cấp.
	 *
	 * Số nhận mặc định bằng số đã chốt, nên người nhận đủ thì chỉ bấm một nút. Nhận thiếu thì sửa
	 * số ở dòng đó và ghi lại thiếu bao nhiêu, vì báo cáo chi phí tính theo SỐ THỰC NHẬN.
	 */
	const props = defineProps<{ request: SupplyRequest }>();

	const emit = defineEmits<{
		received: [request: SupplyRequest];
		close: [];
	}>();

	const toast = useToast();
	const service = useOfficeService();

	const saving = ref(false);
	const qty = reactive<Record<number, number | undefined>>({});
	const note = reactive<Record<number, string>>({});
	const errors = reactive<Record<number, string>>({});

	/** Dòng bị chốt 0 thì không cấp gì, nên không cần ô nhận. */
	const lines = computed(() => props.request.lines.filter(line => (line.finalQty ?? 0) > 0));

	onMounted(() => {
		for (const line of lines.value) {
			qty[line.id] = line.finalQty ?? 0;
			note[line.id] = line.receivedNote ?? '';
		}
	});

	useEscapeKey(
		() => emit('close'),
		() => !saving.value,
	);

	function validate(): boolean {
		let ok = true;
		for (const line of lines.value) {
			delete errors[line.id];
			const value = qty[line.id];
			const max = line.finalQty ?? 0;
			if (value == null) {
				errors[line.id] = 'Bạn nhập số thực nhận của dòng này.';
				ok = false;
			} else if (value > max) {
				errors[line.id] = `Số nhận không được lớn hơn số đã chốt là ${max}.`;
				ok = false;
			}
		}
		return ok;
	}

	async function submit() {
		if (saving.value) return;
		if (!validate()) return;
		saving.value = true;
		try {
			const updated = await service.receiveRequest(props.request.id, {
				lines: lines.value.map(line => ({
					lineId: line.id,
					receivedQty: qty[line.id] as number,
					receivedNote: note[line.id]?.trim() || undefined,
				})),
			});
			toast.success('Đã ghi nhận hàng cho phiếu này.');
			emit('received', updated);
		} catch (e) {
			toast.error(officeErrorMessage(e, 'Chưa ghi được đã nhận. Bạn thử lại sau ít phút.'));
		} finally {
			saving.value = false;
		}
	}

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-4"
			role="dialog"
			aria-modal="true"
			aria-label="Ghi đã nhận văn phòng phẩm"
		>
			<div class="my-4 w-full max-w-3xl rounded-2xl bg-white shadow-xl sm:my-8 dark:bg-gray-900">
				<div class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Xác nhận đã nhận hàng</h2>
						<p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
							{{ request.period.title }} · phòng {{ request.department.name }}. Số nhận để sẵn bằng số đã chốt, bạn
							chỉ sửa những dòng nhận thiếu.
						</p>
					</div>
					<button
						type="button"
						class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:h-8 sm:w-8 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng hộp xác nhận đã nhận"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form class="space-y-4 p-4 sm:p-6" @submit.prevent="submit">
					<!--
						Điện thoại: mỗi mặt hàng một khối dọc, không phải một hàng của bảng.
						Bảng bốn cột trong hộp rộng 390 pixel thì ô Thực nhận co lại còn vài chữ số và trông như
						ô trống, còn cột Ghi chú nằm hẳn ngoài màn hình, nên người nhận hàng không có chỗ ghi là
						thiếu mấy cái.
					-->
					<div class="space-y-3 sm:hidden">
						<div v-for="line in lines" :key="line.id" class="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
							<p class="font-medium text-gray-900 dark:text-white">{{ line.name }}</p>
							<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
								Đơn vị {{ line.unit || '—' }} · HCNS đã chốt {{ line.finalQty }}
							</p>
							<div class="mt-3 space-y-1">
								<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
									Thực nhận <span class="text-red-500">*</span>
								</label>
								<UiNumberInput
									v-model="qty[line.id]"
									:min="0"
									:max="line.finalQty ?? 0"
									:error="errors[line.id]"
									:aria-label="`Số thực nhận của ${line.name}`"
								/>
							</div>
							<div class="mt-3 space-y-1">
								<label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Ghi chú</label>
								<input
									v-model="note[line.id]"
									type="text"
									maxlength="500"
									:class="inputCls"
									placeholder="VD: thiếu 2 tập, kho hẹn tuần sau"
								/>
							</div>
						</div>
					</div>

					<div class="hidden overflow-x-auto sm:block">
						<table class="w-full min-w-[560px] text-sm">
							<thead>
								<tr class="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
									<th class="px-2 py-2">Mặt hàng</th>
									<th class="px-2 py-2 text-right">Đã chốt</th>
									<th class="px-2 py-2 text-right">Thực nhận</th>
									<th class="px-2 py-2">Ghi chú</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
								<tr v-for="line in lines" :key="line.id">
									<td class="px-2 py-2">
										<p class="text-gray-900 dark:text-white">{{ line.name }}</p>
										<p class="text-xs text-gray-500 dark:text-gray-400">{{ line.unit || '—' }}</p>
									</td>
									<td class="px-2 py-2 text-right text-gray-700 dark:text-gray-200">{{ line.finalQty }}</td>
									<td class="px-2 py-2 text-right">
										<UiNumberInput v-model="qty[line.id]" :min="0" :max="line.finalQty ?? 0" :input-class="`${inputCls} text-right`" />
										<p v-if="errors[line.id]" class="mt-1 text-left text-xs text-red-500">{{ errors[line.id] }}</p>
									</td>
									<td class="px-2 py-2">
										<input v-model="note[line.id]" type="text" maxlength="500" :class="inputCls" placeholder="VD: thiếu 2" />
									</td>
								</tr>
							</tbody>
						</table>
					</div>

					<p v-if="!lines.length" class="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
						Phiếu này không có dòng nào được cấp.
					</p>

					<div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
						<CommonAppButton variant="secondary" type="button" class="min-h-11 sm:min-h-0" @click="emit('close')">
							Đóng
						</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" class="min-h-11 sm:min-h-0" :disabled="!lines.length" :loading="saving">
							Xác nhận đã nhận
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
