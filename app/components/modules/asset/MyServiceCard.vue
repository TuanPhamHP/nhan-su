<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import AssetLicenseKeyCard from '~/components/modules/asset/AssetLicenseKeyCard.vue';
	import RenewalModal from '~/components/modules/asset/RenewalModal.vue';
	import {
		ASSET_STATUS_CLASS,
		formatAssetMoney,
		renewalDaysClass,
		renewalDaysLabel,
	} from '~/utils/asset.utils';
	import { formatDate, todayYmd } from '~/utils/date';
	import type { Asset, AssetRenewal, AssetRenewalBody } from '~/types/asset.types';

	const props = defineProps<{
		service: Asset;
		/** Mở sẵn khi vào từ thông báo `asset_service`. */
		expanded: boolean;
	}>();

	const emit = defineEmits<{
		toggle: [];
		changed: [];
	}>();

	const toast = useToast();
	const api = useAssetService();
	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);

	const renewals = ref<AssetRenewal[]>([]);
	const loadingRenewals = ref(false);
	const showRenewal = ref(false);
	const addingSeat = ref(false);
	const newSeatEmployee = ref<number | undefined>(undefined);
	const returningSeat = ref<number | null>(null);

	const svc = computed(() => props.service.service);
	const seats = computed(() => props.service.holders);
	const overSeats = computed(
		() => svc.value?.seatCount != null && svc.value.seatsUsed > svc.value.seatCount,
	);

	async function loadRenewals() {
		if (loadingRenewals.value) return;
		loadingRenewals.value = true;
		try {
			renewals.value = await api.myServiceRenewals(props.service.id);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa tải được lịch sử gia hạn. Bạn đóng thẻ rồi mở lại.');
		} finally {
			loadingRenewals.value = false;
		}
	}

	// Chỉ tải lịch sử gia hạn khi người dùng mở thẻ ra, đừng gọi cho cả danh sách.
	watch(
		() => props.expanded,
		open => {
			if (open) {
				loadRenewals();
				directoryStore.load().catch(() => {
					/* ô chọn nhân viên rỗng, phần còn lại vẫn dùng được */
				});
			}
		},
		{ immediate: true },
	);

	const employeeOptions = computed(() => {
		const taken = new Set(seats.value.map(h => h.employee?.id).filter(Boolean));
		return employees.value
			.filter(e => !taken.has(e.id))
			.map(e => ({ value: e.id, label: `${e.fullName} · ${e.employeeCode}` }));
	});

	function submitRenewal(body: AssetRenewalBody) {
		return api.createMyServiceRenewal(props.service.id, body);
	}

	async function onRenewed() {
		showRenewal.value = false;
		await loadRenewals();
		emit('changed');
	}

	async function addSeat() {
		if (!newSeatEmployee.value || addingSeat.value) return;
		addingSeat.value = true;
		try {
			const result = await api.addMyServiceSeat(props.service.id, {
				employeeId: newSeatEmployee.value,
				assignedAt: todayYmd(),
			});
			const name = result.assignment.employee?.fullName ?? 'nhân viên đã chọn';
			if (result.warnings?.includes('SEATS_EXCEEDED')) {
				const s = svc.value;
				toast.warning(
					s?.seatCount != null
						? `${props.service.name} đang dùng ${s.seatsUsed + 1}/${s.seatCount} ghế, nhiều hơn số ghế đã đăng ký. Bạn cân nhắc tăng số ghế ở lần gia hạn tới.`
						: `${props.service.name} đang dùng nhiều ghế hơn số đã đăng ký. Bạn cân nhắc tăng số ghế ở lần gia hạn tới.`,
				);
			}
			toast.success(`Đã cấp ghế ${props.service.name} cho ${name}.`);
			newSeatEmployee.value = undefined;
			emit('changed');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa cấp được ghế. Bạn thử lại sau ít phút.');
		} finally {
			addingSeat.value = false;
		}
	}

	/** Ghế đang chờ người dùng xác nhận thu hồi, vì bấm một lần là người kia mất quyền dùng ngay. */
	const confirmingSeat = ref<{ assignmentId: number; name: string } | null>(null);

	async function returnSeat(assignmentId: number, name: string) {
		if (returningSeat.value) return;
		returningSeat.value = assignmentId;
		try {
			await api.returnMyServiceSeat(props.service.id, assignmentId);
			toast.success(`Đã thu hồi ghế ${props.service.name} của ${name}.`);
			confirmingSeat.value = null;
			emit('changed');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa thu hồi được ghế. Bạn thử lại sau ít phút.');
		} finally {
			returningSeat.value = null;
		}
	}

	useEscapeKey(
		() => (confirmingSeat.value = null),
		() => !!confirmingSeat.value && !returningSeat.value,
	);

	const revealKey = () => api.revealMyServiceLicenseKey(props.service.id);
	const saveKey = async (key: string) => {
		await api.setMyServiceLicenseKey(props.service.id, key);
	};
	const clearKey = async () => {
		await api.clearMyServiceLicenseKey(props.service.id);
	};
