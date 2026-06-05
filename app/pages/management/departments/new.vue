<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { useDepartmentService, useEmployeeService } from '~/services';

	definePageMeta({ title: 'Thêm phòng ban' });

	const toast = useToast();
	const router = useRouter();

	const deptService = useDepartmentService();
	const empService = useEmployeeService();

	// ─── Load managers for select ──────────────────────────────────────────────

	type ManagerOption = { value: number | undefined; label: string; sub?: string };

	const managerOptions = ref<ManagerOption[]>([{ value: undefined, label: '— Chưa chỉ định —' }]);
	const loadingManagers = ref(false);

	onMounted(async () => {
		loadingManagers.value = true;
		try {
			const res = await empService.findAll({ status: 'ACTIVE', pagination: false });
			managerOptions.value = [
				{ value: undefined, label: '— Chưa chỉ định —' },
				...res.data.map(e => ({
					value: e.id as number | undefined,
					label: e.fullName,
					sub: `${e.employeeCode} · ${e.department?.name ?? 'Chưa có phòng ban'}`,
				})),
			];
		} catch {
			// non-blocking: manager select just stays empty
		} finally {
			loadingManagers.value = false;
		}
	});

	// ─── Form ──────────────────────────────────────────────────────────────────

	const { handleSubmit, defineField, errors, isSubmitting, meta } = useForm<{
		name: string;
		managerId: number | undefined;
	}>({
		validationSchema: {
			name: (v: string) => {
				if (!v || !v.trim()) return 'Vui lòng nhập tên phòng ban';
				if (v.trim().length < 2) return 'Tối thiểu 2 ký tự';
				if (v.trim().length > 100) return 'Tối đa 100 ký tự';
				return true;
			},
		},
	});

	const [name, nameAttrs] = defineField('name');
	const [managerId] = defineField('managerId');

	const nameLength = computed(() => name.value?.length ?? 0);

	const onSubmit = handleSubmit(async values => {
		try {
			const created = await deptService.create({
				name: values.name.trim(),
				...(values.managerId ? { managerId: values.managerId } : {}),
			});
			toast.success('Tạo phòng ban thành công');
			await router.push(`/management/departments/${created.id}`);
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Có lỗi xảy ra, vui lòng thử lại';
			toast.error(msg);
		}
	});
</script>

<template>
	<div class="space-y-5 max-w-2xl">
		<!-- Back nav -->
		<NuxtLink
			to="/management/departments"
			class="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Danh sách phòng ban
		</NuxtLink>

		<!-- Page title -->
		<div>
			<h1 class="text-xl font-semibold text-gray-900 dark:text-white">Thêm phòng ban mới</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
				Điền thông tin bên dưới để tạo phòng ban. Trường có dấu
				<span class="text-red-500 font-medium">*</span> là bắt buộc.
			</p>
		</div>

		<!-- Form card -->
		<form
			class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm"
			@submit.prevent="onSubmit"
		>
			<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
				<h2 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Thông tin phòng ban</h2>
			</div>

			<div class="p-6 space-y-5">
				<!-- Tên phòng ban -->
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
						Tên phòng ban
						<span class="text-red-500 ml-0.5">*</span>
					</label>
					<input
						v-model="name"
						v-bind="nameAttrs"
						type="text"
						placeholder="VD: Kỹ thuật, Nhân sự, Marketing..."
						maxlength="100"
						:class="[
							'block w-full rounded-lg border px-3 py-2.5 text-sm transition-colors',
							'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
							'placeholder:text-gray-400 dark:placeholder:text-gray-500',
							'focus:outline-none focus:ring-2 focus:ring-offset-0',
							errors.name
								? 'border-red-400 focus:border-red-400 focus:ring-red-200 dark:border-red-500 dark:focus:ring-red-900/40'
								: 'border-gray-300 dark:border-gray-600 focus:border-brand-500 focus:ring-brand-200 dark:focus:border-brand-400 dark:focus:ring-brand-900/40',
						]"
					/>
					<!-- Error / char count row -->
					<div class="flex items-start justify-between mt-1.5 gap-2">
						<div class="flex items-center gap-1.5 min-h-[18px]">
							<template v-if="errors.name">
								<svg class="w-3.5 h-3.5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
									<path
										fill-rule="evenodd"
										d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
										clip-rule="evenodd"
									/>
								</svg>
								<p class="text-xs text-red-500 dark:text-red-400">{{ errors.name }}</p>
							</template>
						</div>
						<p
							:class="[
								'text-xs flex-shrink-0 tabular-nums',
								nameLength > 90 ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500',
							]"
						>
							{{ nameLength }}/100
						</p>
					</div>
				</div>

				<!-- Trưởng phòng (optional) -->
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
						Trưởng phòng
						<span class="ml-1 text-xs font-normal text-gray-400 dark:text-gray-500">(tuỳ chọn)</span>
					</label>

					<!-- Custom manager select with sub-label support -->
					<div class="relative">
						<UiSelect
							:model-value="managerId"
							:options="managerOptions"
							:disabled="loadingManagers"
							placeholder="Chọn trưởng phòng..."
							@update:model-value="v => (managerId = v as number | undefined)"
						/>
						<div v-if="loadingManagers" class="absolute inset-y-0 right-8 flex items-center pointer-events-none">
							<svg class="animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
							</svg>
						</div>
					</div>
					<p class="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
						Có thể chỉ định hoặc thay đổi trưởng phòng sau khi tạo.
					</p>
				</div>
			</div>

			<!-- Form footer -->
			<div
				class="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3"
			>
				<!-- Validation summary hint -->
				<p v-if="meta.dirty && !meta.valid" class="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
					<svg class="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
							clip-rule="evenodd"
						/>
					</svg>
					Vui lòng kiểm tra lại thông tin
				</p>
				<span v-else />

				<div class="flex items-center gap-3">
					<NuxtLink to="/management/departments">
						<CommonAppButton type="button" variant="outline">Hủy</CommonAppButton>
					</NuxtLink>
					<CommonAppButton type="submit" :loading="isSubmitting" :disabled="meta.dirty && !meta.valid">
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
						</svg>
						Tạo phòng ban
					</CommonAppButton>
				</div>
			</div>
		</form>
	</div>
</template>
