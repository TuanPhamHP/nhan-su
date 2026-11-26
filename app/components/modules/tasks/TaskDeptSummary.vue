<script setup lang="ts">
	import { useTasksService } from '~/services/tasks.service';
	import type { TaskPersonLoad } from '~/types/tasks.types';
	import { taskErrorInfo } from '~/utils/tasks.utils';

	/**
	 * Dải tóm tắt theo người ở đầu Việc của phòng (bridge mục 26): mỗi người một thẻ với số Chưa làm, Đang làm,
	 * Chờ nghiệm thu, Quá hạn (tô đỏ) và điểm đang mở. Bấm thẻ thì lọc danh sách theo người đó, bấm số quá hạn
	 * thì lọc thêm việc quá hạn; bấm lại thẻ đang chọn thì bỏ lọc.
	 *
	 * Số do máy chủ đếm (`GET /tasks/department-summary`), không tự cộng từ danh sách đang hiện vì danh sách có
	 * thể đang lọc hoặc mới tải một trang.
	 */
	const props = defineProps<{
		departmentId: number;
		/** Người đang lọc (id dạng chuỗi như trên đường dẫn), để tô thẻ đang chọn. */
		activeAssignee?: string;
		activeOverdue?: boolean;
	}>();
	const emit = defineEmits<{ pick: [employeeId: number | null, overdue: boolean] }>();

	const service = useTasksService();
	const people = ref<TaskPersonLoad[]>([]);
	const loading = ref(true);
	const error = ref('');

	async function load() {
		loading.value = true;
		error.value = '';
		try {
			people.value = (await service.departmentSummary(props.departmentId)).people;
		} catch (err) {
			people.value = [];
			error.value = taskErrorInfo(err, 'Chưa tải được tóm tắt theo người.').message;
		} finally {
			loading.value = false;
		}
	}
	watch(() => props.departmentId, load, { immediate: true });

	function isActive(p: TaskPersonLoad) {
		return props.activeAssignee === String(p.employee.id);
	}
	function pickPerson(p: TaskPersonLoad) {
		emit('pick', isActive(p) && !props.activeOverdue ? null : p.employee.id, false);
	}
	function pickOverdue(p: TaskPersonLoad) {
		emit('pick', isActive(p) && props.activeOverdue ? null : p.employee.id, true);
	}

	defineExpose({ reload: load });
</script>

<template>
	<section aria-label="Tóm tắt theo người" data-testid="dept-summary">
		<div v-if="loading" class="flex gap-2 overflow-hidden" aria-busy="true">
			<div v-for="i in 4" :key="i" class="h-24 w-44 shrink-0 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>
		<p v-else-if="error" class="text-sm text-rose-600 dark:text-rose-400">{{ error }}</p>
		<ul v-else-if="people.length" class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
			<li
				v-for="p in people"
				:key="p.employee.id"
				class="w-44 shrink-0 rounded-xl border bg-white transition-colors dark:bg-gray-900"
				:class="isActive(p) ? 'border-brand-500 ring-1 ring-brand-500' : 'border-gray-200 dark:border-gray-700'"
				:data-testid="`dept-summary-${p.employee.id}`"
			>
				<button
					type="button"
					class="block w-full rounded-t-xl px-3 pt-2.5 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500"
					:aria-pressed="isActive(p) && !activeOverdue"
					:aria-label="`Lọc việc của ${p.employee.fullName}`"
					data-testid="dept-summary-person"
					@click="pickPerson(p)"
				>
					<span class="flex items-center gap-2">
						<CommonAppAvatar :src="p.employee.avatarUrl" :name="p.employee.fullName" size="xs" />
						<span class="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{{ p.employee.fullName }}</span>
					</span>
					<span class="mt-1.5 grid grid-cols-3 gap-1 text-center text-xs text-gray-500 dark:text-gray-400">
						<span><span class="block text-sm font-semibold text-gray-800 dark:text-gray-100">{{ p.todo }}</span>Chưa làm</span>
						<span><span class="block text-sm font-semibold text-gray-800 dark:text-gray-100">{{ p.inProgress }}</span>Đang làm</span>
						<span><span class="block text-sm font-semibold text-gray-800 dark:text-gray-100">{{ p.inReview }}</span>Chờ nghiệm thu</span>
					</span>
				</button>
				<div class="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1.5 text-xs">
					<button
						v-if="p.overdue"
						type="button"
						class="rounded px-1 font-semibold text-rose-600 hover:underline focus:outline-none focus:ring-2 focus:ring-rose-500 dark:text-rose-400"
						:aria-pressed="isActive(p) && activeOverdue"
						data-testid="dept-summary-overdue"
						@click="pickOverdue(p)"
					>
						{{ p.overdue }} quá hạn
					</button>
					<span v-else class="text-gray-400 dark:text-gray-500">Không quá hạn</span>
					<span class="text-gray-500 dark:text-gray-400">{{ p.openPoints }} điểm mở</span>
				</div>
			</li>
		</ul>
	</section>
</template>
