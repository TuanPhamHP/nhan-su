<script setup lang="ts">
	import { POINTS_FILTER_PRESETS, parsePointsFilter, pointsFilterLabel, pointsFilterParam } from '~/utils/tasks.utils';

	/**
	 * Ô lọc điểm kiểu JQL: gõ `>=3`, `>=2,<=5`, `=0`… (các điều kiện cách dấu phẩy, ghép bằng VÀ) hoặc bấm
	 * một gợi ý. Việc chưa có điểm tính là 0, nên `=0` ra những việc chưa chấm điểm để rà soát. Giá trị chỉ
	 * đổi khi bấm Áp dụng hoặc Enter; gõ sai cú pháp thì báo ngay tại ô, không gửi lên máy chủ.
	 */
	const model = defineModel<string>({ required: true });

	const { open, root, alignEnd, toggle, close } = usePopover();
	const draft = ref(model.value);
	const inputRef = ref<HTMLInputElement | null>(null);

	const conditions = computed(() => parsePointsFilter(model.value) ?? []);
	const buttonText = computed(() => (conditions.value.length ? pointsFilterLabel(conditions.value) : 'Mọi điểm'));
	const draftError = computed(() =>
		parsePointsFilter(draft.value) === null ? 'Dùng =, !=, >, >=, <, <= kèm số, ví dụ >=3 hoặc >=2,<=5.' : '',
	);

	watch(open, v => {
		if (!v) return;
		draft.value = model.value;
		nextTick(() => inputRef.value?.focus());
	});

	function apply(raw = draft.value) {
		const parsed = parsePointsFilter(raw);
		if (parsed === null) return;
		model.value = pointsFilterParam(parsed);
		close();
	}

	function clear() {
		model.value = '';
		close();
	}
</script>

<template>
	<div ref="root" class="relative" data-testid="task-points-filter">
		<button
			type="button"
			data-popover-trigger
			:aria-expanded="open"
			aria-haspopup="dialog"
			class="flex h-[38px] w-full items-center gap-1.5 rounded-lg border px-3 text-left text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
			:class="conditions.length ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'"
			@click="toggle"
		>
			<Icon name="heroicons:adjustments-horizontal" class="h-4 w-4 shrink-0" aria-hidden="true" />
			<span class="truncate">{{ buttonText }}</span>
		</button>
		<div
			v-if="open"
			role="dialog"
			aria-label="Lọc theo điểm"
			class="absolute top-full z-40 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900"
			:class="alignEnd ? 'right-0' : 'left-0'"
		>
			<form class="space-y-2" @submit.prevent="apply()">
				<label for="task-points-filter-input" class="block text-xs font-medium text-gray-700 dark:text-gray-300">Điều kiện điểm</label>
				<input
					id="task-points-filter-input"
					ref="inputRef"
					v-model="draft"
					type="text"
					inputmode="text"
					autocomplete="off"
					spellcheck="false"
					placeholder="VD >=3 hoặc >=2,<=5"
					:aria-invalid="!!draftError"
					aria-describedby="task-points-filter-help"
					class="w-full rounded-md border bg-white px-2 py-1.5 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100"
					:class="draftError ? 'border-rose-500' : 'border-gray-200 dark:border-gray-700'"
				/>
				<p v-if="draftError" id="task-points-filter-help" class="text-xs text-rose-600 dark:text-rose-400">{{ draftError }}</p>
				<p v-else id="task-points-filter-help" class="text-xs text-gray-500 dark:text-gray-400">
					Nhiều điều kiện cách nhau dấu phẩy. Việc chưa có điểm tính là 0.
				</p>
				<div class="flex flex-wrap gap-1.5">
					<button
						v-for="p in POINTS_FILTER_PRESETS"
						:key="p.value"
						type="button"
						class="rounded-md border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
						:class="model === p.value ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'"
						@click="apply(p.value)"
					>
						{{ p.label }} <span class="font-mono text-gray-400">{{ p.value }}</span>
					</button>
				</div>
				<div class="flex items-center justify-end gap-2 pt-1">
					<CommonAppButton v-if="model" variant="ghost" size="sm" @click="clear">Bỏ lọc</CommonAppButton>
					<CommonAppButton type="submit" size="sm" :disabled="!!draftError">Áp dụng</CommonAppButton>
				</div>
			</form>
		</div>
	</div>
</template>
