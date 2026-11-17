<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useAssetService } from '~/services/asset.service';
	import type { AssetCategory, AssetStocktake } from '~/types/asset.types';

	/**
	 * Mở một đợt kiểm kê. Bỏ trống cả phòng ban lẫn loại là kiểm toàn công ty.
	 *
	 * Phòng ban ở đây là phòng của lần cấp phát đang mở, nên thiết bị trong kho (chưa cấp phát) chỉ
	 * vào đợt toàn công ty hoặc đợt theo loại; form nói rõ điều này để người mở đợt khỏi bất ngờ.
	 */
	const emit = defineEmits<{
		created: [stocktake: AssetStocktake];
		close: [];
	}>();

	const toast = useToast();
	const service = useAssetService();
	const directoryStore = useDirectoryStore();
	const { departments } = storeToRefs(directoryStore);

	const categories = ref<AssetCategory[]>([]);
	const loadingRefs = ref(true);
	const departmentIds = ref<number[]>([]);
	const categoryIds = ref<number[]>([]);

	onMounted(async () => {
		try {
			const [cats] = await Promise.all([service.findCategories({ kind: 'PHYSICAL' }), directoryStore.load()]);
			categories.value = cats.filter(c => c.isActive);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa tải được phòng ban và loại thiết bị. Bạn đóng hộp rồi mở lại.');
		} finally {
			loadingRefs.value = false;
		}
	});

	const schema = toTypedSchema(
		z.object({
			name: z
				.string({ required_error: 'Bạn đặt tên cho đợt kiểm kê' })
				.trim()
				.min(1, 'Bạn đặt tên cho đợt kiểm kê')
				.max(200, 'Tên đợt tối đa 200 ký tự'),
			note: z.string().max(2000, 'Ghi chú tối đa 2000 ký tự').optional(),
		}),
	);

	const { handleSubmit, defineField, errors, isSubmitting } = useForm({
		validationSchema: schema,
		initialValues: { name: '', note: '' },
	});
	const [name, nameAttrs] = defineField('name');
	const [note, noteAttrs] = defineField('note');

	const toggled = (list: number[], id: number) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
	function toggleDepartment(id: number) {
		departmentIds.value = toggled(departmentIds.value, id);
	}
	function toggleCategory(id: number) {
		categoryIds.value = toggled(categoryIds.value, id);
	}

	const scopePreview = computed(() => {
		const parts: string[] = [];
		const depts = departments.value.filter(d => departmentIds.value.includes(d.id)).map(d => d.name);
		const cats = categories.value.filter(c => categoryIds.value.includes(c.id)).map(c => c.name);
		if (depts.length) parts.push(depts.join(', '));
		if (cats.length) parts.push(`loại ${cats.join(', ')}`);
		return parts.length ? parts.join('; ') : 'toàn công ty';
	});

	useEscapeKey(
		() => emit('close'),
		() => !isSubmitting.value,
	);

	const onSubmit = handleSubmit(async values => {
		try {
			const created = await service.createStocktake({
				name: values.name.trim(),
				departmentIds: departmentIds.value.length ? departmentIds.value : undefined,
				categoryIds: categoryIds.value.length ? categoryIds.value : undefined,
				note: values.note?.trim() || undefined,
			});
			toast.success(
				`Đã mở đợt kiểm kê "${created.name}" gồm ${created.summary.total} thiết bị. Bạn bắt đầu quét tem ở ô "Nhập mã hoặc quét tem", hoặc ghi tay ở từng dòng.`,
			);
			emit('created', created);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa mở được đợt kiểm kê. Bạn thử lại sau ít phút.');
		}
	});

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
</script>

<template>
	<Teleport to="body">
		<div
			class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-4"
			role="dialog"
			aria-modal="true"
			aria-label="Mở đợt kiểm kê"
		>
			<div class="my-4 w-full max-w-2xl rounded-2xl bg-white shadow-xl sm:my-8 dark:bg-gray-900">
				<div class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Mở đợt kiểm kê</h2>
						<p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
							Hệ thống chốt danh sách thiết bị trong phạm vi lúc mở đợt, không gồm thiết bị đã Mất hay Đã thanh lý.
						</p>
					</div>
					<button
						type="button"
						class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:h-8 sm:w-8 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng hộp mở đợt kiểm kê"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form class="space-y-5 p-4 sm:p-6" @submit.prevent="onSubmit">
					<div class="space-y-1">
						<label :class="labelCls">Tên đợt <span class="text-red-500">*</span></label>
						<input v-model="name" v-bind="nameAttrs" type="text" maxlength="200" :class="inputCls" placeholder="VD: Kiểm kê cuối năm 2026" />
						<p v-if="errors.name" class="text-xs text-red-500">{{ errors.name }}</p>
					</div>

					<div v-if="loadingRefs" class="space-y-2">
						<div v-for="i in 3" :key="i" class="h-8 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
					</div>
					<div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<fieldset class="space-y-1">
							<legend :class="labelCls">Phòng ban</legend>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Chỉ gồm thiết bị đang giao cho phòng đó hoặc nhân viên của phòng. Thiết bị để trong kho, chưa giao cho ai, không thuộc phòng nào, kể cả phòng Kho vận. Muốn kiểm cả đồ trong kho, bạn chọn toàn công ty hoặc theo loại thiết bị.
							</p>
							<div class="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
								<label
									v-for="d in departments"
									:key="d.id"
									class="flex min-h-11 cursor-pointer items-center gap-2 rounded px-1 text-sm text-gray-800 hover:bg-gray-50 sm:min-h-0 sm:py-1 dark:text-gray-200 dark:hover:bg-gray-800"
								>
									<input
										type="checkbox"
										class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
										:checked="departmentIds.includes(d.id)"
										@change="toggleDepartment(d.id)"
									/>
									{{ d.name }}
								</label>
							</div>
						</fieldset>
						<fieldset class="space-y-1">
							<legend :class="labelCls">Loại thiết bị</legend>
							<p class="text-xs text-gray-500 dark:text-gray-400">Bỏ trống là mọi loại thiết bị.</p>
							<div class="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
								<label
									v-for="c in categories"
									:key="c.id"
									class="flex min-h-11 cursor-pointer items-center gap-2 rounded px-1 text-sm text-gray-800 hover:bg-gray-50 sm:min-h-0 sm:py-1 dark:text-gray-200 dark:hover:bg-gray-800"
								>
									<input
										type="checkbox"
										class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
										:checked="categoryIds.includes(c.id)"
										@change="toggleCategory(c.id)"
									/>
									{{ c.groupName }} · {{ c.name }}
								</label>
							</div>
						</fieldset>
					</div>

					<p class="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
						Phạm vi: {{ scopePreview }}.
					</p>

					<div class="space-y-1">
						<label :class="labelCls">Ghi chú</label>
						<textarea v-model="note" v-bind="noteAttrs" rows="2" maxlength="2000" :class="`${inputCls} resize-none`" />
						<p v-if="errors.note" class="text-xs text-red-500">{{ errors.note }}</p>
					</div>

					<div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
						<CommonAppButton variant="secondary" type="button" class="min-h-11 sm:min-h-0" @click="emit('close')">Đóng</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" class="min-h-11 sm:min-h-0" :loading="isSubmitting">Mở đợt kiểm kê</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
