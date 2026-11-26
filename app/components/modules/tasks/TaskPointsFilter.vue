<script setup lang="ts">
	import {
		POINTS_FILTER_PRESETS,
		parsePointsFilter,
		pointsFilterLabel,
		pointsFilterParam,
		pointsRangeOf,
		pointsRangeParam,
	} from '~/utils/tasks.utils';

	/**
	 * Ô lọc điểm. Người mới gõ hai ô "Từ … đến … điểm" hoặc bấm một gợi ý; người quen mở Nâng cao để gõ
	 * kiểu JQL `>=3`, `>=2,<=5`, `=0`… (các điều kiện cách dấu phẩy, ghép bằng VÀ). Việc chưa có điểm tính
	 * là 0, nên `=0` ra những việc chưa chấm điểm để rà soát. Giá trị chỉ đổi khi bấm Áp dụng hoặc Enter;
	 * gõ sai thì báo ngay tại ô, không gửi lên máy chủ.
	 */
	const model = defineModel<string>({ required: true });

	const { open, root, alignEnd, toggle, close } = usePopover();
	const draft = ref(model.value);
	const fromDraft = ref('');
	const toDraft = ref('');
	const advanced = ref(false);
	const fromRef = ref<HTMLInputElement | null>(null);
	const inputRef = ref<HTMLInputElement | null>(null);

	const conditions = computed(() => parsePointsFilter(model.value) ?? []);
	const buttonText = computed(() => (conditions.value.length ? pointsFilterLabel(conditions.value) : 'Mọi điểm'));
	const draftError = computed(() =>
		parsePointsFilter(draft.value) === null ? 'Dùng =, !=, >, >=, <, <= kèm số, ví dụ >=3 hoặc >=2,<=5.' : '',
	);

	/** Số trong ô Từ, Đến: trống là không giới hạn; khác số nguyên từ 0 đến 999 thì `NaN`. */
	function rangeNumber(raw: string): number | null {
		const s = raw.trim();
		if (!s) return null;
		return /^\d{1,3}$/.test(s) ? Number(s) : Number.NaN;
	}
	const rangeError = computed(() => {
		const from = rangeNumber(fromDraft.value);
		const to = rangeNumber(toDraft.value);
		if (Number.isNaN(from) || Number.isNaN(to)) return 'Điểm là số nguyên từ 0 trở lên.';
		if (from != null && to != null && from > to) return 'Số ở ô Từ phải nhỏ hơn hoặc bằng ô Đến.';
		return '';
	});

	watch(open, v => {
		if (!v) return;
		draft.value = model.value;
		const range = pointsRangeOf(conditions.value);
		fromDraft.value = range?.from != null ? String(range.from) : '';
		toDraft.value = range?.to != null ? String(range.to) : '';
		// Bộ lọc không viết được bằng hai ô (`!=3`, `>2`) thì mở sẵn Nâng cao để người dùng thấy đúng chữ.
		advanced.value = !range && !!model.value;
		nextTick(() => (advanced.value ? inputRef.value : fromRef.value)?.focus());
	});

	function applyRaw(raw: string) {
		const parsed = parsePointsFilter(raw);
		if (parsed === null) return;
		model.value = pointsFilterParam(parsed);
		close();
	}

	function apply() {
		if (advanced.value) {
			applyRaw(draft.value);
			return;
		}
		if (rangeError.value) return;
		applyRaw(pointsRangeParam({ from: rangeNumber(fromDraft.value), to: rangeNumber(toDraft.value) }));
	}

	function clear() {
		model.value = '';
		close();
	}

	const numberCls =
		'w-16 rounded-md border bg-white px-2 py-1.5 text-center text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-gray-800 dark:text-gray-100';
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
			class="absolute top-full z-40 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900"
			:class="alignEnd ? 'right-0' : 'left-0'"
		>
			<form class="space-y-2" @submit.prevent="apply()">
				<template v-if="!advanced">
					<span class="block text-xs font-medium text-gray-700 dark:text-gray-300">Điểm khối lượng</span>
					<div class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
						<label for="task-points-from">Từ</label>
						<input
							id="task-points-from"
							ref="fromRef"
							v-model="fromDraft"
							type="text"
							inputmode="numeric"
							autocomplete="off"
							placeholder="0"
							:class="[numberCls, rangeError ? 'border-rose-500' : 'border-gray-200 dark:border-gray-700']"
							data-testid="task-points-from"
						/>
						<label for="task-points-to">đến</label>
						<input
							id="task-points-to"
							v-model="toDraft"
							type="text"
							inputmode="numeric"
							autocomplete="off"
							placeholder="8"
							:class="[numberCls, rangeError ? 'border-rose-500' : 'border-gray-200 dark:border-gray-700']"
							data-testid="task-points-to"
						/>
						<span>điểm</span>
					</div>
					<p v-if="rangeError" class="text-xs text-rose-600 dark:text-rose-400">{{ rangeError }}</p>
					<p v-else class="text-xs text-gray-500 dark:text-gray-400">Để trống một ô là không giới hạn phía đó. Việc chưa có điểm tính là 0.</p>
				</template>
				<template v-else>
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
				</template>
				<div class="flex flex-wrap gap-1.5">
					<button
						v-for="p in POINTS_FILTER_PRESETS"
						:key="p.value"
						type="button"
						class="rounded-md border px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
						:class="model === p.value ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'"
						@click="applyRaw(p.value)"
					>
						{{ p.label }}
					</button>
				</div>
				<div class="flex items-center justify-between gap-2 pt-1">
					<button
						type="button"
						class="text-xs font-medium text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-brand-400"
						:aria-expanded="advanced"
						data-testid="task-points-advanced"
						@click="advanced = !advanced"
					>
						{{ advanced ? 'Dùng hai ô Từ, Đến' : 'Nâng cao' }}
					</button>
					<div class="flex items-center gap-2">
						<CommonAppButton v-if="model" variant="ghost" size="sm" @click="clear">Bỏ lọc</CommonAppButton>
						<CommonAppButton type="submit" size="sm" :disabled="advanced ? !!draftError : !!rangeError" data-testid="task-points-apply">Áp dụng</CommonAppButton>
					</div>
				</div>
			</form>
		</div>
	</div>
</template>
