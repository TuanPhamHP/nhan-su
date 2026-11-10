<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useAssetService } from '~/services/asset.service';
	import { todayYmd } from '~/utils/date';
	import { ASSET_CONDITION_LABELS, type Asset, type AssetAssignResult } from '~/types/asset.types';
	import { asAssetEnum, ASSET_CONDITION_CODES } from '~/utils/asset.utils';

	const props = defineProps<{ asset: Asset }>();

	const emit = defineEmits<{
		transferred: [result: AssetAssignResult];
		close: [];
	}>();

	const toast = useToast();
	const service = useAssetService();
	const directoryStore = useDirectoryStore();
	const { employees, departments } = storeToRefs(directoryStore);

	/** Người đang giữ, để nhắc ở đầu form và để chặn điều chuyển cho chính họ. */
	const currentHolder = computed(() => {
		const holder = props.asset.holders[0];
		if (!holder) return null;
		if (holder.employee) return holder.employee.fullName;
		if (holder.department) {
			return `${holder.department.name}${holder.responsible ? ` (${holder.responsible.fullName})` : ''}`;
		}
		return null;
	});

	const target = ref<'employee' | 'department'>('employee');

	const schema = toTypedSchema(
		z
			.object({
				employeeId: z.number().optional(),
				departmentId: z.number().optional(),
				responsibleId: z.number().optional(),
				assignedAt: z.string().min(1, 'Chọn ngày điều chuyển'),
				conditionOnReturn: z.string().optional(),
				condition: z.string().optional(),
				expectedReturnDate: z.string().optional(),
				note: z.string().optional(),
			})
			.superRefine((v, ctx) => {
				if (target.value === 'employee') {
					if (!v.employeeId) {
						ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['employeeId'], message: 'Chọn người nhận mới' });
					}
					return;
				}
				if (!v.departmentId) {
					ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['departmentId'], message: 'Chọn phòng ban' });
				}
				if (!v.responsibleId) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ['responsibleId'],
						message: 'Giao cho phòng ban phải có người chịu trách nhiệm',
					});
				}
			}),
	);

	const { handleSubmit, defineField, errors, isSubmitting } = useForm({
		validationSchema: schema,
		initialValues: { assignedAt: todayYmd() },
	});

	const [employeeId, employeeIdAttrs] = defineField('employeeId');
	const [departmentId, departmentIdAttrs] = defineField('departmentId');
	const [responsibleId, responsibleIdAttrs] = defineField('responsibleId');
	const [assignedAt, assignedAtAttrs] = defineField('assignedAt');
	const [conditionOnReturn, conditionOnReturnAttrs] = defineField('conditionOnReturn');
	const [condition, conditionAttrs] = defineField('condition');
	const [note, noteAttrs] = defineField('note');

	const employeeOptions = computed(() =>
		employees.value.map(e => ({ value: e.id, label: `${e.fullName} · ${e.employeeCode}` })),
	);
	const departmentOptions = computed(() => departments.value.map(d => ({ value: d.id, label: d.name })));
	const conditionOptions = [
		{ value: '', label: 'Không ghi tình trạng' },
		...Object.entries(ASSET_CONDITION_LABELS).map(([value, label]) => ({ value, label })),
	];

	onMounted(async () => {
		try {
			await directoryStore.load();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không tải được danh sách nhân viên');
		}
	});

	const onSubmit = handleSubmit(async values => {
		try {
			const result = await service.transfer(props.asset.id, {
				employeeId: target.value === 'employee' ? values.employeeId : undefined,
				departmentId: target.value === 'department' ? values.departmentId : undefined,
				responsibleId: target.value === 'department' ? values.responsibleId : undefined,
				assignedAt: values.assignedAt,
				conditionOnReturn: asAssetEnum(values.conditionOnReturn, ASSET_CONDITION_CODES),
				condition: asAssetEnum(values.condition, ASSET_CONDITION_CODES),
				note: values.note || undefined,
			});
			toast.success('Đã điều chuyển tài sản');
			emit('transferred', result);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Điều chuyển thất bại');
		}
	});
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">Điều chuyển tài sản</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ asset.code }} · {{ asset.name }}</p>
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

				<form class="space-y-4 p-6" @submit.prevent="onSubmit">
					<p v-if="currentHolder" class="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
						Đang giao cho <strong class="text-gray-900 dark:text-white">{{ currentHolder }}</strong>. Điều chuyển
						sẽ thu hồi của người này và giao cho người mới trong một lần.
					</p>

					<div class="flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-600">
						<button
							type="button"
							:class="[
								'flex-1 rounded-md px-3 py-1.5 text-xs transition',
								target === 'employee' ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-300',
							]"
							@click="target = 'employee'"
						>
							Giao cho nhân viên
						</button>
						<button
							type="button"
							:class="[
								'flex-1 rounded-md px-3 py-1.5 text-xs transition',
								target === 'department' ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-300',
							]"
							@click="target = 'department'"
						>
							Giao cho phòng ban
						</button>
					</div>

					<div v-if="target === 'employee'" class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Người nhận mới <span class="text-red-500">*</span>
						</label>
						<UiSelectInput
							v-model="employeeId"
							v-bind="employeeIdAttrs"
							:options="employeeOptions"
							placeholder="Chọn nhân viên"
							search-placeholder="Tìm tên hoặc mã nhân viên"
						/>
						<p v-if="errors.employeeId" class="text-xs text-red-500">{{ errors.employeeId }}</p>
					</div>

					<template v-else>
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Phòng ban <span class="text-red-500">*</span>
							</label>
							<UiSelectInput
								v-model="departmentId"
								v-bind="departmentIdAttrs"
								:options="departmentOptions"
								placeholder="Chọn phòng ban"
							/>
							<p v-if="errors.departmentId" class="text-xs text-red-500">{{ errors.departmentId }}</p>
						</div>
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Người chịu trách nhiệm <span class="text-red-500">*</span>
							</label>
							<UiSelectInput
								v-model="responsibleId"
								v-bind="responsibleIdAttrs"
								:options="employeeOptions"
								placeholder="Chọn nhân viên"
								search-placeholder="Tìm tên hoặc mã nhân viên"
							/>
							<p v-if="errors.responsibleId" class="text-xs text-red-500">{{ errors.responsibleId }}</p>
						</div>
					</template>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Ngày điều chuyển <span class="text-red-500">*</span>
							</label>
							<UiDatePicker v-model="assignedAt" v-bind="assignedAtAttrs" />
							<p v-if="errors.assignedAt" class="text-xs text-red-500">{{ errors.assignedAt }}</p>
						</div>
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Tình trạng khi thu của người cũ
							</label>
							<UiSelect
								v-model="conditionOnReturn"
								v-bind="conditionOnReturnAttrs"
								:options="conditionOptions"
							/>
						</div>
					</div>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Tình trạng khi giao người mới
						</label>
						<UiSelect v-model="condition" v-bind="conditionAttrs" :options="conditionOptions" />
					</div>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Ghi chú</label>
						<textarea
							v-model="note"
							v-bind="noteAttrs"
							rows="2"
							placeholder="Lý do điều chuyển..."
							class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
					</div>

					<div class="flex justify-end gap-3 pt-2">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="isSubmitting">Điều chuyển</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