</script>

<template>
	<section class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
		<button
			type="button"
			class="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40"
			@click="emit('toggle')"
		>
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-2">
					<h3 class="font-medium text-gray-900 dark:text-white">{{ service.name }}</h3>
					<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="ASSET_STATUS_CLASS[service.status]">
						{{ service.statusLabel }}
					</span>
				</div>
				<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
					<span class="font-mono">{{ service.code }}</span>
					<template v-if="svc?.plan"> · {{ svc.plan }}</template>
					· {{ svc?.billingCycleLabel }}
				</p>
			</div>

			<div class="flex items-center gap-4 text-right">
				<div>
					<p class="text-xs text-gray-500 dark:text-gray-400">Ghế</p>
					<p class="text-sm font-semibold" :class="overSeats ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'">
						{{ svc?.seatsUsed ?? 0 }}<template v-if="svc?.seatCount != null">/{{ svc.seatCount }}</template>
					</p>
				</div>
				<div v-if="svc?.nextRenewalDate">
					<p class="text-xs text-gray-500 dark:text-gray-400">Hạn gia hạn</p>
					<p class="text-sm" :class="renewalDaysClass(svc.daysUntilRenewal)">
						{{ renewalDaysLabel(svc.daysUntilRenewal) }}
					</p>
				</div>
				<svg
					class="h-5 w-5 flex-shrink-0 text-gray-400 transition-transform"
					:class="expanded ? 'rotate-180' : ''"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
				</svg>
			</div>
		</button>

		<div v-if="expanded" class="space-y-5 border-t border-gray-200 p-4 dark:border-gray-700">
			<p
				v-if="overSeats"
				class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
			>
				Dịch vụ đang dùng nhiều ghế hơn số đã đăng ký. Bạn cân nhắc tăng số ghế ở lần gia hạn tới.
			</p>

			<!-- Ghế -->
			<div>
				<h4 class="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">Người đang dùng</h4>
				<p v-if="!seats.length" class="text-sm text-gray-500 dark:text-gray-400">Chưa cấp ghế cho ai.</p>
				<ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
					<li v-for="h in seats" :key="h.assignmentId" class="flex items-center justify-between gap-3 py-2">
						<div class="min-w-0">
							<p class="text-sm text-gray-900 dark:text-white">{{ h.employee?.fullName ?? '—' }}</p>
							<p class="text-xs text-gray-400">
								<span v-if="h.employee" class="font-mono">{{ h.employee.employeeCode }} · </span>
								từ {{ formatDate(h.assignedAt) }}
							</p>
						</div>
						<CommonAppButton
							size="sm"
							variant="outline"
							@click="confirmingSeat = { assignmentId: h.assignmentId, name: h.employee?.fullName ?? 'người này' }"
						>
							Thu hồi ghế
						</CommonAppButton>
					</li>
				</ul>

				<div class="mt-3 flex flex-wrap items-end gap-2">
					<div class="min-w-[14rem] flex-1">
						<label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">Cấp ghế cho</label>
						<UiSelectInput
							v-model="newSeatEmployee"
							:options="employeeOptions"
							placeholder="Chọn nhân viên"
							search-placeholder="Tìm tên hoặc mã nhân viên"
						/>
					</div>
					<CommonAppButton variant="primary" size="sm" :disabled="!newSeatEmployee" :loading="addingSeat" @click="addSeat">
						Cấp ghế
					</CommonAppButton>
				</div>
			</div>

			<!-- License key -->
			<AssetLicenseKeyCard
				:has-key="svc?.hasLicenseKey ?? false"
				:masked="svc?.licenseKeyMasked ?? null"
				:can-reveal="true"
				:can-edit="true"
				:reveal="revealKey"
				:save="saveKey"
				:clear="clearKey"
				@changed="emit('changed')"
			/>

			<!-- Gia hạn -->
			<div>
				<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
					<h4 class="text-sm font-semibold text-gray-800 dark:text-gray-100">Lịch sử gia hạn</h4>
					<CommonAppButton
						v-if="svc?.billingCycle !== 'ONE_TIME' && service.status !== 'CANCELLED'"
						size="sm"
						variant="primary"
						@click="showRenewal = true"
					>
						Ghi nhận gia hạn
					</CommonAppButton>
				</div>

				<div v-if="loadingRenewals" class="space-y-2">
					<div v-for="i in 2" :key="i" class="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
				</div>
				<p v-else-if="!renewals.length" class="text-sm text-gray-500 dark:text-gray-400">
					Chưa ghi nhận lần gia hạn nào.
				</p>
				<ul v-else class="divide-y divide-gray-100 dark:divide-gray-800">
					<li v-for="r in renewals" :key="r.id" class="flex flex-wrap items-center justify-between gap-2 py-2">
						<div>
							<p class="text-sm text-gray-900 dark:text-white">
								{{ formatDate(r.periodStart) }} – {{ formatDate(r.periodEnd) }}
							</p>
							<p class="text-xs text-gray-400">
								Trả ngày {{ formatDate(r.paidAt) }}
								<template v-if="r.seatCount != null"> · {{ r.seatCount }} ghế</template>
							</p>
						</div>
						<p class="text-sm tabular-nums text-gray-700 dark:text-gray-300">
							{{ formatAssetMoney(r.amount, r.currency) }}
						</p>
					</li>
				</ul>
			</div>
		</div>

		<RenewalModal
			v-if="showRenewal"
			:asset="service"
			:submit="submitRenewal"
			@renewed="onRenewed"
			@close="showRenewal = false"
		/>

		<Teleport to="body">
			<div
				v-if="confirmingSeat"
				class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
				role="alertdialog"
				aria-modal="true"
				aria-label="Thu hồi ghế"
			>
				<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Thu hồi ghế</h2>
					<p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
						Thu hồi ghế {{ service.name }} của <strong>{{ confirmingSeat.name }}</strong>? Hệ thống ghi nhận
						ngày thu hồi là hôm nay, còn tài khoản trên phần mềm bạn tự khoá ở trang quản trị của dịch vụ.
					</p>
					<div class="mt-5 flex justify-end gap-3">
						<CommonAppButton variant="secondary" :disabled="!!returningSeat" @click="confirmingSeat = null">
							Giữ lại
						</CommonAppButton>
						<CommonAppButton
							variant="danger"
							:loading="returningSeat === confirmingSeat.assignmentId"
							@click="returnSeat(confirmingSeat.assignmentId, confirmingSeat.name)"
						>
							Thu hồi ghế
						</CommonAppButton>
					</div>
				</div>
			</div>
		</Teleport>
	</section>
</template>
