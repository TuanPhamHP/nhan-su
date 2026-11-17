<script setup lang="ts">
	import { useForm } from 'vee-validate';
	import { toTypedSchema } from '@vee-validate/zod';
	import * as z from 'zod';
	import { useAssetService } from '~/services/asset.service';
	import {
		ASSET_STATUS_CLASS,
		apiErrorCode,
		disposalItemErrors,
		disposalNumber,
		assetNumberField,
		toAssetNumber,
	} from '~/utils/asset.utils';
	import { formatDate, todayYmd } from '~/utils/date';
	import {
		ASSET_DISPOSAL_METHOD_LABELS,
		type Asset,
		type AssetDisposal,
		type AssetDisposalMethod,
		type AssetStatus,
	} from '~/types/asset.types';

	/**
	 * Form phiếu thanh lý, dùng chung cho tạo mới và "Sửa và gửi lại".
	 *
	 * Ô tìm thiết bị chỉ gợi ý thiết bị đề nghị thanh lý được (`GET /assets?disposable=true`): Sẵn
	 * sàng, Hỏng hoặc Mất, không ai giữ, chưa nằm trong phiếu chờ duyệt khác. Tình trạng thiết bị
	 * có thể đổi giữa lúc chọn và lúc gửi, nên BE vẫn kiểm lại; khi đó 409
	 * `ASSET_DISPOSAL_NOT_ALLOWED` trả lý do từng thiết bị và form đánh dấu đúng các dòng đó.
	 */
	interface PickedAsset {
		id: number;
		code: string;
		name: string;
		status: AssetStatus;
		statusLabel: string;
		categoryName: string;
		serialNumber: string | null;
		location: string | null;
	}

	const props = withDefaults(
		defineProps<{
			/** Có giá trị là sửa phiếu bị từ chối rồi gửi lại. */
			disposal?: AssetDisposal | null;
			/** Thiết bị chọn sẵn, khi mở từ trang chi tiết tài sản. */
			initialAssets?: Asset[];
		}>(),
		{ disposal: null, initialAssets: () => [] },
	);

	const emit = defineEmits<{
		saved: [disposal: AssetDisposal];
		close: [];
	}>();

	const toast = useToast();
	const service = useAssetService();

	const isEdit = computed(() => !!props.disposal);

	function fromAsset(a: Asset): PickedAsset {
		return {
			id: a.id,
			code: a.code,
			name: a.name,
			status: a.status,
			statusLabel: a.statusLabel,
			categoryName: a.category.name,
			serialNumber: a.physical?.serialNumber ?? null,
			location: a.physical?.location ?? null,
		};
	}

	const picked = ref<PickedAsset[]>(
		props.disposal
			? props.disposal.items.map(i => ({
					id: i.assetId,
					code: i.code,
					name: i.name,
					status: i.status,
					statusLabel: i.statusLabel,
					categoryName: i.categoryName,
					serialNumber: i.serialNumber,
					location: i.location,
				}))
			: props.initialAssets.map(fromAsset),
	);

	/** Lý do BE từ chối từng thiết bị, theo `assetId`. Bỏ dòng thì lỗi của dòng đó mất theo. */
	const itemErrors = ref<Record<number, string>>({});
	/** Câu lỗi chung của BE đi kèm danh sách dòng lỗi, hiện ngay trên danh sách thiết bị. */
	const listError = ref<string | null>(null);
	const listErrorEl = ref<HTMLElement | null>(null);
	const pickError = ref<string | null>(null);

	function removePicked(id: number) {
		picked.value = picked.value.filter(p => p.id !== id);
		const next = { ...itemErrors.value };
		delete next[id];
		itemErrors.value = next;
		if (!Object.keys(next).length) listError.value = null;
	}

	function addPicked(a: Asset) {
		if (picked.value.some(p => p.id === a.id)) return;
		if (picked.value.length >= 100) {
			pickError.value = 'Một phiếu có tối đa 100 thiết bị. Bạn tách thành nhiều phiếu.';
			return;
		}
		picked.value = [...picked.value, fromAsset(a)];
		pickError.value = null;
	}

	// ─── Tìm thiết bị ─────────────────────────────────────────────────────────────

	const search = ref('');
	const results = ref<Asset[]>([]);
	const searching = ref(false);
	const searchError = ref<string | null>(null);
	let searchTimer: ReturnType<typeof setTimeout> | null = null;

	/** Tìm theo mã, tên hoặc số serial, chỉ trong các thiết bị đề nghị thanh lý được. */
	async function runSearch() {
		searching.value = true;
		searchError.value = null;
		const text = search.value.trim();
		try {
			const res = await service.findAll({
				kind: 'PHYSICAL',
				disposable: true,
				search: text || undefined,
				page: 1,
				limit: text ? 10 : 20,
			});
			results.value = res.data;
		} catch (e) {
			results.value = [];
			searchError.value = e instanceof Error ? e.message : 'Chưa tìm được thiết bị. Bạn thử lại sau ít phút.';
		} finally {
			searching.value = false;
		}
	}

	function onSearchInput() {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(runSearch, 300);
	}

	onMounted(runSearch);

	// ─── Form ─────────────────────────────────────────────────────────────────────

	/** Bán thì ghi bên mua, Tặng thì ghi bên nhận; Tiêu huỷ, Mất không có bên kia. */
	const NEEDS_COUNTERPARTY: AssetDisposalMethod[] = ['SALE', 'DONATION'];
	const REASON_REQUIRED = 'Bạn ghi lý do thanh lý, ví dụ: hỏng bo mạch, sửa tốn hơn mua mới.';

	const schema = toTypedSchema(
		z
			.object({
				method: z.string().min(1, 'Bạn chọn hình thức thanh lý'),
				disposalDate: z
					.string({ required_error: 'Bạn chọn ngày thanh lý' })
					.min(1, 'Bạn chọn ngày thanh lý')
					.refine(v => v <= todayYmd(), 'Ngày thanh lý không được sau hôm nay'),
				reason: z
					.string({ required_error: REASON_REQUIRED })
					.trim()
					.min(3, REASON_REQUIRED)
					.max(4000, 'Lý do tối đa 4000 ký tự'),
				proceeds: assetNumberField,
				counterparty: z.string().max(200, 'Tối đa 200 ký tự').optional(),
			})
			.superRefine((v, ctx) => {
				if (!NEEDS_COUNTERPARTY.includes(v.method as AssetDisposalMethod) || v.counterparty?.trim()) return;
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['counterparty'],
					message:
						v.method === 'SALE'
							? 'Bạn ghi bên mua, là người hoặc đơn vị mua lại thiết bị.'
							: 'Bạn ghi bên nhận, là người hoặc đơn vị được tặng thiết bị.',
				});
			}),
	);

	const { handleSubmit, defineField, errors, isSubmitting, setFieldError } = useForm({
		validationSchema: schema,
		initialValues: {
			method: props.disposal?.method ?? '',
			disposalDate: props.disposal?.disposalDate ?? todayYmd(),
			reason: props.disposal?.reason ?? '',
			proceeds: props.disposal?.proceeds ?? undefined,
			counterparty: props.disposal?.counterparty ?? '',
		},
	});

	const [method, methodAttrs] = defineField('method');
	const [disposalDate, disposalDateAttrs] = defineField('disposalDate');
	const [reason, reasonAttrs] = defineField('reason');
	const [proceeds] = defineField('proceeds');
	const [counterparty, counterpartyAttrs] = defineField('counterparty');

	const methodOptions = [
		{ value: '', label: 'Chọn hình thức' },
		...Object.entries(ASSET_DISPOSAL_METHOD_LABELS).map(([value, label]) => ({ value, label })),
	];

	const counterpartyLabel = computed(() => {
		if (method.value === 'SALE') return 'Bên mua';
		if (method.value === 'DONATION') return 'Bên nhận';
		return null;
	});

	useEscapeKey(
		() => emit('close'),
		() => !isSubmitting.value,
	);

	const onSubmit = handleSubmit(async values => {
		if (!picked.value.length) {
			pickError.value = 'Bạn chọn ít nhất một thiết bị cần thanh lý.';
			return;
		}
		const m = values.method as AssetDisposalMethod;
		const body = {
			assetIds: picked.value.map(p => p.id),
			method: m,
			disposalDate: values.disposalDate,
			reason: values.reason.trim(),
			proceeds: toAssetNumber(values.proceeds),
			counterparty: NEEDS_COUNTERPARTY.includes(m) ? values.counterparty?.trim() || undefined : undefined,
		};
		try {
			const saved = props.disposal
				? await service.updateDisposal(props.disposal.id, { ...body, resubmit: true })
				: await service.createDisposal(body);
			toast.success(
				props.disposal
					? `Đã gửi lại phiếu thanh lý ${disposalNumber(saved.id)}. Người duyệt sẽ nhận được thông báo.`
					: `Đã gửi phiếu thanh lý ${disposalNumber(saved.id)} gồm ${saved.items.length} thiết bị. Người duyệt sẽ nhận được thông báo.`,
			);
			emit('saved', saved);
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Chưa gửi được phiếu thanh lý. Bạn thử lại sau ít phút.';
			const code = apiErrorCode(e);
			// Lỗi gắn được vào chỗ cụ thể thì chỉ hiện ở chỗ đó, không thêm toast nói lại cùng một câu.
			if (code === 'ASSET_DISPOSAL_NOT_ALLOWED') {
				const map: Record<number, string> = {};
				for (const err of disposalItemErrors(e)) map[err.assetId] = err.reason;
				itemErrors.value = map;
				listError.value = message;
				await nextTick();
				listErrorEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			} else if (code === 'ASSET_DISPOSAL_COUNTERPARTY_REQUIRED') {
				setFieldError('counterparty', message);
			} else if (code === 'ASSET_DISPOSAL_DATE_IN_FUTURE') {
				setFieldError('disposalDate', message);
			} else {
				toast.error(message);
			}
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
			:aria-label="isEdit ? 'Sửa và gửi lại phiếu thanh lý' : 'Tạo phiếu thanh lý'"
		>
			<div class="my-4 w-full max-w-3xl rounded-2xl bg-white shadow-xl sm:my-8 dark:bg-gray-900">
				<div class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
					<div class="min-w-0">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ isEdit && disposal ? `Sửa và gửi lại phiếu thanh lý ${disposalNumber(disposal.id)}` : 'Tạo phiếu thanh lý' }}
						</h2>
						<p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
							Phiếu được gửi tới người có quyền duyệt thanh lý. Khi được duyệt, các thiết bị chuyển sang Đã
							thanh lý và dừng khấu hao từ ngày thanh lý.
						</p>
					</div>
					<button
						type="button"
						class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:h-8 sm:w-8 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Đóng hộp phiếu thanh lý"
						@click="emit('close')"
					>
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form class="space-y-5 p-4 sm:p-6" @submit.prevent="onSubmit">
					<!-- Lý do bị từ chối ở lần gửi trước, để người sửa biết phải đổi gì. -->
					<div
						v-if="disposal?.decisionNote"
						class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
					>
						<p class="font-medium">Lý do bị từ chối ở lần gửi trước</p>
						<p class="whitespace-pre-line">{{ disposal.decisionNote }}</p>
					</div>

					<!-- Thiết bị trong phiếu -->
					<section class="space-y-2">
						<div class="flex flex-wrap items-baseline justify-between gap-2">
							<p :class="labelCls">Thiết bị thanh lý <span class="text-red-500">*</span></p>
							<p class="text-xs text-gray-500 dark:text-gray-400">Đã chọn {{ picked.length }} thiết bị</p>
						</div>

						<p
							v-if="listError"
							ref="listErrorEl"
							class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
							role="alert"
						>
							{{ listError }}
						</p>

						<p v-if="!picked.length" class="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
							Chưa có thiết bị nào. Bạn tìm thiết bị ở ô bên dưới rồi bấm Thêm.
						</p>
						<ul v-else class="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
							<li
								v-for="p in picked"
								:key="p.id"
								:data-asset-id="p.id"
								class="flex items-start justify-between gap-3 px-3 py-2"
								:class="itemErrors[p.id] ? 'bg-rose-50 dark:bg-rose-900/20' : ''"
							>
								<div class="min-w-0">
									<p class="text-sm font-medium text-gray-900 dark:text-white">{{ p.name }}</p>
									<p class="text-xs text-gray-600 dark:text-gray-400">
										<span class="font-mono">{{ p.code }}</span> · {{ p.categoryName }}
										<template v-if="p.serialNumber"> · Số serial {{ p.serialNumber }}</template>
									</p>
									<div class="mt-1 flex flex-wrap items-center gap-2">
										<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="ASSET_STATUS_CLASS[p.status]">
											{{ p.statusLabel }}
										</span>
										<span v-if="p.location" class="text-xs text-gray-600 dark:text-gray-400">Vị trí: {{ p.location }}</span>
									</div>
									<p v-if="itemErrors[p.id]" class="mt-1 text-sm text-rose-700 dark:text-rose-300">{{ itemErrors[p.id] }}</p>
								</div>
								<button
									type="button"
									class="flex h-11 flex-shrink-0 items-center rounded-lg px-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-rose-600 sm:h-8 dark:hover:bg-gray-800"
									:aria-label="`Bỏ ${p.code} khỏi phiếu`"
									@click="removePicked(p.id)"
								>
									Bỏ
								</button>
							</li>
						</ul>
						<p v-if="pickError" class="text-xs text-red-500">{{ pickError }}</p>

						<!-- Tìm thêm -->
						<div class="space-y-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
							<input
								v-model="search"
								type="text"
								:class="inputCls"
								placeholder="Tìm thiết bị theo mã, tên hoặc số serial"
								aria-label="Tìm thiết bị để thêm vào phiếu"
								@input="onSearchInput"
							/>
							<p class="text-xs text-gray-600 dark:text-gray-400">
								Danh sách chỉ gồm thiết bị đề nghị thanh lý được: Sẵn sàng, Hỏng hoặc Mất, không còn ai giữ và chưa nằm
								trong phiếu chờ duyệt khác.
							</p>
							<div v-if="searching" class="space-y-2">
								<div v-for="i in 3" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
							</div>
							<p v-else-if="searchError" class="text-sm text-rose-700 dark:text-rose-300">{{ searchError }}</p>
							<p v-else-if="!results.length" class="text-sm text-gray-500 dark:text-gray-400">
								{{
									search.trim()
										? 'Không có thiết bị nào khớp mà còn đề nghị thanh lý được. Thiết bị đang có người giữ hoặc đang nằm trong phiếu chờ duyệt không hiện ở đây.'
										: 'Hiện không có thiết bị nào đề nghị thanh lý được.'
								}}
							</p>
							<ul v-else class="max-h-72 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700">
								<li v-for="a in results" :key="a.id" class="flex items-center justify-between gap-3 py-2">
									<div class="min-w-0">
										<p class="truncate text-sm text-gray-900 dark:text-white">{{ a.name }}</p>
										<p class="text-xs text-gray-600 dark:text-gray-400">
											<span class="font-mono">{{ a.code }}</span>
											<template v-if="a.physical?.serialNumber"> · Số serial {{ a.physical.serialNumber }}</template>
											· {{ a.statusLabel }}
											<template v-if="a.physical?.location"> · {{ a.physical.location }}</template>
											<template v-if="a.pendingDisposalId"> · Chờ duyệt thanh lý</template>
										</p>
									</div>
									<CommonAppButton
										size="sm"
										variant="outline"
										class="min-h-11 flex-shrink-0 sm:min-h-0"
										:disabled="picked.some(p => p.id === a.id)"
										@click="addPicked(a)"
									>
										{{ picked.some(p => p.id === a.id) ? 'Đã thêm' : 'Thêm' }}
									</CommonAppButton>
								</li>
							</ul>
						</div>
					</section>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1">
							<label :class="labelCls">Hình thức <span class="text-red-500">*</span></label>
							<UiSelect v-model="method" v-bind="methodAttrs" :options="methodOptions" />
							<p v-if="errors.method" class="text-xs text-red-500">{{ errors.method }}</p>
							<p v-else-if="method === 'LOSS'" class="text-xs text-gray-500 dark:text-gray-400">
								Dùng để ghi giảm thiết bị đã mất khỏi sổ tài sản.
							</p>
						</div>
						<div class="space-y-1">
							<label :class="labelCls">Ngày thanh lý <span class="text-red-500">*</span></label>
							<UiDatePicker v-model="disposalDate" v-bind="disposalDateAttrs" :max="todayYmd()" />
							<p v-if="errors.disposalDate" class="text-xs text-red-500">{{ errors.disposalDate }}</p>
							<p v-else class="text-xs text-gray-500 dark:text-gray-400">
								Thiết bị dừng khấu hao từ ngày này. Hôm nay là {{ formatDate(todayYmd()) }}.
							</p>
						</div>
					</div>

					<div v-if="counterpartyLabel" class="space-y-1">
						<label for="disposal-counterparty" :class="labelCls">{{ counterpartyLabel }} <span class="text-red-500">*</span></label>
						<input
							id="disposal-counterparty"
							v-model="counterparty"
							v-bind="counterpartyAttrs"
							type="text"
							maxlength="200"
							:class="inputCls"
							:placeholder="method === 'SALE' ? 'VD: Cửa hàng máy tính Hải Đăng' : 'VD: Trường trung cấp nghề Long Biên'"
						/>
						<p v-if="errors.counterparty" class="text-xs text-red-500">{{ errors.counterparty }}</p>
					</div>

					<div class="space-y-1">
						<label for="disposal-proceeds" :class="labelCls">Giá thu về</label>
						<UiNumberInput
							id="disposal-proceeds"
							v-model="proceeds"
							:min="0"
							:input-class="inputCls"
							placeholder="VD: 1.500.000"
						/>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Tổng số tiền thu về cho cả phiếu, tính bằng đồng. Bỏ trống nếu không thu tiền.
						</p>
					</div>

					<div class="space-y-1">
						<label for="disposal-reason" :class="labelCls">Lý do <span class="text-red-500">*</span></label>
						<textarea
							id="disposal-reason"
							v-model="reason"
							v-bind="reasonAttrs"
							rows="3"
							maxlength="4000"
							:class="`${inputCls} resize-y`"
							placeholder="VD: máy in hỏng bo mạch, chi phí sửa cao hơn giá máy mới"
						/>
						<p v-if="errors.reason" class="text-xs text-red-500">{{ errors.reason }}</p>
					</div>

					<div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
						<CommonAppButton variant="secondary" type="button" class="min-h-11 sm:min-h-0" @click="emit('close')">Đóng</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" class="min-h-11 sm:min-h-0" :loading="isSubmitting">
							{{ isEdit ? 'Gửi lại để duyệt' : 'Gửi đề nghị thanh lý' }}
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
