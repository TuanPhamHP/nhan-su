<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import {
		ASSET_VENDOR_TYPE_LABELS,
		type AssetVendor,
		type AssetVendorDetail,
		type AssetVendorType,
	} from '~/types/asset.types';

	definePageMeta({ title: 'Nhà cung cấp' });

	const toast = useToast();
	const service = useAssetService();
	const { canWrite } = useModuleAccess();
	const { hasPermission } = usePermissions();

	const canManage = computed(() => canWrite('ASSET') && hasPermission('asset:manage'));

	const vendors = ref<AssetVendor[]>([]);
	const loading = ref(true);
	const search = ref('');
	const showInactive = ref(false);

	/** Form tạo hoặc sửa, mở ngay trong trang chứ không cần modal riêng. */
	const editing = ref<AssetVendor | null>(null);
	const showForm = ref(false);
	const saving = ref(false);
	const form = reactive({
		name: '',
		types: [] as AssetVendorType[],
		taxCode: '',
		contactName: '',
		phone: '',
		email: '',
		website: '',
		address: '',
		note: '',
		isActive: true,
	});

	const detail = ref<AssetVendorDetail | null>(null);
	const loadingDetail = ref(false);

	const loadError = ref<string | null>(null);

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			vendors.value = await service.findVendors({
				search: search.value || undefined,
				isActive: showInactive.value ? undefined : true,
			});
		} catch (e) {
			vendors.value = [];
			loadError.value = e instanceof Error ? e.message : 'Chưa tải được danh sách nhà cung cấp. Bạn bấm Thử lại.';
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);
	watch([search, showInactive], load);

	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	function onSearchInput(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			search.value = val;
		}, 300);
	}

	function openCreate() {
		editing.value = null;
		Object.assign(form, {
			name: '',
			types: [],
			taxCode: '',
			contactName: '',
			phone: '',
			email: '',
			website: '',
			address: '',
			note: '',
			isActive: true,
		});
		showForm.value = true;
	}

	function openEdit(v: AssetVendor) {
		editing.value = v;
		Object.assign(form, {
			name: v.name,
			types: [...v.types],
			taxCode: v.taxCode ?? '',
			contactName: v.contactName ?? '',
			phone: v.phone ?? '',
			email: v.email ?? '',
			website: v.website ?? '',
			address: v.address ?? '',
			note: v.note ?? '',
			isActive: v.isActive,
		});
		showForm.value = true;
	}

	function toggleType(t: AssetVendorType) {
		const i = form.types.indexOf(t);
		if (i >= 0) form.types.splice(i, 1);
		else form.types.push(t);
	}

	/**
	 * Email sai định dạng thì báo ngay dưới ô (copy-review mục 4). Ô nằm ngoài thẻ `<form>` nên
	 * trình duyệt không tự chặn, và trước đây người dùng chỉ thấy câu tiếng Anh của máy chủ.
	 */
	const emailError = computed(() => {
		const v = form.email.trim();
		if (!v) return '';
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Email chưa đúng định dạng, ví dụ ketoan@congty.vn.';
	});

	async function save() {
		if (!form.name.trim() || emailError.value || saving.value) return;
		saving.value = true;
		try {
			const body = {
				name: form.name.trim(),
				types: form.types,
				taxCode: form.taxCode || undefined,
				contactName: form.contactName || undefined,
				phone: form.phone || undefined,
				email: form.email || undefined,
				website: form.website || undefined,
				address: form.address || undefined,
				note: form.note || undefined,
				isActive: form.isActive,
			};
			if (editing.value) await service.updateVendor(editing.value.id, body);
			else await service.createVendor(body);
			toast.success(
				editing.value ? `Đã lưu nhà cung cấp ${body.name}.` : `Đã thêm nhà cung cấp ${body.name}.`,
			);
			showForm.value = false;
			await load();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa lưu được nhà cung cấp. Bạn thử lại sau ít phút.');
		} finally {
			saving.value = false;
		}
	}

	async function openDetail(v: AssetVendor) {
		loadingDetail.value = true;
		detail.value = null;
		try {
			detail.value = await service.findVendor(v.id);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa mở được nhà cung cấp. Bạn thử lại sau ít phút.');
		} finally {
			loadingDetail.value = false;
		}
	}

	const typeEntries = Object.entries(ASSET_VENDOR_TYPE_LABELS) as [AssetVendorType, string][];
	const inputCls =
		'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
	const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
