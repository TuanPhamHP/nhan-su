<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useAssetService } from '~/services/asset.service';
	import { asAssetEnum, assetNumberField, toAssetNumber, toAssetText } from '~/utils/asset.utils';
	import {
		ASSET_ACCOUNTING_CLASS_LABELS,
		ASSET_BILLING_CYCLE_LABELS,
		ASSET_CONDITION_LABELS,
		ASSET_PRICING_UNIT_LABELS,
		type Asset,
		type AssetAccountingClass,
		type AssetBillingCycle,
		type AssetCategory,
		type AssetCondition,
		type AssetKind,
		type AssetPricingUnit,
		type AssetVendor,
		type CreateAssetBody,
		type UpdateAssetBody,
	} from '~/types/asset.types';

	const props = withDefaults(
		defineProps<{
			/** Có `asset` là sửa, không có là tạo mới. */
			asset?: Asset | null;
			defaultKind?: AssetKind;
		}>(),
		{ asset: null, defaultKind: 'PHYSICAL' },
	);

	const emit = defineEmits<{
		saved: [asset: Asset];
		close: [];
	}>();

	const toast = useToast();
	const service = useAssetService();
	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);

	const isEdit = computed(() => !!props.asset);
	/** `PATCH` không nhận `kind`, nên sửa thì khoá luôn ô chọn họ tài sản. */
	const kind = ref<AssetKind>(props.asset?.kind ?? props.defaultKind);
	const isService = computed(() => kind.value === 'SERVICE');

	const categories = ref<AssetCategory[]>([]);
	const vendors = ref<AssetVendor[]>([]);
	const loadingRefs = ref(true);

	/**
	 * Chỉ kiểm ở FE những thứ không gửi đi được nếu thiếu.
	 *
	 * Serial bắt buộc, tỷ giá ngoại tệ, ghi chú thanh toán có đủ số thẻ... đều do BE kiểm
	 * và trả mã lỗi riêng; chép lại luật đó ở đây là tự tạo một bản sao sẽ lệch.
	 */
	const schema = toTypedSchema(
		z
			.object({
				name: z.string().min(1, 'Nhập tên tài sản'),
				categoryId: z.number({ invalid_type_error: 'Chọn loại tài sản' }).optional(),
				vendorId: z.number().optional(),
				code: z.string().optional(),
				purchaseDate: z.string().optional(),
				cost: assetNumberField,
				currency: z.string().optional(),
				exchangeRate: assetNumberField,
				note: z.string().optional(),
				// thiết bị
				manufacturer: z.string().optional(),
				model: z.string().optional(),
				serialNumber: z.string().optional(),
				location: z.string().optional(),
				condition: z.string().optional(),
				warrantyMonths: assetNumberField,
				warrantyEndDate: z.string().optional(),
				depreciationStartDate: z.string().optional(),
				depreciationMonths: assetNumberField,
				salvageValue: assetNumberField,
				accountingClass: z.string().optional(),
				// dịch vụ
				billingCycle: z.string().optional(),
				ownerId: z.number().optional(),
				nextRenewalDate: z.string().optional(),
				anchorDay: assetNumberField,
				plan: z.string().optional(),
				seatCount: assetNumberField,
				unitPrice: assetNumberField,
				pricingUnit: z.string().optional(),
				autoRenew: z.boolean().optional(),
				adminAccount: z.string().optional(),
				adminUrl: z.string().optional(),
				passwordManagerUrl: z.string().optional(),
				paymentMethodNote: z.string().optional(),
				technicalInfo: z.string().optional(),
				licenseKey: z.string().optional(),
			})
			.superRefine((v, ctx) => {
				if (!v.categoryId) {
					ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['categoryId'], message: 'Chọn loại tài sản' });
				}
				if (kind.value !== 'SERVICE') return;
				if (!v.billingCycle) {
					ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['billingCycle'], message: 'Chọn chu kỳ thanh toán' });
				}
				if (!v.ownerId) {
					ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ownerId'], message: 'Chọn người phụ trách' });
				}
			}),
	);

	const a = props.asset;
	const { handleSubmit, defineField, errors, isSubmitting } = useForm({
		validationSchema: schema,
		initialValues: {
			name: a?.name ?? '',
			categoryId: a?.category.id,
			vendorId: a?.vendor?.id,
			code: a?.code ?? '',
			purchaseDate: a?.purchaseDate ?? '',
			cost: a?.cost != null ? String(a.cost) : '',
			currency: a?.currency ?? 'VND',
			exchangeRate: a?.exchangeRate != null ? String(a.exchangeRate) : '',
			note: a?.note ?? '',
			manufacturer: a?.physical?.manufacturer ?? '',
			model: a?.physical?.model ?? '',
			serialNumber: a?.physical?.serialNumber ?? '',
			location: a?.physical?.location ?? '',
			condition: a?.physical?.condition ?? '',
			warrantyMonths: a?.physical?.warrantyMonths != null ? String(a.physical.warrantyMonths) : '',
			warrantyEndDate: a?.physical?.warrantyEndDate ?? '',
			depreciationStartDate: a?.physical?.depreciationStartDate ?? '',
			depreciationMonths:
				a?.physical?.depreciationMonths != null ? String(a.physical.depreciationMonths) : '',
			salvageValue: a?.physical?.salvageValue != null ? String(a.physical.salvageValue) : '',
			accountingClass: a?.physical?.accountingClass ?? '',
			billingCycle: a?.service?.billingCycle ?? 'MONTHLY',
			ownerId: a?.service?.owner.id,
			nextRenewalDate: a?.service?.nextRenewalDate ?? '',
			anchorDay: a?.service?.anchorDay != null ? String(a.service.anchorDay) : '',
			plan: a?.service?.plan ?? '',
			seatCount: a?.service?.seatCount != null ? String(a.service.seatCount) : '',
			unitPrice: a?.service?.unitPrice != null ? String(a.service.unitPrice) : '',
			pricingUnit: a?.service?.pricingUnit ?? 'PER_SEAT',
			autoRenew: a?.service?.autoRenew ?? false,
			adminAccount: a?.service?.adminAccount ?? '',
			adminUrl: a?.service?.adminUrl ?? '',
			passwordManagerUrl: a?.service?.passwordManagerUrl ?? '',
			paymentMethodNote: a?.service?.paymentMethodNote ?? '',
			technicalInfo: a?.service?.technicalInfo ?? '',
			licenseKey: '',
		},
	});

	const [name, nameAttrs] = defineField('name');
	const [categoryId, categoryIdAttrs] = defineField('categoryId');
	const [vendorId, vendorIdAttrs] = defineField('vendorId');
	const [code, codeAttrs] = defineField('code');
	const [purchaseDate, purchaseDateAttrs] = defineField('purchaseDate');
	const [cost, costAttrs] = defineField('cost');
	const [currency, currencyAttrs] = defineField('currency');
	const [exchangeRate, exchangeRateAttrs] = defineField('exchangeRate');
	const [note, noteAttrs] = defineField('note');
	const [manufacturer, manufacturerAttrs] = defineField('manufacturer');
	const [model, modelAttrs] = defineField('model');
	const [serialNumber, serialNumberAttrs] = defineField('serialNumber');
	const [location, locationAttrs] = defineField('location');
	const [condition, conditionAttrs] = defineField('condition');
	const [warrantyMonths, warrantyMonthsAttrs] = defineField('warrantyMonths');
	const [warrantyEndDate, warrantyEndDateAttrs] = defineField('warrantyEndDate');
	const [depreciationStartDate, depreciationStartDateAttrs] = defineField('depreciationStartDate');
	const [depreciationMonths, depreciationMonthsAttrs] = defineField('depreciationMonths');
	const [salvageValue, salvageValueAttrs] = defineField('salvageValue');
	const [accountingClass, accountingClassAttrs] = defineField('accountingClass');
	const [billingCycle, billingCycleAttrs] = defineField('billingCycle');
	const [ownerId, ownerIdAttrs] = defineField('ownerId');
	const [nextRenewalDate, nextRenewalDateAttrs] = defineField('nextRenewalDate');
	const [anchorDay, anchorDayAttrs] = defineField('anchorDay');
	const [plan, planAttrs] = defineField('plan');
	const [seatCount, seatCountAttrs] = defineField('seatCount');
	const [unitPrice, unitPriceAttrs] = defineField('unitPrice');
	const [pricingUnit, pricingUnitAttrs] = defineField('pricingUnit');
	const [autoRenew, autoRenewAttrs] = defineField('autoRenew');
	const [adminAccount, adminAccountAttrs] = defineField('adminAccount');
	const [adminUrl, adminUrlAttrs] = defineField('adminUrl');
	const [passwordManagerUrl, passwordManagerUrlAttrs] = defineField('passwordManagerUrl');
	const [paymentMethodNote, paymentMethodNoteAttrs] = defineField('paymentMethodNote');
	const [technicalInfo, technicalInfoAttrs] = defineField('technicalInfo');
	const [licenseKey, licenseKeyAttrs] = defineField('licenseKey');

	const categoryOptions = computed(() =>
		categories.value
			.filter(c => c.kind === kind.value && (c.isActive || c.id === props.asset?.category.id))
			.map(c => ({ value: c.id, label: `${c.groupName} → ${c.name}` })),
	);
	const vendorOptions = computed(() => [
		{ value: 0, label: 'Không chọn' },
		...vendors.value.map(v => ({ value: v.id, label: v.name })),
	]);
	const employeeOptions = computed(() =>
		employees.value.map(e => ({ value: e.id, label: `${e.fullName} · ${e.employeeCode}` })),
	);

	const conditionOptions = [
		{ value: '', label: 'Không ghi' },
		...Object.entries(ASSET_CONDITION_LABELS).map(([value, label]) => ({ value, label })),
	];
	const accountingClassOptions = [
		{ value: '', label: 'Để hệ thống gợi ý' },
		...Object.entries(ASSET_ACCOUNTING_CLASS_LABELS).map(([value, label]) => ({ value, label })),
	];
	const billingCycleOptions = Object.entries(ASSET_BILLING_CYCLE_LABELS).map(([value, label]) => ({
		value,
		label,
	}));
	const pricingUnitOptions = Object.entries(ASSET_PRICING_UNIT_LABELS).map(([value, label]) => ({
		value,
		label,
	}));

	/** Loại đang chọn có bắt buộc serial không — để gắn dấu sao, BE vẫn là nơi chặn thật. */
	const requiresSerial = computed(
		() => categories.value.find(c => c.id === categoryId.value)?.requireSerial ?? false,
	);

	onMounted(async () => {
		try {
			const [cats, vends] = await Promise.all([
				service.findCategories(),
				service.findVendors({ isActive: true }),
			]);
			categories.value = cats;
			vendors.value = vends;
			await directoryStore.load();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không tải được danh mục');
		} finally {
			loadingRefs.value = false;
		}
	});

	// Đổi họ tài sản thì loại đang chọn không còn hợp lệ nữa.
	watch(kind, () => {
		if (!categoryOptions.value.some(o => o.value === categoryId.value)) categoryId.value = undefined;
	});

	const num = toAssetNumber;
	const str = toAssetText;

	const CONDITIONS = Object.keys(ASSET_CONDITION_LABELS) as AssetCondition[];
	const ACCOUNTING_CLASSES = Object.keys(ASSET_ACCOUNTING_CLASS_LABELS) as AssetAccountingClass[];
	const BILLING_CYCLES = Object.keys(ASSET_BILLING_CYCLE_LABELS) as AssetBillingCycle[];
	const PRICING_UNITS = Object.keys(ASSET_PRICING_UNIT_LABELS) as AssetPricingUnit[];

	const onSubmit = handleSubmit(async v => {
		const body: CreateAssetBody = {
			kind: kind.value,
			name: v.name,
			categoryId: v.categoryId as number,
			vendorId: v.vendorId || undefined,
			code: str(v.code),
			purchaseDate: str(v.purchaseDate),
			cost: num(v.cost),
			currency: str(v.currency),
			exchangeRate: num(v.exchangeRate),
			note: str(v.note),
		};

		if (kind.value === 'PHYSICAL') {
			body.physical = {
				manufacturer: str(v.manufacturer),
				model: str(v.model),
				serialNumber: str(v.serialNumber),
				location: str(v.location),
				condition: asAssetEnum(v.condition, CONDITIONS),
				warrantyMonths: num(v.warrantyMonths),
				warrantyEndDate: str(v.warrantyEndDate),
				depreciationStartDate: str(v.depreciationStartDate),
				depreciationMonths: num(v.depreciationMonths),
				salvageValue: num(v.salvageValue),
				accountingClass: asAssetEnum(v.accountingClass, ACCOUNTING_CLASSES),
			};
		} else {
			body.service = {
				billingCycle: asAssetEnum(v.billingCycle, BILLING_CYCLES) ?? 'MONTHLY',
				ownerId: v.ownerId as number,
				nextRenewalDate: str(v.nextRenewalDate),
				anchorDay: num(v.anchorDay),
				plan: str(v.plan),
				seatCount: num(v.seatCount),
				unitPrice: num(v.unitPrice),
				pricingUnit: asAssetEnum(v.pricingUnit, PRICING_UNITS),
				autoRenew: v.autoRenew ?? false,
				adminAccount: str(v.adminAccount),
				adminUrl: str(v.adminUrl),
				passwordManagerUrl: str(v.passwordManagerUrl),
				paymentMethodNote: str(v.paymentMethodNote),
				technicalInfo: str(v.technicalInfo),
				// License key chỉ gửi lúc tạo; sửa thì dùng nút riêng ở trang chi tiết.
				licenseKey: isEdit.value ? undefined : str(v.licenseKey),
			};
		}

		try {
			let saved: Asset;
			if (props.asset) {
				// `PATCH` không nhận `kind`, và khối `service` của nó không nhận `licenseKey`.
				const { kind: _kind, service: svc, ...rest } = body;
				const patch: UpdateAssetBody = { ...rest };
				if (svc) {
					const { licenseKey: _key, ...svcRest } = svc;
					patch.service = svcRest;
				}
				saved = await service.update(props.asset.id, patch);
			} else {
				saved = await service.create(body);
			}
			toast.success(props.asset ? 'Đã lưu thay đổi' : 'Đã tạo tài sản');
			emit('saved', saved);
		} catch (e) {
			// Lỗi nghiệp vụ (serial bắt buộc, thiếu tỷ giá, ghi đủ số thẻ...) để nguyên form.
			toast.error(e instanceof Error ? e.message : 'Lưu thất bại');
		}
	});

	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-3xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div
					class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700"
				>
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">
						{{ isEdit ? `Sửa ${asset?.code}` : 'Thêm tài sản' }}
					</h2>
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

				<form class="space-y-5 p-6" @submit.prevent="onSubmit">
					<!-- Họ tài sản: sửa thì khoá vì PATCH không nhận `kind` -->
					<div v-if="!isEdit" class="flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-600">
						<button
							type="button"
							:class="[
								'flex-1 rounded-md px-3 py-1.5 text-sm transition',
								kind === 'PHYSICAL' ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-300',
							]"
							@click="kind = 'PHYSICAL'"
						>
							Thiết bị
						</button>
						<button
							type="button"
							:class="[
								'flex-1 rounded-md px-3 py-1.5 text-sm transition',
								kind === 'SERVICE' ? 'bg-brand-600 text-white' : 'text-gray-600 dark:text-gray-300',
							]"
							@click="kind = 'SERVICE'"
						>
							Dịch vụ thuê bao
						</button>
					</div>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1 sm:col-span-2">
							<label :class="labelCls">Tên tài sản <span class="text-red-500">*</span></label>
							<input v-model="name" v-bind="nameAttrs" type="text" :class="inputCls" placeholder="VD: MacBook Pro 14 M3" />
							<p v-if="errors.name" class="text-xs text-red-500">{{ errors.name }}</p>
						</div>

						<div class="space-y-1">
							<label :class="labelCls">Loại tài sản <span class="text-red-500">*</span></label>
							<UiSelectInput
								v-model="categoryId"
								v-bind="categoryIdAttrs"
								:options="categoryOptions"
								:placeholder="loadingRefs ? 'Đang tải…' : 'Chọn Nhóm → Loại'"
							/>
							<p v-if="errors.categoryId" class="text-xs text-red-500">{{ errors.categoryId }}</p>
						</div>

						<div class="space-y-1">
							<label :class="labelCls">Nhà cung cấp</label>
							<UiSelectInput v-model="vendorId" v-bind="vendorIdAttrs" :options="vendorOptions" placeholder="Không chọn" />
						</div>

						<div class="space-y-1">
							<label :class="labelCls">Mã tài sản</label>
							<input v-model="code" v-bind="codeAttrs" type="text" :class="inputCls" :disabled="isEdit" placeholder="Bỏ trống để hệ thống tự sinh" />
						</div>

						<div class="space-y-1">
							<label :class="labelCls">Ngày mua</label>
							<UiDatePicker v-model="purchaseDate" v-bind="purchaseDateAttrs" />
						</div>

						<div class="space-y-1">
							<label :class="labelCls">Nguyên giá</label>
							<input v-model="cost" v-bind="costAttrs" type="number" min="0" step="any" :class="inputCls" placeholder="0" />
						</div>

						<div class="grid grid-cols-2 gap-3">
							<div class="space-y-1">
								<label :class="labelCls">Tiền tệ</label>
								<input v-model="currency" v-bind="currencyAttrs" type="text" maxlength="3" :class="inputCls" placeholder="VND" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Tỷ giá</label>
								<input v-model="exchangeRate" v-bind="exchangeRateAttrs" type="number" min="0" step="any" :class="inputCls" placeholder="Khác VND thì bắt buộc" />
							</div>
						</div>
					</div>

					<!-- ── Thiết bị ──────────────────────────────────────────────────── -->
					<fieldset v-if="!isService" class="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
						<legend class="px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Thông tin thiết bị</legend>

						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div class="space-y-1">
								<label :class="labelCls">Hãng</label>
								<input v-model="manufacturer" v-bind="manufacturerAttrs" type="text" :class="inputCls" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Model</label>
								<input v-model="model" v-bind="modelAttrs" type="text" :class="inputCls" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">
									Số serial
									<span v-if="requiresSerial" class="text-red-500">*</span>
								</label>
								<input v-model="serialNumber" v-bind="serialNumberAttrs" type="text" :class="inputCls" />
								<p v-if="requiresSerial" class="text-xs text-gray-500 dark:text-gray-400">
									Loại này bắt buộc có serial.
								</p>
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Vị trí</label>
								<input v-model="location" v-bind="locationAttrs" type="text" :class="inputCls" placeholder="VD: Tầng 3, phòng họp A" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Tình trạng</label>
								<UiSelect v-model="condition" v-bind="conditionAttrs" :options="conditionOptions" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Phân loại kế toán</label>
								<UiSelect v-model="accountingClass" v-bind="accountingClassAttrs" :options="accountingClassOptions" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Bảo hành (tháng)</label>
								<input v-model="warrantyMonths" v-bind="warrantyMonthsAttrs" type="number" min="0" :class="inputCls" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Hết hạn bảo hành</label>
								<UiDatePicker v-model="warrantyEndDate" v-bind="warrantyEndDateAttrs" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Bắt đầu khấu hao</label>
								<UiDatePicker v-model="depreciationStartDate" v-bind="depreciationStartDateAttrs" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Số tháng khấu hao</label>
								<input v-model="depreciationMonths" v-bind="depreciationMonthsAttrs" type="number" min="0" :class="inputCls" placeholder="Mặc định theo loại" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Giá trị thu hồi</label>
								<input v-model="salvageValue" v-bind="salvageValueAttrs" type="number" min="0" step="any" :class="inputCls" />
							</div>
						</div>
					</fieldset>

					<!-- ── Dịch vụ ───────────────────────────────────────────────────── -->
					<fieldset v-else class="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
						<legend class="px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Thông tin dịch vụ</legend>

						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div class="space-y-1">
								<label :class="labelCls">Chu kỳ thanh toán <span class="text-red-500">*</span></label>
								<UiSelect v-model="billingCycle" v-bind="billingCycleAttrs" :options="billingCycleOptions" />
								<p v-if="errors.billingCycle" class="text-xs text-red-500">{{ errors.billingCycle }}</p>
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Người phụ trách <span class="text-red-500">*</span></label>
								<UiSelectInput
									v-model="ownerId"
									v-bind="ownerIdAttrs"
									:options="employeeOptions"
									placeholder="Chọn nhân viên"
									search-placeholder="Tìm tên hoặc mã nhân viên"
								/>
								<p v-if="errors.ownerId" class="text-xs text-red-500">{{ errors.ownerId }}</p>
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Ngày gia hạn kế tiếp</label>
								<UiDatePicker v-model="nextRenewalDate" v-bind="nextRenewalDateAttrs" />
								<p class="text-xs text-gray-500 dark:text-gray-400">Bắt buộc trừ khi mua đứt.</p>
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Ngày neo trong tháng</label>
								<input v-model="anchorDay" v-bind="anchorDayAttrs" type="number" min="1" max="31" :class="inputCls" placeholder="Mặc định theo ngày gia hạn" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Gói</label>
								<input v-model="plan" v-bind="planAttrs" type="text" :class="inputCls" placeholder="VD: Team, Business" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Số ghế</label>
								<input v-model="seatCount" v-bind="seatCountAttrs" type="number" min="0" :class="inputCls" placeholder="Bỏ trống nếu không tính theo ghế" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Đơn giá</label>
								<input v-model="unitPrice" v-bind="unitPriceAttrs" type="number" min="0" step="any" :class="inputCls" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Tính giá theo</label>
								<UiSelect v-model="pricingUnit" v-bind="pricingUnitAttrs" :options="pricingUnitOptions" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Tài khoản quản trị</label>
								<input v-model="adminAccount" v-bind="adminAccountAttrs" type="text" :class="inputCls" />
							</div>
							<div class="space-y-1">
								<label :class="labelCls">Trang quản trị</label>
								<input v-model="adminUrl" v-bind="adminUrlAttrs" type="url" :class="inputCls" placeholder="https://" />
							</div>
							<div class="space-y-1 sm:col-span-2">
								<label :class="labelCls">Link password manager</label>
								<input v-model="passwordManagerUrl" v-bind="passwordManagerUrlAttrs" type="url" :class="inputCls" placeholder="https://" />
								<p class="text-xs text-gray-500 dark:text-gray-400">
									Hệ thống không lưu mật khẩu, API key hay mã 2FA — để chúng ở password manager và dán link vào đây.
								</p>
							</div>
							<div class="space-y-1 sm:col-span-2">
								<label :class="labelCls">Ghi chú thanh toán</label>
								<input v-model="paymentMethodNote" v-bind="paymentMethodNoteAttrs" type="text" :class="inputCls" placeholder="VD: Visa công ty •••• 1234" />
								<p class="text-xs text-gray-500 dark:text-gray-400">Chỉ ghi tên thẻ và 4 số cuối.</p>
							</div>
							<div v-if="!isEdit" class="space-y-1 sm:col-span-2">
								<label :class="labelCls">License key</label>
								<input v-model="licenseKey" v-bind="licenseKeyAttrs" type="text" :class="inputCls" autocomplete="off" />
								<p class="text-xs text-gray-500 dark:text-gray-400">
									Được mã hoá khi lưu. Chỉ quản trị viên và người phụ trách xem lại được.
								</p>
							</div>
							<div class="space-y-1 sm:col-span-2">
								<label :class="labelCls">Thông tin kỹ thuật</label>
								<textarea v-model="technicalInfo" v-bind="technicalInfoAttrs" rows="2" :class="`${inputCls} resize-none`" />
							</div>
							<label class="flex items-center gap-2 sm:col-span-2">
								<input v-model="autoRenew" v-bind="autoRenewAttrs" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
								<span class="text-sm text-gray-700 dark:text-gray-300">Tự động gia hạn</span>
							</label>
						</div>
					</fieldset>

					<div class="space-y-1">
						<label :class="labelCls">Ghi chú</label>
						<textarea v-model="note" v-bind="noteAttrs" rows="2" :class="`${inputCls} resize-none`" />
					</div>

					<p v-if="isEdit" class="text-xs text-gray-500 dark:text-gray-400">
						Bản này chưa xoá được một trường đã có giá trị: để trống ô nào thì giá trị cũ của ô đó giữ nguyên.
					</p>

					<div class="flex justify-end gap-3 pt-2">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="isSubmitting">
							{{ isEdit ? 'Lưu thay đổi' : 'Tạo tài sản' }}
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
