<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useAssetService } from '~/services/asset.service';
	import { apiErrorCode, suggestedResolution } from '~/utils/asset.utils';
	import { formatDate, todayYmd, vnCalendarDate } from '~/utils/date';
	import type {
		AssetStocktake,
		AssetStocktakeLine,
		ResolveAssetStocktakeLineBody,
	} from '~/types/asset.types';

	/**
	 * Xử lý một dòng chênh lệch sau khi đóng đợt, bằng một trong bốn cách.
	 *
	 * Mỗi cách gọi đúng luồng có sẵn của BE (điều chuyển hoặc cấp phát, tạo phiếu sửa, xác nhận mất).
	 * Luồng đó lỗi thì BE trả nguyên mã và câu, dòng vẫn Chưa xử lý: hộp giữ nguyên để người dùng
	 * đổi cách khác mà không phải nhập lại.
	 */
	const props = defineProps<{ stocktake: AssetStocktake; line: AssetStocktakeLine }>();

	const emit = defineEmits<{
		resolved: [line: AssetStocktakeLine];
		/** Người khác đã xử lý dòng này: nơi gọi tải lại danh sách. */
		stale: [];
		close: [];
	}>();

	const toast = useToast();
	const service = useAssetService();
	const directoryStore = useDirectoryStore();
	const { employees, departments } = storeToRefs(directoryStore);

	type Resolution = ResolveAssetStocktakeLineBody['resolution'];
	type HolderMode = 'keep' | 'employee' | 'department';

	/** Cách gợi ý sẵn theo kết quả kiểm; dòng Không tìm thấy không chọn sẵn (xem `suggestedResolution`). */
	const suggested = (): Resolution | undefined => suggestedResolution(props.line.result);

	const OPTIONS: { value: Resolution; label: string; hint: string }[] = [
		{
			value: 'UPDATED',
			label: 'Cập nhật sổ (vị trí hoặc người giữ)',
			hint: 'Hệ thống sửa sổ theo thực tế. Nếu đổi người giữ, hệ thống điều chuyển thiết bị, hoặc cấp phát khi thiết bị chưa có ai giữ.',
		},
		{
			value: 'REPAIR_OPENED',
			label: 'Tạo phiếu sửa',
			hint: 'Hệ thống tạo một phiếu sửa mang sẵn kết quả kiểm kê, thiết bị chuyển sang Đang sửa.',
		},
		{
			value: 'MARKED_LOST',
			label: 'Xác nhận mất',
			hint: 'Thiết bị chuyển sang Mất, lần cấp phát đang mở được đóng và khấu hao dừng từ ngày mất.',
		},
		{
			value: 'IGNORED',
			label: 'Giữ nguyên sổ',
			hint: 'Không đổi gì trên sổ. Bạn bắt buộc ghi lý do, để người xem biên bản hiểu vì sao chênh lệch này không cần sửa.',
		},
	];

	/** Xác nhận mất dừng khấu hao, không hoàn tác được: hỏi lại một bước trước khi gửi. */
	const confirmingLost = ref(false);
	const assetLabel = computed(() => `${props.line.asset.name} (${props.line.asset.code})`);

	const holderMode = ref<HolderMode>('keep');

	const schema = toTypedSchema(
		z
			.object({
				resolution: z.enum(['UPDATED', 'REPAIR_OPENED', 'MARKED_LOST', 'IGNORED'], {
					required_error: 'Bạn chọn một cách xử lý.',
					invalid_type_error: 'Bạn chọn một cách xử lý.',
				}),
				location: z.string().max(200, 'Vị trí tối đa 200 ký tự').optional(),
				toEmployeeId: z.number().optional(),
				toDepartmentId: z.number().optional(),
				responsibleId: z.number().optional(),
				lostDate: z.string().optional(),
				note: z.string().max(1000, 'Ghi chú tối đa 1000 ký tự').optional(),
			})
			.superRefine((v, ctx) => {
				if (v.resolution === 'IGNORED' && !v.note?.trim()) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ['note'],
						message: 'Bạn ghi lý do giữ nguyên sổ, để người xem biên bản hiểu vì sao chênh lệch này không cần sửa.',
					});
				}
				if (v.resolution === 'MARKED_LOST' && v.lostDate && v.lostDate > todayYmd()) {
					ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lostDate'], message: 'Ngày mất không được sau hôm nay.' });
				}
				if (v.resolution !== 'UPDATED') return;
				if (holderMode.value === 'employee' && !v.toEmployeeId) {
					ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toEmployeeId'], message: 'Bạn chọn người đang giữ thiết bị.' });
				}
				if (holderMode.value === 'department') {
					if (!v.toDepartmentId) {
						ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['toDepartmentId'], message: 'Bạn chọn phòng ban.' });
					}
					if (!v.responsibleId) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: ['responsibleId'],
							message: 'Bạn chọn người chịu trách nhiệm khi đổi sang phòng ban.',
						});
					}
				}
				if (holderMode.value === 'keep' && !v.location?.trim()) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ['location'],
						message: 'Bạn ghi vị trí mới, hoặc chọn người giữ đúng ở bên dưới.',
					});
				}
			}),
	);

	const closedDate = props.stocktake.closedAt ? vnCalendarDate(props.stocktake.closedAt) : todayYmd();

	const { handleSubmit, defineField, errors, isSubmitting } = useForm({
		validationSchema: schema,
		initialValues: {
			resolution: suggested(),
			location: props.line.observedLocation ?? '',
			lostDate: closedDate,
			note: '',
		},
	});

	const [resolution] = defineField('resolution');
	// Đổi cách xử lý thì bỏ bước xác nhận mất đang dở.
	watch(resolution, () => (confirmingLost.value = false));
	const [location, locationAttrs] = defineField('location');
	const [toEmployeeId, toEmployeeIdAttrs] = defineField('toEmployeeId');
	const [toDepartmentId, toDepartmentIdAttrs] = defineField('toDepartmentId');
	const [responsibleId, responsibleIdAttrs] = defineField('responsibleId');
	const [lostDate, lostDateAttrs] = defineField('lostDate');
	const [note, noteAttrs] = defineField('note');

	/** Ô chọn trả `string | number`; trường của form giữ id dạng số hoặc `undefined`. */
	const asId = (v: string | number): number | undefined => {
		const n = typeof v === 'number' ? v : Number(v);
		return Number.isInteger(n) && n > 0 ? n : undefined;
	};

	const employeeOptions = computed(() =>
		employees.value.map(e => ({ value: e.id, label: `${e.fullName} · ${e.employeeCode}` })),
	);
	const departmentOptions = computed(() => departments.value.map(d => ({ value: d.id, label: d.name })));

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

	/** Toast có tên thiết bị và nói bước tiếp theo theo từng cách xử lý (response không có số phiếu sửa). */
	function resolvedText(r: Resolution, lost: string | undefined): string {
		const name = assetLabel.value;
		switch (r) {
			case 'REPAIR_OPENED':
				return `Đã tạo phiếu sửa cho ${name}. Bạn theo dõi ở tab Sửa chữa, bảo dưỡng của tài sản.`;
			case 'MARKED_LOST':
				return `Đã xác nhận mất ${name}, thiết bị dừng khấu hao từ ngày ${formatDate(lost || closedDate)}.`;
			case 'IGNORED':
				return `Đã giữ nguyên sổ cho ${name}, lý do được ghi vào biên bản kiểm kê.`;
			default:
				return `Đã cập nhật sổ cho ${name}.`;
		}
	}

	const onSubmit = handleSubmit(async values => {
		// Xác nhận mất: lần bấm đầu chỉ mở bước xác nhận, lần thứ hai mới gửi.
		if (values.resolution === 'MARKED_LOST' && !confirmingLost.value) {
			confirmingLost.value = true;
			return;
		}
		const body: ResolveAssetStocktakeLineBody = {
			resolution: values.resolution,
			note: values.note?.trim() || undefined,
		};
		if (values.resolution === 'UPDATED') {
			body.location = values.location?.trim() || undefined;
			if (holderMode.value === 'employee') body.toEmployeeId = values.toEmployeeId;
			if (holderMode.value === 'department') {
				body.toDepartmentId = values.toDepartmentId;
				body.responsibleId = values.responsibleId;
			}
		}
		if (values.resolution === 'MARKED_LOST') body.lostDate = values.lostDate || undefined;
		try {
			const saved = await service.resolveStocktakeLine(props.line.id, body);
			toast.success(resolvedText(values.resolution, body.lostDate));
			emit('resolved', saved);
		} catch (e) {
			confirmingLost.value = false;
			toast.error(e instanceof Error ? e.message : 'Chưa xử lý được chênh lệch này. Bạn thử lại sau ít phút.');
			if (apiErrorCode(e) === 'ASSET_STOCKTAKE_LINE_RESOLVED') emit('stale');
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
			:aria-label="`Xử lý chênh lệch ${line.asset.code}`"
		>
			<form class="my-4 w-full max-w-xl rounded-2xl bg-white shadow-xl sm:my-8 dark:bg-gray-900" @submit.prevent="onSubmit">
				<div class="border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Xử lý chênh lệch</h2>
					<p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
						<span class="font-mono">{{ line.asset.code }}</span> · {{ line.asset.name }} · kết quả {{ line.resultLabel }}
					</p>
				</div>

				<div class="space-y-4 p-4 sm:p-6">
					<dl class="grid grid-cols-1 gap-x-6 gap-y-1 rounded-lg bg-gray-50 px-3 py-2 text-sm sm:grid-cols-2 dark:bg-gray-800">
						<div>
							<dt class="text-xs text-gray-500 dark:text-gray-400">Theo sổ lúc mở đợt</dt>
							<dd class="text-gray-800 dark:text-gray-200">
								{{ line.expectedHolderName ?? line.expectedDepartmentName ?? 'Chưa cấp phát' }}
								<template v-if="line.expectedLocation">, {{ line.expectedLocation }}</template>
							</dd>
						</div>
						<div>
							<dt class="text-xs text-gray-500 dark:text-gray-400">Thực tế khi kiểm</dt>
							<dd class="text-gray-800 dark:text-gray-200">
								{{ line.observedLocation ?? 'Không ghi vị trí' }}
								<template v-if="line.observedNote">. {{ line.observedNote }}</template>
							</dd>
						</div>
					</dl>

					<fieldset class="space-y-2">
						<legend :class="labelCls">Cách xử lý</legend>
						<label
							v-for="opt in OPTIONS"
							:key="opt.value"
							class="flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border px-3 py-2"
							:class="
								resolution === opt.value
									? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
									: 'border-gray-200 dark:border-gray-700'
							"
						>
							<input v-model="resolution" type="radio" :value="opt.value" class="mt-0.5 h-4 w-4 text-brand-600 focus:ring-brand-500" />
							<span class="min-w-0">
								<span class="block text-sm font-medium text-gray-900 dark:text-white">{{ opt.label }}</span>
								<span class="block text-xs text-gray-600 dark:text-gray-400">{{ opt.hint }}</span>
							</span>
						</label>
						<p v-if="errors.resolution" class="text-xs text-red-500">{{ errors.resolution }}</p>
						<p v-else-if="!resolution && line.result === 'NOT_FOUND'" class="text-xs text-gray-600 dark:text-gray-400">
							Thiết bị không tìm thấy lúc kiểm có thể chỉ đang đi vắng. Bạn chọn cách xử lý phù hợp, Xác nhận mất chỉ
							khi chắc thiết bị đã mất.
						</p>
					</fieldset>

					<template v-if="resolution === 'UPDATED'">
						<div class="space-y-1">
							<label :class="labelCls">Vị trí mới</label>
							<input v-model="location" v-bind="locationAttrs" type="text" maxlength="200" :class="inputCls" placeholder="VD: Kho Long Biên, kệ số 3" />
							<p v-if="errors.location" class="text-xs text-red-500">{{ errors.location }}</p>
						</div>

						<div class="space-y-2">
							<p :class="labelCls">Người giữ</p>
							<div class="grid grid-cols-1 gap-1 rounded-lg border border-gray-300 p-0.5 sm:grid-cols-3 dark:border-gray-600">
								<button
									v-for="m in [
										{ id: 'keep', label: 'Giữ nguyên' },
										{ id: 'employee', label: 'Đổi người giữ sang nhân viên' },
										{ id: 'department', label: 'Đổi sang phòng ban' },
									]"
									:key="m.id"
									type="button"
									:class="[
										'min-h-11 rounded-md px-3 py-1.5 text-xs transition sm:min-h-0',
										holderMode === m.id ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-300',
									]"
									@click="holderMode = m.id as HolderMode"
								>
									{{ m.label }}
								</button>
							</div>
							<div v-if="holderMode === 'employee'" class="space-y-1">
								<UiSelectInput
									:model-value="toEmployeeId ?? null"
									v-bind="toEmployeeIdAttrs"
									@update:model-value="v => (toEmployeeId = asId(v))"
									:options="employeeOptions"
									placeholder="Chọn nhân viên đang giữ"
									search-placeholder="Tìm tên hoặc mã nhân viên"
								/>
								<p v-if="errors.toEmployeeId" class="text-xs text-red-500">{{ errors.toEmployeeId }}</p>
							</div>
							<div v-if="holderMode === 'department'" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<div class="space-y-1">
									<UiSelectInput
										:model-value="toDepartmentId ?? null"
										v-bind="toDepartmentIdAttrs"
										:options="departmentOptions"
										placeholder="Chọn phòng ban"
										@update:model-value="v => (toDepartmentId = asId(v))"
									/>
									<p v-if="errors.toDepartmentId" class="text-xs text-red-500">{{ errors.toDepartmentId }}</p>
								</div>
								<div class="space-y-1">
									<UiSelectInput
										:model-value="responsibleId ?? null"
										v-bind="responsibleIdAttrs"
										@update:model-value="v => (responsibleId = asId(v))"
										:options="employeeOptions"
										placeholder="Người chịu trách nhiệm"
										search-placeholder="Tìm tên hoặc mã nhân viên"
									/>
									<p v-if="errors.responsibleId" class="text-xs text-red-500">{{ errors.responsibleId }}</p>
								</div>
							</div>
							<p v-if="holderMode !== 'keep'" class="text-xs text-gray-600 dark:text-gray-400">
								Người được giao thiết bị sẽ nhận thông báo để xác nhận.
							</p>
						</div>
					</template>

					<div v-if="resolution === 'MARKED_LOST'" class="space-y-1">
						<label :class="labelCls">Ngày mất</label>
						<UiDatePicker v-model="lostDate" v-bind="lostDateAttrs" :max="todayYmd()" />
						<p v-if="errors.lostDate" class="text-xs text-red-500">{{ errors.lostDate }}</p>
						<p v-else class="text-xs text-gray-600 dark:text-gray-400">Mặc định là ngày đóng đợt. Khấu hao dừng từ ngày này.</p>
					</div>

					<div class="space-y-1">
						<label :class="labelCls">
							Ghi chú
							<span v-if="resolution === 'IGNORED'" class="text-red-500">*</span>
						</label>
						<textarea
							v-model="note"
							v-bind="noteAttrs"
							rows="2"
							maxlength="1000"
							:class="`${inputCls} resize-none`"
							:placeholder="resolution === 'IGNORED' ? 'VD: thiết bị cho mượn ngắn ngày, đã trả lại sau buổi kiểm kê' : 'Không bắt buộc'"
						/>
						<p v-if="errors.note" class="text-xs text-red-500">{{ errors.note }}</p>
					</div>

					<!-- Bước xác nhận riêng cho Xác nhận mất. -->
					<div
						v-if="confirmingLost"
						class="space-y-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 dark:border-rose-800 dark:bg-rose-900/20"
						role="alert"
					>
						<p class="text-sm text-rose-800 dark:text-rose-300">
							{{ assetLabel }} chuyển sang Mất và dừng khấu hao từ ngày {{ formatDate(lostDate || closedDate) }}. Lần cấp phát
							đang mở được đóng. Thao tác này không hoàn tác được.
						</p>
						<div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
							<CommonAppButton
								variant="secondary"
								type="button"
								class="min-h-11 sm:min-h-0"
								:disabled="isSubmitting"
								@click="confirmingLost = false"
							>
								Quay lại
							</CommonAppButton>
							<CommonAppButton variant="danger" type="submit" class="min-h-11 sm:min-h-0" :loading="isSubmitting">
								Xác nhận mất
							</CommonAppButton>
						</div>
					</div>

					<div v-else class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
						<CommonAppButton variant="secondary" type="button" class="min-h-11 sm:min-h-0" :disabled="isSubmitting" @click="emit('close')">
							Đóng
						</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" class="min-h-11 sm:min-h-0" :loading="isSubmitting">Xử lý</CommonAppButton>
					</div>
				</div>
			</form>
		</div>
	</Teleport>
</template>