</script>

<template>
	<div class="space-y-5">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div>
				<UiPageHeader title="Nhà cung cấp" description="Nơi mua thiết bị, đơn vị sửa chữa và nhà cung cấp dịch vụ" />
			</div>
			<CommonAppButton v-if="canManage" variant="primary" @click="openCreate">Thêm nhà cung cấp</CommonAppButton>
		</div>

		<CommonAppModuleNotice module="ASSET" />

		<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div class="flex flex-wrap items-center gap-3">
				<div class="relative min-w-[16rem] flex-1">
					<svg
						class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					<input
						type="text"
						placeholder="Tìm theo tên..."
						class="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						@input="onSearchInput"
					/>
				</div>
				<label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
					<input v-model="showInactive" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
					Hiện cả đơn vị đã ngừng dùng
				</label>
			</div>
		</div>

		<!-- Form thêm / sửa -->
		<div v-if="showForm" class="rounded-xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-700 dark:bg-gray-900">
			<h3 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
				{{ editing ? `Sửa ${editing.name}` : 'Thêm nhà cung cấp' }}
			</h3>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="space-y-1 sm:col-span-2">
					<label :class="labelCls">Tên <span class="text-red-500">*</span></label>
					<input v-model="form.name" type="text" :class="inputCls" />
				</div>
				<div class="space-y-1 sm:col-span-2">
					<label :class="labelCls">Loại hình</label>
					<div class="flex flex-wrap gap-2">
						<button
							v-for="[value, label] in typeEntries"
							:key="value"
							type="button"
							:class="[
								'rounded-full border px-3 py-1 text-xs transition',
								form.types.includes(value)
									? 'border-brand-600 bg-brand-600 text-white'
									: 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300',
							]"
							@click="toggleType(value)"
						>
							{{ label }}
						</button>
					</div>
				</div>
				<div class="space-y-1">
					<label :class="labelCls">Mã số thuế</label>
					<input v-model="form.taxCode" type="text" maxlength="20" :class="inputCls" />
				</div>
				<div class="space-y-1">
					<label :class="labelCls">Người liên hệ</label>
					<input v-model="form.contactName" type="text" :class="inputCls" />
				</div>
				<div class="space-y-1">
					<label :class="labelCls">Điện thoại</label>
					<input v-model="form.phone" type="tel" :class="inputCls" />
				</div>
				<div class="space-y-1">
					<label :class="labelCls">Email</label>
					<input v-model="form.email" type="email" :class="inputCls" placeholder="VD: ketoan@congty.vn" />
					<p v-if="emailError" class="text-sm text-red-600">{{ emailError }}</p>
				</div>
				<div class="space-y-1">
					<label :class="labelCls">Website</label>
					<input v-model="form.website" type="url" :class="inputCls" placeholder="https://" />
				</div>
				<div class="space-y-1">
					<label :class="labelCls">Địa chỉ</label>
					<input v-model="form.address" type="text" :class="inputCls" />
				</div>
				<div class="space-y-1 sm:col-span-2">
					<label :class="labelCls">Ghi chú</label>
					<textarea v-model="form.note" rows="2" :class="`${inputCls} resize-none`" />
				</div>
				<label class="flex items-center gap-2 sm:col-span-2">
					<input v-model="form.isActive" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
					<span class="text-sm text-gray-700 dark:text-gray-300">Đang dùng</span>
				</label>
			</div>
			<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
				Nhà cung cấp không xoá được. Bạn bỏ dấu "Đang dùng" để nhà cung cấp này không còn hiện trong các form mới.
			</p>
			<div class="mt-4 flex justify-end gap-3">
				<CommonAppButton variant="secondary" @click="showForm = false">Đóng</CommonAppButton>
				<CommonAppButton variant="primary" :disabled="!form.name.trim() || !!emailError" :loading="saving" @click="save">
					Lưu
				</CommonAppButton>
			</div>
		</div>

		<!-- Danh sách -->
		<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
			<div v-if="loading" class="space-y-3 p-6">
				<div v-for="i in 4" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
			</div>

			<div v-else-if="loadError" class="flex flex-col items-center gap-3 px-4 py-12 text-center">
				<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
				<CommonAppButton size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
			</div>

			<p v-else-if="!vendors.length" class="px-4 py-16 text-center text-sm text-gray-600 dark:text-gray-400">
				{{
					search
						? `Không có nhà cung cấp nào khớp "${search}". Bạn thử từ khoá khác.`
						: 'Chưa có nhà cung cấp nào. Bạn bấm Thêm nhà cung cấp để tạo.'
				}}
			</p>

			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tên</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Loại hình</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Liên hệ</th>
							<th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Trạng thái</th>
							<th class="px-4 py-3" />
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
						<tr v-for="v in vendors" :key="v.id" class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
							<td class="px-4 py-3">
								<p class="font-medium text-gray-900 dark:text-white">{{ v.name }}</p>
								<p v-if="v.taxCode" class="font-mono text-xs text-gray-400">MST {{ v.taxCode }}</p>
							</td>
							<td class="px-4 py-3">
								<span
									v-for="label in v.typeLabels"
									:key="label"
									class="mr-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
								>
									{{ label }}
								</span>
								<span v-if="!v.typeLabels.length" class="text-gray-400">—</span>
							</td>
							<td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
								<p v-if="v.contactName">{{ v.contactName }}</p>
								<p v-if="v.phone" class="text-gray-400">{{ v.phone }}</p>
								<p v-if="v.email" class="text-gray-400">{{ v.email }}</p>
								<span v-if="!v.contactName && !v.phone && !v.email" class="text-gray-400">—</span>
							</td>
							<td class="px-4 py-3">
								<span
									class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
									:class="
										v.isActive
											? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
											: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
									"
								>
									{{ v.isActive ? 'Đang dùng' : 'Ngừng dùng' }}
								</span>
							</td>
							<td class="px-4 py-3 text-right">
								<div class="flex justify-end gap-2">
									<CommonAppButton size="sm" variant="outline" @click="openDetail(v)">Xem</CommonAppButton>
									<CommonAppButton v-if="canManage" size="sm" variant="outline" @click="openEdit(v)">Sửa</CommonAppButton>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- Chi tiết: tài sản và phiếu sửa gắn với nhà cung cấp -->
		<Teleport to="body">
			<div
				v-if="detail || loadingDetail"
				class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
				@click.self="detail = null"
			>
				<div class="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
					<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ detail?.name ?? 'Đang tải…' }}
						</h2>
						<button
							type="button"
							class="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
							aria-label="Đóng"
							@click="detail = null"
						>
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<div v-if="loadingDetail" class="space-y-3 p-6">
						<div v-for="i in 3" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
					</div>

					<div v-else-if="detail" class="space-y-5 p-6">
						<div>
							<h3 class="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
								Tài sản đã mua ({{ detail.assets.length }})
							</h3>
							<p v-if="!detail.assets.length" class="text-sm text-gray-500 dark:text-gray-400">Chưa có.</p>
							<ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
								<li v-for="a in detail.assets" :key="a.id" class="flex items-center justify-between gap-3 py-2">
									<NuxtLink :to="`/management/assets/${a.id}`" class="text-sm text-brand-600 hover:underline dark:text-brand-400">
										{{ a.code }} · {{ a.name }}
									</NuxtLink>
									<span class="text-xs text-gray-500 dark:text-gray-400">{{ a.statusLabel }}</span>
								</li>
							</ul>
						</div>

						<div>
							<h3 class="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
								Phiếu sửa ({{ detail.maintenances.length }})
							</h3>
							<p v-if="!detail.maintenances.length" class="text-sm text-gray-500 dark:text-gray-400">Chưa có.</p>
							<ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
								<li v-for="m in detail.maintenances" :key="m.id" class="py-2">
									<p class="text-sm text-gray-800 dark:text-gray-200">{{ m.description }}</p>
									<p class="text-xs text-gray-400">{{ m.assetCode }} · {{ m.statusLabel }}</p>
								</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>
