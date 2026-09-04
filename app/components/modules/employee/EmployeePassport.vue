<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { formatDate, formatDateTime } from '~/utils/date';
	import { differenceInDays, parseISO, addDays, formatISO } from 'date-fns';
	import type { CreatePassportPayload, PassportPhotoSide, PassportType } from '~/types/employee-passport.types';

	const props = defineProps<{ employeeId: number }>();

	const toast = useToast();
	const imageViewer = useImageViewerStore();
	const authStore = useAuthStore();
	const { hasPermission } = usePermissions();

	const {
		passport,
		passportLoading,
		passportSubmitting,
		passportUploading,
		fetchPassport,
		createPassport,
		updatePassport,
		deletePassport,
		uploadPassportPhoto,
		deletePassportPhoto,
	} = useEmployeeIdentity();

	const metaDataStore = useMetaDataStore();
	metaDataStore.load().catch(() => { /* not critical */ });
	const { passportTypes } = storeToRefs(metaDataStore);

	const isSelf = computed(() => authStore.user?.id === props.employeeId);
	const canRead = computed(() => isSelf.value || hasPermission('employee:passport:read'));
	const canCreate = computed(() => hasPermission('employee:passport:create'));
	const canUpdate = computed(() => hasPermission('employee:passport:update'));
	const canDelete = computed(() => hasPermission('employee:passport:delete'));

	const mode = ref<'view' | 'edit' | 'create'>('view');
	const showDeleteConfirm = ref(false);
	const uploadingSide = ref<PassportPhotoSide | null>(null);
	const deletingSide = ref<PassportPhotoSide | null>(null);

	async function loadPassport() {
		try {
			await fetchPassport(props.employeeId);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không tải được hộ chiếu');
		}
	}

	onMounted(() => loadPassport());

	const schema = toTypedSchema(
		z.object({
			passportNumber: z
				.string()
				.regex(/^[A-Z0-9]{1,20}$/, 'Chỉ chứa A–Z và 0–9, tối đa 20 ký tự, không khoảng trắng'),
			fullNameOnPassport: z
				.string()
				.min(2, 'Tối thiểu 2 ký tự')
				.max(100, 'Tối đa 100 ký tự'),
			passportType: z.enum(['ORDINARY', 'DIPLOMATIC', 'OFFICIAL'] as const),
			issuedDate: z.string().min(1, 'Vui lòng chọn ngày cấp'),
			expiryDate: z.string().min(1, 'Vui lòng chọn ngày hết hạn'),
		}).refine(v => {
			if (!v.issuedDate || !v.expiryDate) return true;
			return v.expiryDate > v.issuedDate;
		}, { path: ['expiryDate'], message: 'Ngày hết hạn phải sau ngày cấp' }),
	);

	const { handleSubmit, defineField, errors, resetForm, values } = useForm<{
		passportNumber: string;
		fullNameOnPassport: string;
		passportType: PassportType;
		issuedDate: string;
		expiryDate: string;
	}>({
		validationSchema: schema,
		initialValues: {
			passportNumber: '',
			fullNameOnPassport: '',
			passportType: 'ORDINARY',
			issuedDate: '',
			expiryDate: '',
		},
	});

	const [passportNumber, passportNumberAttrs] = defineField('passportNumber');
	const [fullNameOnPassport, fullNameAttrs] = defineField('fullNameOnPassport');
	const [passportType] = defineField('passportType');
	const [issuedDate] = defineField('issuedDate');
	const [expiryDate] = defineField('expiryDate');

	function onPassportNumberInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const cleaned = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
		passportNumber.value = cleaned;
		input.value = cleaned;
	}

	// min expiry date = issuedDate + 1 day
	const minExpiryDate = computed(() => {
		if (!values.issuedDate) return undefined;
		try {
			const d = addDays(parseISO(values.issuedDate), 1);
			return formatISO(d, { representation: 'date' });
		} catch {
			return undefined;
		}
	});

	function fillFromPassport() {
		const p = passport.value;
		if (!p) return;
		resetForm({
			values: {
				passportNumber: p.passportNumber,
				fullNameOnPassport: p.fullNameOnPassport,
				passportType: p.passportType,
				issuedDate: p.issuedDate,
				expiryDate: p.expiryDate,
			},
		});
	}

	function startCreate() {
		if (!canCreate.value) {
			toast.error('Bạn không có quyền tạo hộ chiếu');
			return;
		}
		resetForm();
		mode.value = 'create';
	}

	function startEdit() {
		if (!canUpdate.value) {
			toast.error('Bạn không có quyền cập nhật hộ chiếu');
			return;
		}
		fillFromPassport();
		mode.value = 'edit';
	}

	const onSubmit = handleSubmit(async values => {
		const payload: CreatePassportPayload = {
			passportNumber: values.passportNumber,
			fullNameOnPassport: values.fullNameOnPassport,
			passportType: values.passportType,
			issuedDate: values.issuedDate,
			expiryDate: values.expiryDate,
		};
		try {
			if (mode.value === 'create') {
				await createPassport(props.employeeId, payload);
				toast.success('Đã tạo hộ chiếu. Bạn có thể upload ảnh nếu cần.');
			} else {
				await updatePassport(props.employeeId, payload);
				toast.success('Cập nhật hộ chiếu thành công');
			}
			mode.value = 'view';
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không lưu được hộ chiếu');
		}
	});

	async function handleDelete() {
		try {
			await deletePassport(props.employeeId);
			toast.success('Đã xoá hộ chiếu');
			showDeleteConfirm.value = false;
			mode.value = 'view';
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Xoá hộ chiếu thất bại');
		}
	}

	const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
	const MAX_SIZE_MB = 5;
	const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

	function validateFile(file: File): string | null {
		if (!ACCEPTED_TYPES.includes(file.type)) return 'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP';
		if (file.size > MAX_SIZE_BYTES) return `Ảnh không được vượt quá ${MAX_SIZE_MB}MB`;
		return null;
	}

	async function onSelectPhoto(side: PassportPhotoSide, e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		const err = validateFile(file);
		if (err) {
			toast.error(err);
			return;
		}
		uploadingSide.value = side;
		try {
			await uploadPassportPhoto(props.employeeId, side, file);
			toast.success(`Đã cập nhật ảnh ${side === 'front' ? 'mặt trước' : 'mặt sau'}`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Upload ảnh thất bại');
		} finally {
			uploadingSide.value = null;
		}
	}

	async function handleDeletePhoto(side: PassportPhotoSide) {
		deletingSide.value = side;
		try {
			await deletePassportPhoto(props.employeeId, side);
			toast.success(`Đã xoá ảnh ${side === 'front' ? 'mặt trước' : 'mặt sau'}`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Xoá ảnh thất bại');
		} finally {
			deletingSide.value = null;
		}
	}

	function openPhoto(which: PassportPhotoSide) {
		const urls: string[] = [];
		const front = passport.value?.photoFrontUrl ?? null;
		const back = passport.value?.photoBackUrl ?? null;
		if (front) urls.push(front);
		if (back) urls.push(back);
		if (!urls.length) return;
		let idx = 0;
		if (which === 'back') idx = front ? 1 : 0;
		imageViewer.open(urls, idx);
	}

	const passportTypeOptions = computed(() =>
		passportTypes.value.length
			? passportTypes.value
			: [
					{ value: 'ORDINARY' as PassportType, label: 'Phổ thông' },
					{ value: 'DIPLOMATIC' as PassportType, label: 'Ngoại giao' },
					{ value: 'OFFICIAL' as PassportType, label: 'Công vụ' },
				],
	);

	const passportTypeLabel = computed(() =>
		passport.value ? metaDataStore.labelForPassportType(passport.value.passportType) : '',
	);

	const isExpiringSoon = computed(() => {
		const exp = passport.value?.expiryDate;
		if (!exp) return false;
		try {
			const days = differenceInDays(parseISO(exp), new Date());
			return days >= 0 && days < 180;
		} catch {
			return false;
		}
	});

	const isExpired = computed(() => {
		const exp = passport.value?.expiryDate;
		if (!exp) return false;
		try {
			return differenceInDays(parseISO(exp), new Date()) < 0;
		} catch {
			return false;
		}
	});

	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
	const valueCls = 'text-sm text-gray-900 dark:text-white';
	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50';
</script>

<template>
	<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
		<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
			<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Hộ chiếu</h3>
			<div v-if="mode === 'view' && passport" class="flex flex-wrap gap-2">
				<CommonAppButton v-if="canUpdate" size="sm" @click="startEdit">Chỉnh sửa</CommonAppButton>
				<CommonAppButton v-if="canDelete" size="sm" variant="danger_outline" @click="showDeleteConfirm = true">
					Xoá
				</CommonAppButton>
			</div>
		</div>

		<div v-if="!canRead" class="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
			Bạn không có quyền xem hộ chiếu của nhân viên khác.
		</div>

		<div v-else-if="passportLoading" class="p-6 space-y-4">
			<div class="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
			<div class="grid grid-cols-2 gap-4">
				<div v-for="i in 5" :key="i" class="space-y-1.5">
					<div class="h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
					<div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
				</div>
			</div>
		</div>

		<div
			v-else-if="!passport && mode !== 'create'"
			class="p-10 flex flex-col items-center gap-3 text-center"
		>
			<svg class="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
			</svg>
			<p class="text-sm text-gray-500 dark:text-gray-400">Nhân viên chưa có hộ chiếu.</p>
			<CommonAppButton v-if="canCreate" size="sm" @click="startCreate">Thêm hộ chiếu</CommonAppButton>
		</div>

		<form
			v-else-if="mode === 'create' || mode === 'edit'"
			class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5"
			@submit.prevent="onSubmit"
		>
			<div>
				<label :class="labelCls">Số hộ chiếu <span class="text-red-500">*</span></label>
				<input
					v-model="passportNumber"
					v-bind="passportNumberAttrs"
					maxlength="20"
					:class="[inputCls, errors.passportNumber ? 'border-red-400 focus:ring-red-300' : '']"
					placeholder="B1234567"
					@input="onPassportNumberInput"
				/>
				<p v-if="errors.passportNumber" class="mt-1 text-xs text-red-500">{{ errors.passportNumber }}</p>
			</div>

			<div>
				<label :class="labelCls">Loại hộ chiếu <span class="text-red-500">*</span></label>
				<UiSelect
					v-model="passportType"
					:options="passportTypeOptions"
					:error="errors.passportType"
				/>
			</div>

			<div class="sm:col-span-2">
				<label :class="labelCls">Họ tên trên hộ chiếu <span class="text-red-500">*</span></label>
				<input
					v-model="fullNameOnPassport"
					v-bind="fullNameAttrs"
					:class="[inputCls, errors.fullNameOnPassport ? 'border-red-400' : '']"
					placeholder="NGUYEN VAN A"
				/>
				<p v-if="errors.fullNameOnPassport" class="mt-1 text-xs text-red-500">{{ errors.fullNameOnPassport }}</p>
			</div>

			<div>
				<label :class="labelCls">Ngày cấp <span class="text-red-500">*</span></label>
				<UiDatePicker v-model="issuedDate" />
				<p v-if="errors.issuedDate" class="mt-1 text-xs text-red-500">{{ errors.issuedDate }}</p>
			</div>

			<div>
				<label :class="labelCls">Ngày hết hạn <span class="text-red-500">*</span></label>
				<UiDatePicker v-model="expiryDate" :min="minExpiryDate" />
				<p v-if="errors.expiryDate" class="mt-1 text-xs text-red-500">{{ errors.expiryDate }}</p>
			</div>

			<div class="sm:col-span-2 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 pt-4">
				<CommonAppButton type="button" variant="outline" @click="mode = 'view'">Hủy</CommonAppButton>
				<CommonAppButton type="submit" :loading="passportSubmitting">
					{{ mode === 'create' ? 'Tạo hộ chiếu' : 'Lưu thay đổi' }}
				</CommonAppButton>
			</div>
		</form>

		<div v-else-if="passport" class="p-6 space-y-6">
			<div v-if="isExpired" class="rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
				Hộ chiếu đã hết hạn ngày {{ formatDate(passport.expiryDate) }}.
			</div>
			<div v-else-if="isExpiringSoon" class="rounded-lg border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 px-4 py-2.5 text-sm text-orange-700 dark:text-orange-300">
				Hộ chiếu sắp hết hạn (còn dưới 6 tháng, hết hạn {{ formatDate(passport.expiryDate) }}).
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
				<div>
					<p :class="labelCls">Số hộ chiếu</p>
					<p :class="[valueCls, 'font-mono']">{{ passport.passportNumber }}</p>
				</div>
				<div>
					<p :class="labelCls">Loại hộ chiếu</p>
					<p :class="valueCls">{{ passportTypeLabel || passport.passportType }}</p>
				</div>
				<div class="sm:col-span-2 lg:col-span-1">
					<p :class="labelCls">Họ tên trên hộ chiếu</p>
					<p :class="valueCls">{{ passport.fullNameOnPassport }}</p>
				</div>
				<div>
					<p :class="labelCls">Ngày cấp</p>
					<p :class="valueCls">{{ formatDate(passport.issuedDate) }}</p>
				</div>
				<div>
					<p :class="labelCls">Ngày hết hạn</p>
					<p :class="valueCls">{{ formatDate(passport.expiryDate) }}</p>
				</div>
				<div>
					<p :class="labelCls">Cập nhật lần cuối</p>
					<p :class="valueCls">{{ formatDateTime(passport.updatedAt) }}</p>
				</div>
			</div>

			<div>
				<p :class="[labelCls, 'mb-2']">Ảnh hộ chiếu</p>
				<div class="grid grid-cols-2 gap-4 max-w-2xl">
					<div v-for="side in (['front', 'back'] as PassportPhotoSide[])" :key="side">
						<p class="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
							{{ side === 'front' ? 'Mặt trước' : 'Mặt sau' }}
						</p>
						<div
							class="aspect-[3/4] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center relative group"
						>
							<img
								v-if="side === 'front' ? passport.photoFrontUrl : passport.photoBackUrl"
								:src="(side === 'front' ? passport.photoFrontUrl : passport.photoBackUrl) as string"
								class="w-full h-full object-contain cursor-pointer"
								:alt="`Hộ chiếu ${side}`"
								@click="openPhoto(side)"
							/>
							<span v-else class="text-xs text-gray-400 italic">Chưa có ảnh</span>

							<div v-if="uploadingSide === side" class="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs">
								Đang tải…
							</div>
						</div>

						<div v-if="canUpdate" class="mt-2 flex flex-wrap gap-2 text-xs">
							<label class="cursor-pointer px-2.5 py-1 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium text-gray-700 dark:text-gray-300">
								{{ (side === 'front' ? passport.photoFrontUrl : passport.photoBackUrl) ? 'Thay ảnh' : 'Thêm ảnh' }}
								<input
									type="file"
									class="sr-only"
									accept=".jpg,.jpeg,.png,.webp"
									:disabled="uploadingSide === side"
									@change="e => onSelectPhoto(side, e)"
								/>
							</label>
							<button
								v-if="(side === 'front' ? passport.photoFrontUrl : passport.photoBackUrl) && canUpdate"
								type="button"
								class="px-2.5 py-1 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium disabled:opacity-50"
								:disabled="deletingSide === side"
								@click="handleDeletePhoto(side)"
							>
								{{ deletingSide === side ? '...' : 'Xoá ảnh' }}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>

		<Teleport to="body">
			<Transition
				enter-active-class="transition ease-out duration-150"
				enter-from-class="opacity-0"
				enter-to-class="opacity-100"
				leave-active-class="transition ease-in duration-100"
				leave-from-class="opacity-100"
				leave-to-class="opacity-0"
			>
				<div
					v-if="showDeleteConfirm"
					class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
					@click.self="showDeleteConfirm = false"
				>
					<div
						class="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl border border-gray-200 dark:border-gray-700"
					>
						<h3 class="font-semibold text-gray-900 dark:text-white">Xoá hộ chiếu?</h3>
						<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
							Bản ghi hộ chiếu sẽ bị xoá khỏi hệ thống. Hành động này không thể hoàn tác.
						</p>
						<div class="flex justify-end gap-3 mt-5">
							<CommonAppButton variant="outline" @click="showDeleteConfirm = false">Hủy</CommonAppButton>
							<CommonAppButton variant="danger" :loading="passportSubmitting" @click="handleDelete">
								Xoá
							</CommonAppButton>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>
	</div>
</template>
