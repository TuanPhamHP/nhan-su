<script setup lang="ts">
	/**
	 * Vùng chọn file kéo-thả dùng chung.
	 *
	 * Thay cho `<input type="file">` trần: input native hiển thị khác nhau trên từng
	 * trình duyệt, không kéo thả được, không xem được tên và dung lượng file đã chọn,
	 * và không có chỗ báo lỗi. Component này nhận file qua `v-model` và tự kiểm định
	 * dạng + dung lượng TRƯỚC khi phát ra ngoài, nên nơi gọi chỉ việc gửi đi.
	 */
	const props = withDefaults(
		defineProps<{
			/** File đang chọn. Mảng khi `multiple`. */
			modelValue: File | File[] | null;
			/** Như thuộc tính `accept` của input: ".xlsx,.pdf" hoặc "image/*". */
			accept?: string;
			/** Trần dung lượng mỗi file, tính bằng MB. */
			maxSizeMb?: number;
			multiple?: boolean;
			disabled?: boolean;
			/** Dòng gợi ý dưới nhãn. Bỏ trống thì tự dựng từ `accept` và `maxSizeMb`. */
			hint?: string;
			/** Lỗi từ bên ngoài (VD server trả về), hiện cùng chỗ với lỗi tự kiểm. */
			error?: string | null;
		}>(),
		{
			accept: '',
			maxSizeMb: 0,
			multiple: false,
			disabled: false,
			hint: '',
			error: null,
		},
	);

	const emit = defineEmits<{
		'update:modelValue': [value: File | File[] | null];
		/** Phát khi file bị từ chối, để nơi gọi muốn ghi log hay đếm thì có chỗ bám. */
		reject: [reason: string];
	}>();

	const inputRef = ref<HTMLInputElement | null>(null);
	const dragging = ref(false);
	const localError = ref<string | null>(null);
	/**
	 * `dragenter`/`dragleave` bắn cả khi con trỏ đi qua phần tử con, nên đếm tầng thay vì
	 * bật tắt theo từng sự kiện — không đếm thì viền nhấp nháy lúc rê qua icon và chữ.
	 */
	let dragDepth = 0;

	const files = computed<File[]>(() => {
		if (!props.modelValue) return [];
		return Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue];
	});

	const shownError = computed(() => props.error ?? localError.value);

	const autoHint = computed(() => {
		if (props.hint) return props.hint;
		const parts: string[] = [];
		if (props.accept) {
			const exts = props.accept
				.split(',')
				.map(s => s.trim())
				.filter(s => s.startsWith('.'))
				.map(s => s.slice(1).toUpperCase());
			if (exts.length) parts.push(exts.join(', '));
		}
		if (props.maxSizeMb > 0) parts.push(`tối đa ${props.maxSizeMb} MB`);
		return parts.join(' · ');
	});

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	/** Khớp một file với `accept`: theo đuôi (".xlsx") hoặc theo kiểu MIME ("image/*"). */
	function matchesAccept(file: File): boolean {
		if (!props.accept) return true;
		const rules = props.accept.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
		const name = file.name.toLowerCase();
		const type = file.type.toLowerCase();
		return rules.some(rule => {
			if (rule.startsWith('.')) return name.endsWith(rule);
			if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
			return type === rule;
		});
	}

	function validate(file: File): string | null {
		if (!matchesAccept(file)) {
			return autoHint.value
				? `"${file.name}" không đúng định dạng. Chỉ nhận ${autoHint.value}.`
				: `"${file.name}" không đúng định dạng.`;
		}
		if (props.maxSizeMb > 0 && file.size > props.maxSizeMb * 1024 * 1024) {
			return `"${file.name}" nặng ${formatSize(file.size)}, vượt mức ${props.maxSizeMb} MB.`;
		}
		return null;
	}

	function takeFiles(list: FileList | File[] | null) {
		if (!list || !list.length) return;
		localError.value = null;
		const incoming = Array.from(list);

		if (!props.multiple && incoming.length > 1) {
			localError.value = 'Chỉ chọn được một file.';
			emit('reject', localError.value);
			return;
		}

		const good: File[] = [];
		for (const f of incoming) {
			const err = validate(f);
			if (err) {
				localError.value = err;
				emit('reject', err);
				return;
			}
			good.push(f);
		}

		emit('update:modelValue', props.multiple ? [...files.value, ...good] : (good[0] ?? null));
	}

	function onInputChange(e: Event) {
		const input = e.target as HTMLInputElement;
		takeFiles(input.files);
		// Cho phép chọn lại ĐÚNG file vừa xoá: không reset thì `change` không bắn lần hai.
		input.value = '';
	}

	function onDrop(e: DragEvent) {
		dragDepth = 0;
		dragging.value = false;
		if (props.disabled) return;
		takeFiles(e.dataTransfer?.files ?? null);
	}

	function onDragEnter() {
		if (props.disabled) return;
		dragDepth += 1;
		dragging.value = true;
	}

	function onDragLeave() {
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) dragging.value = false;
	}

	function openPicker() {
		if (props.disabled) return;
		inputRef.value?.click();
	}

	function removeAt(index: number) {
		if (props.disabled) return;
		localError.value = null;
		if (!props.multiple) {
			emit('update:modelValue', null);
			return;
		}
		const next = files.value.filter((_, i) => i !== index);
		emit('update:modelValue', next);
	}

	/** Icon theo đuôi file — chỉ để nhận ra nhanh, không mang nghĩa gì thêm. */
	function fileTone(file: File): string {
		const n = file.name.toLowerCase();
		if (n.endsWith('.xlsx') || n.endsWith('.xls') || n.endsWith('.csv')) {
			return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
		}
		if (n.endsWith('.pdf')) return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
		if (/\.(png|jpe?g|heic|webp|gif)$/.test(n)) {
			return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
		}
		return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
	}

	function fileExt(file: File): string {
		const dot = file.name.lastIndexOf('.');
		return dot > 0 ? file.name.slice(dot + 1).toUpperCase().slice(0, 4) : 'FILE';
	}
