<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type { CreateCitizenIdPayload } from '~/types/employee-citizen-id.types';
	import EmployeeCitizenIdPhotosModal from '~/components/modules/employee/EmployeeCitizenIdPhotosModal.vue';
	import EmployeeCitizenIdHistoryDrawer from '~/components/modules/employee/EmployeeCitizenIdHistoryDrawer.vue';

	const props = defineProps<{ employeeId: number }>();

	const toast = useToast();
	const imageViewer = useImageViewerStore();
	const authStore = useAuthStore();
	const { hasPermission } = usePermissions();

	const {
		citizenId,
		citizenIdLoading,
		citizenIdSubmitting,
		fetchCitizenId,
		createCitizenId,
		updateCitizenId,
		deleteCitizenId,
	} = useEmployeeIdentity();

	const isSelf = computed(() => authStore.user?.id === props.employeeId);
	const canRead = computed(() => isSelf.value || hasPermission('employee:citizen-id:read'));
	const canCreate = computed(() => hasPermission('employee:citizen-id:create'));
	const canUpdate = computed(() => hasPermission('employee:citizen-id:update'));
	const canDelete = computed(() => hasPermission('employee:citizen-id:delete'));

	const mode = ref<'view' | 'edit' | 'create'>('view');
	const showPhotosModal = ref(false);
	const showHistory = ref(false);
	const showDeleteConfirm = ref(false);
	const originalCitizenIdNumber = ref<string | null>(null);
	const errorMessage = ref<string | null>(null);

	async function loadCitizenId() {
		errorMessage.value = null;
		try {
			await fetchCitizenId(props.employeeId);
		} catch (e) {
			const msg = e instanceof Error ? e.message : 'Không tải được CCCD';
			errorMessage.value = msg;
			toast.error(msg);
		}
	}

	onMounted(() => loadCitizenId());

	const schema = toTypedSchema(
		z.object({
			citizenIdNumber: z.string().regex(/^\d{12}$/, 'Số CCCD phải đúng 12 chữ số'),
			fullNameOnCard: z
				.string()
				.max(100, 'Tối đa 100 ký tự')
				.optional()
				.or(z.literal('')),
			issuedDate: z.string().min(1, 'Vui lòng chọn ngày cấp'),
			issuedPlace: z
				.string()
				.optional()
				.refine(v => !v || (v.length >= 10 && v.length <= 255), 'Nơi cấp phải có 10–255 ký tự'),
			hometown: z.string().max(255, 'Tối đa 255 ký tự').optional().or(z.literal('')),
			permanentAddress: z.string().optional().or(z.literal('')),
			temporaryAddress: z.string().optional().or(z.literal('')),
			currentAddress: z.string().optional().or(z.literal('')),
		}),
	);

	const { handleSubmit, defineField, errors, resetForm } = useForm<{
		citizenIdNumber: string;
		fullNameOnCard: string;
		issuedDate: string;
		issuedPlace: string;
		hometown: string;
		permanentAddress: string;
		temporaryAddress: string;
		currentAddress: string;
	}>({
		validationSchema: schema,
		initialValues: {
			citizenIdNumber: '',
			fullNameOnCard: '',
			issuedDate: '',
			issuedPlace: '',
			hometown: '',
			permanentAddress: '',
			temporaryAddress: '',
			currentAddress: '',
		},
	});

	const [citizenIdNumber, citizenIdNumberAttrs] = defineField('citizenIdNumber');
	const [fullNameOnCard, fullNameAttrs] = defineField('fullNameOnCard');
	const [issuedDate] = defineField('issuedDate');
	const [issuedPlace, issuedPlaceAttrs] = defineField('issuedPlace');
	const [hometown, hometownAttrs] = defineField('hometown');
	const [permanentAddress, permAddrAttrs] = defineField('permanentAddress');
	const [temporaryAddress, tempAddrAttrs] = defineField('temporaryAddress');
	const [currentAddress, currAddrAttrs] = defineField('currentAddress');

	function onCitizenIdInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const cleaned = input.value.replace(/\D/g, '').slice(0, 12);
		citizenIdNumber.value = cleaned;
		input.value = cleaned;
	}

	function fillFromCitizenId() {
		const c = citizenId.value;
		if (!c) return;
		resetForm({
			values: {
				citizenIdNumber: c.citizenIdNumber,
				fullNameOnCard: c.fullNameOnCard ?? '',
				issuedDate: c.issuedDate,
				issuedPlace: c.issuedPlace ?? '',
				hometown: c.hometown ?? '',
				permanentAddress: c.permanentAddress ?? '',
				temporaryAddress: c.temporaryAddress ?? '',
				currentAddress: c.currentAddress ?? '',
			},
		});
		originalCitizenIdNumber.value = c.citizenIdNumber;
	}

	function startCreate() {
		if (!canCreate.value) {
			toast.error('Bạn không có quyền tạo CCCD');
			return;
		}
		resetForm();
		originalCitizenIdNumber.value = null;
		mode.value = 'create';
	}

	function startEdit() {
		if (!canUpdate.value) {
			toast.error('Bạn không có quyền cập nhật CCCD');
			return;
		}
		fillFromCitizenId();
		mode.value = 'edit';
	}

	function cancelEdit() {
		mode.value = 'view';
	}

	const onSubmit = handleSubmit(async values => {
		if (
			mode.value === 'edit' &&
			originalCitizenIdNumber.value &&
			values.citizenIdNumber !== originalCitizenIdNumber.value &&
			!window.confirm('Đổi số CCCD sẽ được ghi vào lịch sử. Bạn chắc chắn?')
		) {
			return;
		}

		const payload: CreateCitizenIdPayload = {
			citizenIdNumber: values.citizenIdNumber,
			issuedDate: values.issuedDate,
			fullNameOnCard: values.fullNameOnCard || undefined,
			issuedPlace: values.issuedPlace || undefined,
			hometown: values.hometown || undefined,
			permanentAddress: values.permanentAddress || undefined,
			temporaryAddress: values.temporaryAddress || undefined,
			currentAddress: values.currentAddress || undefined,
		};

		try {
			if (mode.value === 'create') {
				await createCitizenId(props.employeeId, payload);
				toast.success('Đã tạo CCCD. Tiếp tục upload ảnh mặt trước & mặt sau.');
				mode.value = 'view';
				if (canUpdate.value) showPhotosModal.value = true;
			} else {
				await updateCitizenId(props.employeeId, payload);
				toast.success('Cập nhật CCCD thành công');
				mode.value = 'view';
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không lưu được thông tin CCCD');
		}
	});

	async function handleDelete() {
		try {
			await deleteCitizenId(props.employeeId);
			toast.success('Đã xoá CCCD');
			showDeleteConfirm.value = false;
			mode.value = 'view';
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Xoá CCCD thất bại');
		}
	}

	function openPhoto(which: 'front' | 'back') {
		const urls: string[] = [];
		const front = citizenId.value?.frontPhotoUrl ?? null;
		const back = citizenId.value?.backPhotoUrl ?? null;
		if (front) urls.push(front);
		if (back) urls.push(back);
		if (!urls.length) return;
		let idx = 0;
		if (which === 'back') idx = front ? 1 : 0;
		imageViewer.open(urls, idx);
	}

	async function onPhotosUploaded() {
		showPhotosModal.value = false;
		toast.success('Đã cập nhật ảnh CCCD');
		await loadCitizenId();
	}

	const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
	const valueCls = 'text-sm text-gray-900 dark:text-white';
	const inputCls =
		'block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50';
</script>

<template>
	<div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
		<div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
			<h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Căn cước công dân</h3>
			<div v-if="mode === 'view' && citizenId" class="flex flex-wrap gap-2">
				<CommonAppButton size="sm" variant="outline" @click="showHistory = true">
					Lịch sử
				</CommonAppButton>
				<CommonAppButton v-if="canUpdate" size="sm" variant="outline" @click="showPhotosModal = true">
					Cập nhật ảnh
				</CommonAppButton>
				<CommonAppButton v-if="canUpdate" size="sm" @click="startEdit">Chỉnh sửa</CommonAppButton>
				<CommonAppButton v-if="canDelete" size="sm" variant="danger_outline" @click="showDeleteConfirm = true">
					Xoá
				</CommonAppButton>
			</div>
		</div>

		<div v-if="!canRead" class="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
			Bạn không có quyền xem CCCD của nhân viên khác.
		</div>

		<div v-else-if="citizenIdLoading" class="p-6 space-y-4">
			<div class="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
			<div class="grid grid-cols-2 gap-4">
				<div v-for="i in 6" :key="i" class="space-y-1.5">
					<div class="h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
					<div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
				</div>
			</div>
		</div>

		<!-- No record → empty state -->
		<div
			v-else-if="!citizenId && mode !== 'create'"
			class="p-10 flex flex-col items-center gap-3 text-center"
		>
			<svg
				class="w-12 h-12 text-gray-300 dark:text-gray-600"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M6 16h2m4 0h6M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z" />
			</svg>
			<p class="text-sm text-gray-500 dark:text-gray-400">Chưa có thông tin CCCD.</p>
			<CommonAppButton v-if="canCreate" size="sm" @click="startCreate">Tạo CCCD</CommonAppButton>
			<p v-else class="text-xs text-gray-400">Cần quyền <code>employee:citizen-id:create</code> để tạo.</p>
		</div>

		<!-- Create / Edit form -->
		<form
			v-else-if="mode === 'create' || mode === 'edit'"
			class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5"
			@submit.prevent="onSubmit"
		>
			<div>
				<label :class="labelCls">Số CCCD <span class="text-red-500">*</span></label>
				<input
					v-model="citizenIdNumber"
					v-bind="citizenIdNumberAttrs"
					inputmode="numeric"
					maxlength="12"
					:class="[inputCls, errors.citizenIdNumber ? 'border-red-400 focus:ring-red-300' : '']"
					placeholder="12 chữ số"
					@input="onCitizenIdInput"
				/>
				<p class="mt-1 text-xs text-gray-400">{{ citizenIdNumber?.length ?? 0 }}/12 chữ số</p>
				<p v-if="errors.citizenIdNumber" class="mt-1 text-xs text-red-500">{{ errors.citizenIdNumber }}</p>
			</div>

			<div>
				<label :class="labelCls">Họ tên trên CCCD</label>
				<input
					v-model="fullNameOnCard"
					v-bind="fullNameAttrs"
					:class="[inputCls, errors.fullNameOnCard ? 'border-red-400' : '']"
					placeholder="NGUYỄN VĂN A"
				/>
				<p v-if="errors.fullNameOnCard" class="mt-1 text-xs text-red-500">{{ errors.fullNameOnCard }}</p>
			</div>

			<div>
				<label :class="labelCls">Ngày cấp <span class="text-red-500">*</span></label>
				<UiDatePicker v-model="issuedDate" />
				<p v-if="errors.issuedDate" class="mt-1 text-xs text-red-500">{{ errors.issuedDate }}</p>
			</div>

			<div>
				<label :class="labelCls">Nơi cấp</label>
				<input
					v-model="issuedPlace"
					v-bind="issuedPlaceAttrs"
					:class="[inputCls, errors.issuedPlace ? 'border-red-400' : '']"
					placeholder="Cục Cảnh sát QLHC về TTXH"
				/>
				<p v-if="errors.issuedPlace" class="mt-1 text-xs text-red-500">{{ errors.issuedPlace }}</p>
			</div>

			<div>
				<label :class="labelCls">Quê quán</label>
				<input
					v-model="hometown"
					v-bind="hometownAttrs"
					:class="[inputCls, errors.hometown ? 'border-red-400' : '']"
					placeholder="Xã X, Huyện Y, Tỉnh Z"
				/>
				<p v-if="errors.hometown" class="mt-1 text-xs text-red-500">{{ errors.hometown }}</p>
			</div>

			<div class="sm:col-span-2">
				<label :class="labelCls">Địa chỉ thường trú</label>
				<textarea
					v-model="permanentAddress"
					v-bind="permAddrAttrs"
					:class="inputCls"
					rows="2"
				/>
			</div>

			<div class="sm:col-span-2">
				<label :class="labelCls">Địa chỉ tạm trú</label>
				<textarea v-model="temporaryAddress" v-bind="tempAddrAttrs" :class="inputCls" rows="2" />
			</div>

			<div class="sm:col-span-2">
				<label :class="labelCls">Địa chỉ hiện tại</label>
				<textarea v-model="currentAddress" v-bind="currAddrAttrs" :class="inputCls" rows="2" />
			</div>

			<div class="sm:col-span-2 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 pt-4">
				<CommonAppButton
					v-if="mode === 'edit'"
					type="button"
					variant="outline"
					@click="cancelEdit"
				>
					Hủy
				</CommonAppButton>
				<CommonAppButton v-else type="button" variant="outline" @click="mode = 'view'">Hủy</CommonAppButton>
				<CommonAppButton type="submit" :loading="citizenIdSubmitting">
					{{ mode === 'create' ? 'Tạo CCCD' : 'Lưu thay đổi' }}
				</CommonAppButton>
			</div>
		</form>

		<!-- View mode -->
		<div v-else-if="citizenId" class="p-6 space-y-6">
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
				<div>
					<p :class="labelCls">Số CCCD</p>
					<p :class="[valueCls, 'font-mono']">{{ citizenId.citizenIdNumber }}</p>
				</div>
				<div>
					<p :class="labelCls">Họ tên trên CCCD</p>
					<p :class="valueCls">{{ citizenId.fullNameOnCard ?? '—' }}</p>
				</div>
				<div>
					<p :class="labelCls">Ngày cấp</p>
					<p :class="valueCls">{{ formatDate(citizenId.issuedDate) }}</p>
				</div>
				<div class="sm:col-span-2">
					<p :class="labelCls">Nơi cấp</p>
					<p :class="valueCls">{{ citizenId.issuedPlace ?? '—' }}</p>
				</div>
				<div>
					<p :class="labelCls">Quê quán</p>
					<p :class="valueCls">{{ citizenId.hometown ?? '—' }}</p>
				</div>
				<div class="sm:col-span-3">
					<p :class="labelCls">Địa chỉ thường trú</p>
					<p :class="valueCls">{{ citizenId.permanentAddress ?? '—' }}</p>
				</div>
				<div class="sm:col-span-3">
					<p :class="labelCls">Địa chỉ tạm trú</p>
					<p :class="valueCls">{{ citizenId.temporaryAddress ?? '—' }}</p>
				</div>
				<div class="sm:col-span-3">
					<p :class="labelCls">Địa chỉ hiện tại</p>
					<p :class="valueCls">{{ citizenId.currentAddress ?? '—' }}</p>
				</div>
				<div>
					<p :class="labelCls">Cập nhật lần cuối</p>
					<p :class="valueCls">{{ formatDateTime(citizenId.updatedAt) }}</p>
				</div>
			</div>

			<div>
				<p :class="[labelCls, 'mb-2']">Ảnh CCCD</p>
				<div class="grid grid-cols-2 gap-4 max-w-2xl">
					<div>
						<p class="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Mặt trước</p>
						<div
							class="aspect-[16/10] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center"
							:class="citizenId.frontPhotoUrl ? 'cursor-pointer hover:opacity-80' : ''"
							@click="openPhoto('front')"
						>
							<img
								v-if="citizenId.frontPhotoUrl"
								:src="citizenId.frontPhotoUrl"
								alt="CCCD mặt trước"
								class="w-full h-full object-contain"
							/>
							<span v-else class="text-xs text-gray-400 italic">Chưa có ảnh</span>
						</div>
					</div>
					<div>
						<p class="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Mặt sau</p>
						<div
							class="aspect-[16/10] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center"
							:class="citizenId.backPhotoUrl ? 'cursor-pointer hover:opacity-80' : ''"
							@click="openPhoto('back')"
						>
							<img
								v-if="citizenId.backPhotoUrl"
								:src="citizenId.backPhotoUrl"
								alt="CCCD mặt sau"
								class="w-full h-full object-contain"
							/>
							<span v-else class="text-xs text-gray-400 italic">Chưa có ảnh</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Photos modal -->
		<EmployeeCitizenIdPhotosModal
			v-if="showPhotosModal && citizenId"
			:employee-id="employeeId"
			:current-front-url="citizenId.frontPhotoUrl"
			:current-back-url="citizenId.backPhotoUrl"
			@uploaded="onPhotosUploaded"
			@close="showPhotosModal = false"
		/>

		<!-- History drawer -->
		<EmployeeCitizenIdHistoryDrawer
			v-if="showHistory"
			:employee-id="employeeId"
			@close="showHistory = false"
		/>

		<!-- Delete confirm -->
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
						<h3 class="font-semibold text-gray-900 dark:text-white">Xoá CCCD?</h3>
						<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
							Bản ghi CCCD sẽ bị xoá khỏi hệ thống. Hành động này không thể hoàn tác.
						</p>
						<div class="flex justify-end gap-3 mt-5">
							<CommonAppButton variant="outline" @click="showDeleteConfirm = false">Hủy</CommonAppButton>
							<CommonAppButton variant="danger" :loading="citizenIdSubmitting" @click="handleDelete">
								Xoá
							</CommonAppButton>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>
	</div>
</template>
