<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useAssetService } from '~/services/asset.service';
	import { useDepartmentService } from '~/services';
	import { todayYmd } from '~/utils/date';
	import { ASSET_CONDITION_LABELS, type Asset, type AssetAssignResult } from '~/types/asset.types';
	import { asAssetEnum, assignmentHolderName, ASSET_CONDITION_CODES } from '~/utils/asset.utils';

	const props = defineProps<{ asset: Asset }>();

	const emit = defineEmits<{
		assigned: [result: AssetAssignResult];
		close: [];
	}>();

	const toast = useToast();
	const service = useAssetService();
	const directoryStore = useDirectoryStore();
	const { employees, departments } = storeToRefs(directoryStore);

	/** Ghế dịch vụ chỉ nhận một người; chỉ thiết bị mới giao được cho cả phòng ban. */
	const isService = computed(() => props.asset.kind === 'SERVICE');
	const target = ref<'employee' | 'department'>('employee');

	const schema = toTypedSchema(
		z
			.object({
				employeeId: z.number().optional(),
				departmentId: z.number().optional(),
				responsibleId: z.number().optional(),
				assignedAt: z.string().min(1, 'Chọn ngày cấp phát'),
				condition: z.string().optional(),
				expectedReturnDate: z.string().optional(),
				note: z.string().optional(),
			})
			.superRefine((v, ctx) => {
				if (target.value === 'employee') {
					if (!v.employeeId) {
						ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['employeeId'], message: 'Chọn người nhận' });
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
						message: 'Cấp phát cho phòng ban cần chọn một người chịu trách nhiệm',
					});
				}
			}),
	);

	const { handleSubmit, defineField, errors, isSubmitting, setFieldValue } = useForm({
		validationSchema: schema,
		initialValues: { assignedAt: todayYmd() },
	});

	const [employeeId, employeeIdAttrs] = defineField('employeeId');
	const [departmentId, departmentIdAttrs] = defineField('departmentId');
	const [responsibleId, responsibleIdAttrs] = defineField('responsibleId');
	const [assignedAt, assignedAtAttrs] = defineField('assignedAt');
	const [condition, conditionAttrs] = defineField('condition');
	const [expectedReturnDate, expectedReturnDateAttrs] = defineField('expectedReturnDate');
	const [note, noteAttrs] = defineField('note');

	const employeeOptions = computed(() =>
		employees.value.map(e => ({ value: e.id, label: `${e.fullName} · ${e.employeeCode}` })),
	);
	const departmentOptions = computed(() => departments.value.map(d => ({ value: d.id, label: d.name })));
	const conditionOptions = [
		{ value: '', label: 'Không ghi tình trạng' },
		...Object.entries(ASSET_CONDITION_LABELS).map(([value, label]) => ({ value, label })),
	];

	/**
	 * Người chịu trách nhiệm khi cấp phát cho phòng ban (B11).
	 *
	 * Người trong phòng đứng đầu danh sách, trưởng phòng đứng đầu nhất và được chọn sẵn; người
	 * ngoài phòng vẫn chọn được vì có lúc phòng nhờ người khác giữ hộ. Trưởng phòng lấy từ chi
	 * tiết phòng ban vì danh bạ chung không có trường này.
	 */
	const departmentService = useDepartmentService();
	const departmentManagerId = ref<number | null>(null);

	watch(departmentId, async id => {
		departmentManagerId.value = null;
		if (!id) return;
		try {
			const dept = await departmentService.findOne(Number(id));
			if (departmentId.value !== id) return;
			departmentManagerId.value = dept.manager?.id ?? null;
			if (dept.manager && !responsibleId.value) setFieldValue('responsibleId', dept.manager.id);
		} catch {
			// Không lấy được trưởng phòng thì chỉ mất phần gợi ý, danh sách vẫn xếp theo phòng.
		}
	});

	const responsibleOptions = computed(() => {
		const deptId = departmentId.value ? Number(departmentId.value) : null;
		if (!deptId) return employeeOptions.value;
		const inDept = employees.value.filter(e => e.department?.id === deptId);
		const others = employees.value.filter(e => e.department?.id !== deptId);
		inDept.sort((a, b) => (a.id === departmentManagerId.value ? -1 : b.id === departmentManagerId.value ? 1 : 0));
		return [
			...inDept.map(e => ({
				value: e.id,
				label: `${e.fullName} · ${e.employeeCode}${e.id === departmentManagerId.value ? ' · Trưởng phòng' : ' · Trong phòng'}`,
			})),
			...others.map(e => ({ value: e.id, label: `${e.fullName} · ${e.employeeCode}` })),
		];
	});

	onMounted(async () => {
		try {
			await directoryStore.load();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa tải được danh sách nhân viên. Bạn đóng hộp rồi mở lại.');
		}
	});

	useEscapeKey(
		() => emit('close'),
		() => !isSubmitting.value,
	);

	const onSubmit = handleSubmit(async values => {
		try {
			const result = await service.assign(props.asset.id, {
				employeeId: target.value === 'employee' ? values.employeeId : undefined,
				departmentId: target.value === 'department' ? values.departmentId : undefined,
				responsibleId: target.value === 'department' ? values.responsibleId : undefined,
				assignedAt: values.assignedAt,
				condition: asAssetEnum(values.condition, ASSET_CONDITION_CODES),
				expectedReturnDate: values.expectedReturnDate || undefined,
				note: values.note || undefined,
			});
			const recipient = assignmentHolderName(result.assignment);
			// Vượt số ghế vẫn thành công: cảnh báo vàng, không chặn.
			if (result.warnings?.includes('SEATS_EXCEEDED')) {
				const s = props.asset.service;
				toast.warning(
					s?.seatCount != null
						? `${props.asset.name} đang dùng ${s.seatsUsed + 1}/${s.seatCount} ghế, nhiều hơn số ghế đã đăng ký. Bạn cân nhắc tăng số ghế ở lần gia hạn tới.`
						: `${props.asset.name} đang dùng nhiều ghế hơn số đã đăng ký. Bạn cân nhắc tăng số ghế ở lần gia hạn tới.`,
				);
			}
			toast.success(
				isService.value
					? `Đã cấp ghế ${props.asset.name} cho ${recipient}.`
					: `Đã cấp phát ${props.asset.code} · ${props.asset.name} cho ${recipient}. Người nhận sẽ nhận được thông báo để xác nhận đã nhận.`,
			);
			emit('assigned', result);
		} catch (e) {
			// Giữ nguyên dữ liệu đã nhập để người dùng sửa, đừng đóng modal.
			toast.error(e instanceof Error ? e.message : 'Chưa cấp phát được. Bạn thử lại sau ít phút.');
		}
	});
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ isService ? 'Cấp ghế dịch vụ' : 'Cấp phát tài sản' }}
						</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							{{ asset.code }} · {{ asset.name }}
						</p>
					</div>
					<button
						type="button"
						class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng hộp cấp phát"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form class="space-y-4 p-6" @submit.prevent="onSubmit">
					<!-- Chọn giao cho ai: chỉ thiết bị mới giao được cho phòng ban -->
					<div v-if="!isService" class="flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-600">
						<button
							type="button"
							:class="[
								'flex-1 rounded-md px-3 py-1.5 text-xs transition',
								target === 'employee' ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-300',
							]"
							@click="target = 'employee'"
						>
							Cấp phát cho nhân viên
						</button>
						<button
							type="button"
							:class="[
								'flex-1 rounded-md px-3 py-1.5 text-xs transition',
								target === 'department' ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-300',
							]"
							@click="target = 'department'"
						>
							Cấp phát cho phòng ban
						</button>
					</div>

					<div v-if="target === 'employee'" class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Người nhận <span class="text-red-500">*</span>
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
								:options="responsibleOptions"
								placeholder="Chọn nhân viên"
								search-placeholder="Tìm tên hoặc mã nhân viên"
							/>
							<p v-if="errors.responsibleId" class="text-xs text-red-500">{{ errors.responsibleId }}</p>
							<p v-else-if="departmentId" class="text-xs text-gray-600 dark:text-gray-400">
								Người trong phòng đứng đầu danh sách và trưởng phòng được chọn sẵn. Bạn đổi được nếu phòng nhờ
								người khác giữ.
							</p>
						</div>
					</template>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Ngày cấp phát <span class="text-red-500">*</span>
							</label>
							<UiDatePicker v-model="assignedAt" v-bind="assignedAtAttrs" />
							<p v-if="errors.assignedAt" class="text-xs text-red-500">{{ errors.assignedAt }}</p>
						</div>

						<div v-if="!isService" class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tình trạng khi cấp phát</label>
							<UiSelect v-model="condition" v-bind="conditionAttrs" :options="conditionOptions" />
						</div>
					</div>

					<div v-if="!isService" class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Ngày dự kiến trả</label>
						<UiDatePicker v-model="expectedReturnDate" v-bind="expectedReturnDateAttrs" />
					</div>

					<div class="space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Ghi chú</label>
						<textarea
							v-model="note"
							v-bind="noteAttrs"
							rows="2"
							placeholder="VD: kèm sạc và túi chống sốc"
							class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
					</div>

					<p v-if="!isService" class="text-xs text-gray-600 dark:text-gray-400">
						Người nhận sẽ nhận được thông báo và xác nhận đã nhận ở trang Tài sản của tôi.
					</p>

					<div class="flex justify-end gap-3 pt-2">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Đóng</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="isSubmitting">
							{{ isService ? 'Cấp ghế' : 'Cấp phát' }}
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