</script>

<template>
	<div class="space-y-2">
		<!-- Vùng thả. Ẩn đi khi đã chọn đủ file ở chế độ một file. -->
		<div
			v-if="multiple || !files.length"
			role="button"
			:tabindex="disabled ? -1 : 0"
			:aria-disabled="disabled"
			:aria-label="`Chọn file${autoHint ? ` (${autoHint})` : ''}`"
			class="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
			:class="[
				disabled
					? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-800/50'
					: 'cursor-pointer',
				!disabled && dragging
					? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/20'
					: !disabled && shownError
						? 'border-red-300 hover:border-red-400 dark:border-red-700'
						: !disabled
							? 'border-gray-300 hover:border-brand-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800/60'
							: '',
			]"
			@click="openPicker"
			@keydown.enter.prevent="openPicker"
			@keydown.space.prevent="openPicker"
			@dragenter.prevent="onDragEnter"
			@dragover.prevent
			@dragleave.prevent="onDragLeave"
			@drop.prevent="onDrop"
		>
			<span
				class="flex h-12 w-12 items-center justify-center rounded-full transition-colors"
				:class="dragging ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300' : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'"
			>
				<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
					/>
				</svg>
			</span>

			<p class="text-sm font-medium text-gray-700 dark:text-gray-200">
				<template v-if="dragging">Thả file vào đây</template>
				<template v-else>
					Kéo thả file vào đây hoặc
					<span class="text-brand-600 underline-offset-2 hover:underline dark:text-brand-400">bấm để chọn</span>
				</template>
			</p>
			<p v-if="autoHint" class="text-xs text-gray-400 dark:text-gray-500">{{ autoHint }}</p>
		</div>

		<!--
			Input nằm NGOÀI vùng thả, cố ý: ở chế độ một file, vùng thả bị `v-if` ẩn đi sau khi
			chọn file. Để input bên trong thì `inputRef` thành null và nút "Chọn file khác" bấm
			không ra gì, người dùng buộc phải xoá file rồi chọn lại.
		-->
		<input
			ref="inputRef"
			type="file"
			class="sr-only"
			:accept="accept || undefined"
			:multiple="multiple"
			:disabled="disabled"
			tabindex="-1"
			@change="onInputChange"
		/>

		<!-- File đã chọn -->
		<ul v-if="files.length" class="space-y-2">
			<li
				v-for="(file, i) in files"
				:key="`${file.name}-${file.size}-${i}`"
				class="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
			>
				<span
					class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
					:class="fileTone(file)"
				>
					{{ fileExt(file) }}
				</span>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{{ file.name }}</p>
					<p class="text-xs text-gray-500 dark:text-gray-400">{{ formatSize(file.size) }}</p>
				</div>
				<button
					type="button"
					class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-rose-500 disabled:opacity-50 dark:hover:bg-gray-700"
					:disabled="disabled"
					:aria-label="`Bỏ file ${file.name}`"
					@click.stop="removeAt(i)"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</li>
		</ul>

		<!-- Chọn lại ở chế độ một file -->
		<button
			v-if="!multiple && files.length && !disabled"
			type="button"
			class="text-xs text-brand-600 hover:underline dark:text-brand-400"
			@click="openPicker"
		>
			Chọn file khác
		</button>

		<p v-if="shownError" class="text-xs text-red-500">{{ shownError }}</p>
	</div>
</template>
