<script setup lang="ts">
	import EmployeePicker from '~/components/modules/general-request/EmployeePicker.vue';
	import { pickText } from '~/utils/general-request.utils';
	import type { FlowPreviewStep } from '~/types/general-request.types';

	/**
	 * Xem trước chuỗi người duyệt của phiếu đang soạn (UI-02).
	 *
	 * Chuỗi do máy chủ tính, không phải người gửi tự chọn như trước lô 4a: mỗi lần giá trị biểu
	 * mẫu hoặc người được chọn đổi thì trang gọi lại `flow/preview`. Bước bị bỏ qua vẫn hiện,
	 * mờ đi kèm câu `basis` nói vì sao — để người gửi hiểu tại sao phiếu 80 triệu không cần giám
	 * đốc trong khi phiếu 120 triệu thì cần, thay vì tưởng hệ thống quên.
	 *
	 * Bước `needsPick` là bước "người gửi chọn": số người theo `pick.min` và `pick.max`, và khi
	 * `sequential` thì thứ tự chọn chính là thứ tự duyệt nên thẻ tên có số thứ tự.
	 */
	const props = defineProps<{
		steps: FlowPreviewStep[];
		loading: boolean;
		/** Người đã chọn cho từng bước, khoá là `flowStepOrder`. */
		picked: Record<number, number[]>;
		error?: string | null;
	}>();

	const emit = defineEmits<{ 'update:picked': [value: Record<number, number[]>] }>();

	function setPick(flowStepOrder: number, ids: number[]) {
		emit('update:picked', { ...props.picked, [flowStepOrder]: ids });
	}

	/**
	 * Bước nào được hiện ô chọn người.
	 *
	 * Bước "người gửi chọn, duyệt lần lượt" được máy chủ tách thành nhiều bước xem trước, mỗi
	 * người một bước mang tên "… (1/2)", "… (2/2)", nhưng tất cả cùng một `flowStepOrder` và dùng
	 * CHUNG một danh sách người đã chọn. Hiện ô chọn ở từng bước tách sẽ ra hai ô giống nhau, sửa
	 * ô này thì ô kia cũng đổi, nên chỉ hiện ở bước tách đầu tiên.
	 */
	const pickerAt = computed(() => {
		const seen = new Set<number>();
		const show = new Set<number>();
		for (const step of props.steps) {
			if (!step.pick || seen.has(step.flowStepOrder)) continue;
			seen.add(step.flowStepOrder);
			show.add(step.order);
		}
		return show;
	});

	function slaText(hours: number | null): string | null {
		return hours ? `Hạn xử lý ${hours} giờ làm việc` : null;
	}
</script>

<template>
	<section class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h2 class="text-sm font-semibold text-gray-900 dark:text-white">Chuỗi người duyệt</h2>
			<span v-if="loading" class="text-xs text-gray-500 dark:text-gray-400">Đang tính lại…</span>
		</div>
		<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
			Chuỗi này do luồng duyệt của loại phiếu quyết định và tính theo thông tin bạn vừa nhập.
		</p>

		<p v-if="error" class="mt-4 text-sm text-rose-600 dark:text-rose-400">{{ error }}</p>

		<div v-else-if="loading && !steps.length" class="mt-4 space-y-2">
			<div v-for="i in 2" :key="i" class="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
		</div>

		<p v-else-if="!steps.length" class="mt-4 text-sm text-gray-500 dark:text-gray-400">
			Loại phiếu này chưa có bước duyệt nào, nên bạn liên hệ phòng nhân sự để cấu hình luồng duyệt trước khi gửi.
		</p>

		<ol v-else class="mt-4 space-y-3">
			<li
				v-for="step in steps"
				:key="`${step.flowStepOrder}-${step.order}`"
				class="rounded-lg border px-4 py-3"
				:class="
					step.skipped
						? 'border-dashed border-gray-200 bg-gray-50 opacity-70 dark:border-gray-700 dark:bg-gray-800/50'
						: 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
				"
			>
				<div class="flex flex-wrap items-center gap-2">
					<span
						class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
						:class="
							step.skipped
								? 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
								: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
						"
					>
						{{ step.order }}
					</span>
					<p class="text-sm font-medium text-gray-900 dark:text-white">{{ step.name }}</p>
					<span
						v-if="step.skipped"
						class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-300"
					>
						Bỏ qua
					</span>
					<!--
						Bước "người gửi chọn, duyệt lần lượt" được tách mỗi người một bước, nên nhãn chế độ
						"Một người đồng ý là đủ" đứng cạnh câu "duyệt lần lượt" đọc vào thấy mâu thuẫn. Bước
						chỉ có một người thì không cần nói chế độ.
					-->
					<span v-else-if="step.approvers.length > 1" class="text-xs text-gray-500 dark:text-gray-400">
						{{ step.modeLabel }}
					</span>
				</div>

				<p v-if="step.basis" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ step.basis }}</p>
				<p v-if="slaText(step.slaHours)" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
					{{ slaText(step.slaHours) }}
				</p>

				<p v-if="step.approvers.length" class="mt-1.5 text-sm text-gray-700 dark:text-gray-200">
					{{ step.approvers.map(a => `${a.fullName} (${a.roleLabel})`).join(', ') }}
				</p>

				<div v-if="step.pick && pickerAt.has(step.order)" class="mt-2.5">
					<EmployeePicker
						:model-value="picked[step.flowStepOrder] ?? []"
						:people="step.candidates.map(c => ({ id: c.id, fullName: c.fullName, hint: c.departmentName ?? c.roleLabel }))"
						:max="step.pick.max"
						:ordered="step.pick.sequential"
						label="Người duyệt bạn chọn"
						:hint="pickText(step.pick)"
						@update:model-value="ids => setPick(step.flowStepOrder, ids)"
					/>
				</div>
			</li>
		</ol>
	</section>
</template>
