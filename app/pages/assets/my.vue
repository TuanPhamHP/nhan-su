<script setup lang="ts">
	import { useAssetService } from '~/services/asset.service';
	import MyServiceCard from '~/components/modules/asset/MyServiceCard.vue';
	import MyAssetActions from '~/components/modules/asset/MyAssetActions.vue';
	import ReportIncidentModal from '~/components/modules/asset/ReportIncidentModal.vue';
	import AssetIncidentDetailModal from '~/components/modules/asset/AssetIncidentDetailModal.vue';
	import {
		ASSET_STATUS_CLASS,
		CONFIRMATION_CLASS,
		INCIDENT_BLOCKED_STATUSES,
		INCIDENT_STATUS_CLASS,
		INCIDENT_TYPE_CLASS,
		assignmentEndText,
		canReportIncident,
		lowerFirst,
	} from '~/utils/asset.utils';
	import { formatDate, formatDateTime } from '~/utils/date';
	import type {
		Asset,
		AssetAssignment,
		AssetIncident,
		AssetIncidentType,
		MyAssets,
	} from '~/types/asset.types';

	definePageMeta({ title: 'Tài sản của tôi' });

	const route = useRoute();
	const router = useRouter();
	const toast = useToast();
	const service = useAssetService();
	const { canWrite } = useModuleAccess();
	const { setPendingAssetCount } = useMyAssetBadge();

	const data = ref<MyAssets | null>(null);
	const loadError = ref<string | null>(null);
	const services = ref<Asset[]>([]);
	const servicesError = ref<string | null>(null);
	const loading = ref(true);
	const expandedService = ref<number | null>(null);

	type TabId = 'assets' | 'services';
	const activeTab = ref<TabId>('assets');

	// ─── Xác nhận đã nhận, báo chưa đúng ─────────────────────────────────────────

	/** Lần cấp phát đang chờ người dùng bấm xác nhận trong hộp hỏi lại (O3). */
	const accepting = ref<AssetAssignment | null>(null);
	/** Lần cấp phát đang được báo chưa đúng. */
	const disputing = ref<AssetAssignment | null>(null);
	const disputeReason = ref('');
	const submitting = ref(false);
	/** Lần cấp phát đang mở xem chi tiết (O4). */
	const viewing = ref<AssetAssignment | null>(null);

	/**
	 * Còn bấm Đã nhận được không. BE cho xác nhận cả khi người nhận đã báo chưa đúng, vì hai bên
	 * có thể thống nhất ngoài hệ thống, nên nút không được biến mất sau khi báo (F4).
	 */
	function canConfirm(a: AssetAssignment): boolean {
		return a.confirmation === 'PENDING' || a.confirmation === 'DISPUTED';
	}

	async function confirmAssignment(assignment: AssetAssignment, accepted: boolean) {
		if (!accepted && !disputeReason.value.trim()) return;
		submitting.value = true;
		const label = `${assignment.asset.name} (${assignment.asset.code})`;
		try {
			await service.confirmMyAssignment(assignment.id, {
				accepted,
				reason: accepted ? undefined : disputeReason.value.trim(),
			});
			toast.success(
				accepted
					? `Bạn đã xác nhận đã nhận ${label}. Cảm ơn bạn.`
					: `Đã gửi phản hồi về ${label}. Người cấp phát sẽ kiểm tra lại với bạn.`,
			);
			accepting.value = null;
			disputing.value = null;
			disputeReason.value = '';
			await loadAssets();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa gửi được xác nhận. Bạn thử lại sau ít phút.');
		} finally {
			submitting.value = false;
		}
	}

	function closeDialogs() {
		if (submitting.value) return;
		accepting.value = null;
		disputing.value = null;
		viewing.value = null;
	}

	useEscapeKey(closeDialogs, () => !!(accepting.value || disputing.value || viewing.value));

	// ─── Báo hỏng, báo mất của tôi ────────────────────────────────────────────────

	/** Báo cáo còn chờ xử lý, để ẩn nút báo trùng — BE trả 409 `ASSET_INCIDENT_OPEN`. */
	const openIncidents = ref<AssetIncident[]>([]);
	const myIncidents = ref<AssetIncident[]>([]);
	const incidentPage = ref(1);
	const incidentMeta = ref<{ total: number; totalPages: number } | null>(null);
	const loadingIncidents = ref(false);
	const incidentsError = ref<string | null>(null);
	const reporting = ref<{ assignment: AssetAssignment; type: AssetIncidentType } | null>(null);
	const viewingIncident = ref<AssetIncident | null>(null);
	const pdfTarget = ref<string | null>(null);

	/** Module chỉ xem thì mọi route ghi trả 403, nên ẩn hai nút báo. */
	const canReport = computed(() => canWrite('ASSET'));

	const openIncidentKeys = computed(
		() => new Set(openIncidents.value.map(i => `${i.asset.id}-${i.type}`)),
	);

	async function loadOpenIncidents() {
		try {
			const res = await service.myIncidents({ status: 'OPEN', limit: 100 });
			openIncidents.value = res.data;
		} catch {
			// Không lấy được thì cứ hiện nút; BE vẫn chặn nếu đã có báo cáo đang chờ.
			openIncidents.value = [];
		}
	}

	async function loadMyIncidents() {
		loadingIncidents.value = true;
		incidentsError.value = null;
		try {
			const res = await service.myIncidents({ page: incidentPage.value, limit: 10 });
			myIncidents.value = res.data;
			incidentMeta.value = res.meta;
		} catch (e) {
			// Giữ cả mục và báo lỗi tại chỗ: mục biến mất thì nhân viên tưởng báo cáo của mình không còn.
			myIncidents.value = [];
			incidentMeta.value = null;
			incidentsError.value =
				e instanceof Error ? e.message : 'Chưa tải được báo hỏng, báo mất của bạn. Bạn bấm Thử lại.';
		} finally {
			loadingIncidents.value = false;
		}
	}

	function isPhysical(a: AssetAssignment): boolean {
		return a.asset.kind === 'PHYSICAL';
	}

	function canReportType(a: AssetAssignment, type: AssetIncidentType): boolean {
		if (!canReport.value || !isPhysical(a)) return false;
		return canReportIncident(a.asset.status, openIncidentKeys.value.has(`${a.asset.id}-${type}`));
	}

	/** Câu giải thích thay cho nút khi tài sản đang ở trạng thái không báo được. */
	function statusNote(a: AssetAssignment): string {
		if (!isPhysical(a) || !INCIDENT_BLOCKED_STATUSES.includes(a.asset.status)) return '';
		if (a.asset.status === 'LOSS_REPORTED') {
			return 'Thiết bị đang chờ xác minh mất, người quản lý tài sản sẽ báo bạn kết quả.';
		}
		const doing = a.asset.status === 'IN_MAINTENANCE' ? 'bảo dưỡng' : 'sửa';
		return `Thiết bị đang ${doing} nên bạn chưa cần báo thêm. Người quản lý tài sản sẽ báo bạn khi xong.`;
	}

	/**
	 * Huy hiệu của thẻ (F5). Tài sản đang báo mất hay báo hỏng phải nói đúng tình trạng đó, không
	 * để một chip xanh "Đã nhận" khiến người giữ tưởng mọi thứ bình thường.
	 */
	function cardBadges(a: AssetAssignment): { label: string; cls: string }[] {
		const badges: { label: string; cls: string }[] = [];
		if (isPhysical(a) && a.asset.status !== 'IN_USE') {
			badges.push({ label: a.asset.statusLabel, cls: ASSET_STATUS_CLASS[a.asset.status] });
		}
		if (openIncidentKeys.value.has(`${a.asset.id}-DAMAGE`) && a.asset.status !== 'IN_REPAIR') {
			badges.push({ label: 'Đã báo hỏng, chờ xử lý', cls: INCIDENT_TYPE_CLASS.DAMAGE });
		}
		if (a.confirmation !== 'CONFIRMED' || !badges.length) {
			badges.push({ label: a.confirmationLabel, cls: CONFIRMATION_CLASS[a.confirmation] });
		}
		return badges;
	}

	/** Câu cho biết báo cáo đang tới đâu, để "đã xử lý" không bị hiểu nhầm là đã sửa xong (B6). */
	function incidentProgress(item: AssetIncident): string {
		const who = item.handledBy?.name;
		switch (item.status) {
			case 'OPEN':
				return 'Đang chờ người quản lý tài sản xử lý.';
			case 'REPAIR_OPENED':
				return `${who ?? 'Người quản lý tài sản'} đã tạo phiếu sửa, thiết bị đang được sửa.`;
			case 'RESOLVED':
				return item.maintenance
					? `Phiếu sửa đã đóng với kết quả ${item.maintenance.statusLabel}${item.maintenance.doneAt ? ` ngày ${formatDate(item.maintenance.doneAt)}` : ''}.`
					: 'Phiếu sửa đã đóng.';
			case 'LOSS_CONFIRMED':
				return `${who ?? 'Người quản lý tài sản'} đã xác nhận tài sản bị mất.`;
			default:
				return who ? `${who} đã xử lý.` : 'Đã xử lý.';
		}
	}

	async function openHandoverPdf(a: AssetAssignment, kind: 'assign' | 'return') {
		const key = `${a.id}-${kind}`;
		if (pdfTarget.value) return;
		pdfTarget.value = key;
		try {
			const { url } = await service.myHandoverPdf(a.id, kind);
			window.open(url, '_blank', 'noopener');
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa mở được biên bản. Bạn thử lại sau ít phút.');
		} finally {
			pdfTarget.value = null;
		}
	}

	function pdfState(a: AssetAssignment): 'assign' | 'return' | null {
		if (pdfTarget.value === `${a.id}-assign`) return 'assign';
		if (pdfTarget.value === `${a.id}-return`) return 'return';
		return null;
	}

	async function onReported() {
		reporting.value = null;
		// Báo mất đổi trạng thái tài sản ngay, nên tải lại cả danh sách tài sản.
		await Promise.all([loadAssets(), loadOpenIncidents(), loadMyIncidents()]);
	}

	// ─── Tải dữ liệu ──────────────────────────────────────────────────────────────

	/** Tab dịch vụ chỉ hiện khi người này thực sự phụ trách dịch vụ nào đó. */
	const hasServices = computed(() => services.value.length > 0);

	/** Lịch sử tách hai nhóm: tài sản đã thu hồi (kể cả điều chuyển) và tài sản đã ghi nhận mất. */
	const returnedHistory = computed(() => (data.value?.history ?? []).filter(a => a.endReason !== 'LOST'));
	const lostHistory = computed(() => (data.value?.history ?? []).filter(a => a.endReason === 'LOST'));

	async function loadAssets() {
		loadError.value = null;
		try {
			data.value = await service.myAssets();
			setPendingAssetCount(data.value.pendingConfirmationCount);
		} catch (e) {
			data.value = null;
			loadError.value =
				e instanceof Error ? e.message : 'Chưa tải được tài sản của bạn. Bạn bấm Thử lại.';
		}
	}

	async function loadServices() {
		servicesError.value = null;
		try {
			services.value = await service.myServices();
		} catch (e) {
			services.value = [];
			// Không phụ trách dịch vụ nào hay module tắt thì ẩn tab, không báo. Mất mạng hay lỗi máy
			// chủ thì phải nói, kẻo người đang phụ trách dịch vụ tưởng mình hết việc.
			const status = (e as { status?: number }).status;
			if (status == null || status >= 500) {
				servicesError.value =
					e instanceof Error ? e.message : 'Chưa tải được dịch vụ bạn phụ trách. Bạn bấm Thử lại.';
			}
		}
	}

	async function reloadAll() {
		loading.value = true;
		await Promise.all([loadAssets(), loadServices(), loadOpenIncidents(), loadMyIncidents()]);
		loading.value = false;
	}

	onMounted(async () => {
		await reloadAll();
		await applyQuery();
	});

	// Bấm thông báo khi đang đứng sẵn ở trang này chỉ đổi query chứ không tạo lại trang, nên
	// onMounted không chạy lại: phải nghe query để vẫn mở đúng báo cáo hay cuộn tới đúng thẻ.
	watch(
		() => [route.query.incident_id, route.query.asset_id, route.query.open_id, route.query.tab],
		async () => {
			if (loading.value) return;
			await Promise.all([loadAssets(), loadMyIncidents(), loadOpenIncidents()]);
			await applyQuery();
		},
	);

	watch(incidentPage, loadMyIncidents);

	/** Thẻ hoặc báo cáo cần tô nổi sau khi mở từ thông báo. */
	const highlightAssetId = ref<number | null>(null);
	const highlightIncidentId = ref<number | null>(null);

	function scrollToId(id: string) {
		nextTick(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
	}

	/**
	 * Mở từ thông báo.
	 *
	 * `asset_service` mở tab Dịch vụ và bung đúng thẻ; `asset_my_incident` mở đúng báo cáo qua
	 * `?incident_id=`; `asset_holding` cuộn tới thẻ của tài sản qua `?asset_id=`. Dọn query
	 * TRƯỚC khi dùng để F5 không mở lại, giống các trang khác trong app.
	 */
	async function applyQuery() {
		const tab = route.query.tab;
		const rawServiceId = route.query.open_id;
		const incidentId = Number(route.query.incident_id);
		const assetId = Number(route.query.asset_id);
		if (tab !== 'services' && !rawServiceId && !incidentId && !assetId) return;
		highlightAssetId.value = null;
		highlightIncidentId.value = null;

		router.replace({ path: '/assets/my' });

		if (tab === 'services' && hasServices.value) activeTab.value = 'services';
		const serviceId = Number(rawServiceId);
		if (serviceId && !Number.isNaN(serviceId)) expandedService.value = serviceId;

		if (Number.isInteger(assetId) && assetId > 0) {
			highlightAssetId.value = assetId;
			const holding = data.value?.holding.some(a => a.asset.id === assetId);
			scrollToId(holding ? `my-asset-${assetId}` : `my-history-${assetId}`);
		}

		if (Number.isInteger(incidentId) && incidentId > 0) {
			highlightIncidentId.value = incidentId;
			// Không có route lấy một báo cáo của chính mình, nên tìm trong 100 báo cáo gần nhất.
			let found = myIncidents.value.find(i => i.id === incidentId);
			if (!found) {
				try {
					const res = await service.myIncidents({ limit: 100 });
					found = res.data.find(i => i.id === incidentId);
				} catch {
					// Lỗi đã hiện ở khung của mục báo hỏng, báo mất.
				}
			}
			if (found) viewingIncident.value = found;
			else toast.info('Không tìm thấy báo cáo trong thông báo. Bạn xem lại danh sách báo hỏng, báo mất của mình.');
			scrollToId(`my-incident-${incidentId}`);
		}
	}

	function holderNote(a: AssetAssignment): string {
		if (a.department) return `Cấp phát cho ${a.department.name}, bạn chịu trách nhiệm`;
		return '';
	}

	async function onServiceChanged() {
		await loadServices();
	}

	const btnTouch = 'min-h-11 sm:min-h-0';
</script>

<template>
	<div class="space-y-5 pb-40 sm:pb-24">
		<div>
			<h1 class="text-xl font-bold text-gray-900 dark:text-white">Tài sản của tôi</h1>
			<p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
				Thiết bị được cấp phát cho bạn, báo hỏng và báo mất bạn đã gửi, cùng dịch vụ bạn phụ trách.
			</p>
		</div>

		<CommonAppModuleNotice module="ASSET" />

		<div v-if="hasServices" class="border-b border-gray-200 dark:border-gray-700">
			<nav class="-mb-px flex gap-1">
				<button
					type="button"
					:class="[
						'min-h-11 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
						activeTab === 'assets'
							? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
							: 'border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400',
					]"
					@click="activeTab = 'assets'"
				>
					Thiết bị
					<!-- Badge là số lần cấp phát CHỜ XÁC NHẬN, không phải số món đang giữ:
					     nhãn tab vì thế không được trùng chữ với mục "Đang giữ" bên dưới. -->
					<span
						v-if="data?.pendingConfirmationCount"
						:title="`${data.pendingConfirmationCount} lần cấp phát chờ bạn xác nhận`"
						class="ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1 text-xs text-white"
					>
						{{ data.pendingConfirmationCount }}
					</span>
				</button>
				<button
					type="button"
					:class="[
						'min-h-11 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
						activeTab === 'services'
							? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
							: 'border-transparent text-gray-600 hover:text-gray-800 dark:text-gray-400',
					]"
					@click="activeTab = 'services'"
				>
					Dịch vụ tôi phụ trách
					<span class="ml-1 text-xs font-normal text-gray-500">{{ services.length }}</span>
				</button>
			</nav>
		</div>

		<div
			v-if="servicesError && !loading"
			class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20"
		>
			<p class="text-sm text-amber-800 dark:text-amber-300">{{ servicesError }}</p>
			<CommonAppButton size="sm" variant="outline" :class="btnTouch" @click="loadServices">Thử lại</CommonAppButton>
		</div>

		<div v-if="loading" class="space-y-3">
			<div v-for="i in 3" :key="i" class="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<!-- ── Thiết bị ─────────────────────────────────────────────────────── -->
		<template v-else-if="activeTab === 'assets'">
			<div
				v-if="loadError"
				class="flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-10 text-center dark:border-rose-800 dark:bg-rose-900/20"
			>
				<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
				<CommonAppButton variant="outline" :class="btnTouch" @click="reloadAll">Thử lại</CommonAppButton>
			</div>

			<div
				v-else-if="!data?.holding.length && !data?.history.length"
				class="rounded-xl border border-gray-200 bg-white px-4 py-16 text-center dark:border-gray-700 dark:bg-gray-900"
			>
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Bạn chưa được cấp phát tài sản nào. Khi được cấp phát, tài sản sẽ hiện ở đây để bạn xác nhận đã nhận.
				</p>
			</div>

			<template v-else-if="data">
				<!-- Đang giữ -->
				<section>
					<h2 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
						Đang giữ
						<span class="ml-1 text-xs font-normal text-gray-500">{{ data.holding.length }}</span>
					</h2>

					<p
						v-if="!data.holding.length"
						class="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
					>
						Bạn hiện không giữ tài sản nào.
					</p>

					<div v-else class="grid grid-cols-1 gap-3 lg:grid-cols-2">
						<article
							v-for="a in data.holding"
							:id="`my-asset-${a.asset.id}`"
							:key="a.id"
							class="flex flex-col rounded-xl border bg-white p-4 dark:bg-gray-900"
							:class="
								highlightAssetId === a.asset.id
									? 'border-brand-600 bg-brand-50/60 ring-2 ring-brand-400 dark:bg-brand-900/20 dark:ring-brand-700'
									: 'border-gray-200 dark:border-gray-700'
							"
						>
							<div class="flex flex-wrap gap-1">
								<span
									v-for="b in cardBadges(a)"
									:key="b.label"
									class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
									:class="b.cls"
								>
									{{ b.label }}
								</span>
							</div>
							<button type="button" class="mt-2 min-w-0 text-left" @click="viewing = a">
								<p class="font-medium text-gray-900 hover:text-brand-600 dark:text-white">{{ a.asset.name }}</p>
								<p class="text-xs text-gray-600 dark:text-gray-400">
									<span class="font-mono">{{ a.asset.code }}</span><template v-if="a.asset.serialNumber">
										· Số serial <span class="font-mono">{{ a.asset.serialNumber }}</span></template>
								</p>
							</button>

							<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
								{{ a.asset.categoryName }} · nhận ngày {{ formatDate(a.assignedAt) }}
							</p>
							<p v-if="holderNote(a)" class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ holderNote(a) }}</p>
							<p v-if="a.transferredFrom" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
								Nhận từ {{ a.transferredFrom.holderName }} qua điều chuyển
							</p>

							<!-- Phản hồi chưa đúng và câu trả lời của người quản lý tài sản -->
							<div
								v-if="a.disputeReason || a.disputeResponse"
								class="mt-3 space-y-1 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800"
							>
								<p v-if="a.disputeReason" class="break-words text-rose-700 dark:text-rose-400">
									Bạn đã báo: {{ a.disputeReason }}
								</p>
								<p v-if="a.disputeResponse" class="break-words text-gray-800 dark:text-gray-200">
									Người quản lý tài sản trả lời: {{ a.disputeResponse }}
								</p>
							</div>

							<div v-if="canConfirm(a)" class="mt-3 flex flex-wrap gap-2">
								<CommonAppButton size="sm" variant="primary" :class="btnTouch" @click="accepting = a">
									Đã nhận
								</CommonAppButton>
								<CommonAppButton
									v-if="a.confirmation === 'PENDING'"
									size="sm"
									variant="outline"
									:class="btnTouch"
									@click="disputing = a"
								>
									Báo chưa đúng
								</CommonAppButton>
							</div>

							<MyAssetActions
								class="mt-3"
								:button-class="btnTouch"
								:can-report-damage="canReportType(a, 'DAMAGE')"
								:can-report-loss="canReportType(a, 'LOSS')"
								:status-note="statusNote(a)"
								:can-handover-pdf="isPhysical(a)"
								:handover-label="a.transferredFrom ? 'Biên bản điều chuyển' : 'Biên bản bàn giao'"
								:loading-pdf="pdfState(a)"
								@report="reporting = { assignment: a, type: $event }"
								@pdf="openHandoverPdf(a, $event)"
							/>
							<button
								type="button"
								class="mt-3 self-start text-sm text-brand-600 hover:underline dark:text-brand-400"
								:class="btnTouch"
								@click="viewing = a"
							>
								Xem chi tiết cấp phát
							</button>
						</article>
					</div>
				</section>
			</template>

			<!-- Báo hỏng, báo mất của tôi: đặt ngay dưới mục Đang giữ để nhân viên thấy kết quả xử lý. -->
			<section v-if="!loadError && (loadingIncidents || myIncidents.length || incidentsError)">
				<h2 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
					Báo hỏng, báo mất của tôi
					<span v-if="incidentMeta" class="ml-1 text-xs font-normal text-gray-500">{{ incidentMeta.total }}</span>
				</h2>

				<div v-if="loadingIncidents" class="space-y-3">
					<div v-for="i in 2" :key="i" class="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
				</div>

				<div
					v-else-if="incidentsError"
					class="flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center dark:border-rose-800 dark:bg-rose-900/20"
				>
					<p class="text-sm text-rose-700 dark:text-rose-300">{{ incidentsError }}</p>
					<CommonAppButton size="sm" variant="outline" :class="btnTouch" @click="loadMyIncidents">Thử lại</CommonAppButton>
				</div>

				<div v-else class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
					<ul class="divide-y divide-gray-100 dark:divide-gray-800">
						<li
							v-for="item in myIncidents"
							:id="`my-incident-${item.id}`"
							:key="item.id"
							class="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
							:class="highlightIncidentId === item.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''"
						>
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-2">
									<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="INCIDENT_TYPE_CLASS[item.type]">
										{{ item.typeLabel }}
									</span>
									<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium" :class="INCIDENT_STATUS_CLASS[item.status]">
										{{ item.statusLabel }}
									</span>
								</div>
								<p class="mt-1 text-sm text-gray-900 dark:text-white">{{ item.asset.name }}</p>
								<p class="font-mono text-xs text-gray-600 dark:text-gray-400">{{ item.asset.code }}</p>
								<p class="mt-1 break-words text-sm text-gray-600 dark:text-gray-400">{{ item.description }}</p>
								<p class="mt-1 text-sm text-gray-700 dark:text-gray-300">{{ incidentProgress(item) }}</p>
								<p class="mt-1 text-xs text-gray-600 dark:text-gray-400">Gửi lúc {{ formatDateTime(item.createdAt) }}</p>
								<p v-if="item.handlingNote" class="mt-1 break-words text-sm text-gray-600 dark:text-gray-400">
									Ghi chú khi xử lý: {{ item.handlingNote }}
								</p>
							</div>
							<CommonAppButton size="sm" variant="outline" :class="btnTouch" @click="viewingIncident = item">
								Xem chi tiết
							</CommonAppButton>
						</li>
					</ul>

					<div
						v-if="incidentMeta && incidentMeta.totalPages > 1"
						class="flex items-center justify-end border-t border-gray-100 px-4 py-3 dark:border-gray-800"
					>
						<CommonAppPagination
							:current-page="incidentPage"
							:total-pages="incidentMeta.totalPages"
							@update:current-page="incidentPage = $event"
						/>
					</div>
				</div>
			</section>

			<template v-if="data && !loadError">
				<!-- Đã thu hồi (gồm cả điều chuyển sang người khác) -->
				<section v-if="returnedHistory.length">
					<h2 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
						Đã thu hồi
						<span class="ml-1 text-xs font-normal text-gray-500">{{ returnedHistory.length }}</span>
					</h2>
					<div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
						<ul class="divide-y divide-gray-100 dark:divide-gray-800">
							<li
								v-for="a in returnedHistory"
								:id="`my-history-${a.asset.id}`"
								:key="a.id"
								class="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
								:class="highlightAssetId === a.asset.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''"
							>
								<button type="button" class="min-w-0 text-left" @click="viewing = a">
									<p class="text-sm text-gray-900 hover:text-brand-600 dark:text-white">{{ a.asset.name }}</p>
									<p class="font-mono text-xs text-gray-600 dark:text-gray-400">{{ a.asset.code }}</p>
									<p class="text-sm text-gray-600 dark:text-gray-400">
										{{ formatDate(a.assignedAt) }} – {{ formatDate(a.returnedAt) }}, {{ lowerFirst(assignmentEndText(a)) }}<template v-if="a.conditionOnReturnLabel">, tình trạng {{ a.conditionOnReturnLabel.toLowerCase() }}</template>.
									</p>
								</button>
								<MyAssetActions
									:button-class="btnTouch"
									:can-handover-pdf="isPhysical(a)"
									:can-return-pdf="isPhysical(a)"
									:handover-label="a.transferredFrom ? 'Biên bản điều chuyển' : 'Biên bản bàn giao'"
									:return-label="a.endReason === 'TRANSFERRED' ? 'Biên bản điều chuyển' : 'Biên bản thu hồi'"
									:loading-pdf="pdfState(a)"
									@pdf="openHandoverPdf(a, $event)"
								/>
							</li>
						</ul>
					</div>
				</section>

				<!-- Đã ghi nhận mất: không có biên bản thu hồi vì không ai nhận lại tài sản. -->
				<section v-if="lostHistory.length">
					<h2 class="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
						Đã ghi nhận mất
						<span class="ml-1 text-xs font-normal text-gray-500">{{ lostHistory.length }}</span>
					</h2>
					<div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
						<ul class="divide-y divide-gray-100 dark:divide-gray-800">
							<li
								v-for="a in lostHistory"
								:id="`my-history-${a.asset.id}`"
								:key="a.id"
								class="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
								:class="highlightAssetId === a.asset.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''"
							>
								<button type="button" class="min-w-0 text-left" @click="viewing = a">
									<p class="text-sm text-gray-900 hover:text-brand-600 dark:text-white">{{ a.asset.name }}</p>
									<p class="font-mono text-xs text-gray-600 dark:text-gray-400">{{ a.asset.code }}</p>
									<p class="text-sm text-gray-600 dark:text-gray-400">
										Giữ từ {{ formatDate(a.assignedAt) }}, ghi nhận mất ngày {{ formatDate(a.returnedAt) }}
									</p>
								</button>
								<MyAssetActions
									:button-class="btnTouch"
									:can-handover-pdf="isPhysical(a)"
									:loading-pdf="pdfState(a)"
									@pdf="openHandoverPdf(a, $event)"
								/>
							</li>
						</ul>
					</div>
				</section>
			</template>
		</template>

		<!-- ── Dịch vụ tôi phụ trách ────────────────────────────────────────── -->
		<template v-else>
			<div class="space-y-3">
				<MyServiceCard
					v-for="s in services"
					:key="s.id"
					:service="s"
					:expanded="expandedService === s.id"
					@toggle="expandedService = expandedService === s.id ? null : s.id"
					@changed="onServiceChanged"
				/>
			</div>
		</template>

		<ReportIncidentModal
			v-if="reporting"
			:asset-id="reporting.assignment.asset.id"
			:asset-label="`${reporting.assignment.asset.code} · ${reporting.assignment.asset.name}`"
			:type="reporting.type"
			@reported="onReported"
			@close="reporting = null"
		/>

		<!-- Nhân viên chỉ xem lại báo cáo của mình, không có nút xử lý. -->
		<AssetIncidentDetailModal
			v-if="viewingIncident"
			:incident="viewingIncident"
			mine
			@close="viewingIncident = null"
		/>

		<Teleport to="body">
			<!-- Hộp hỏi lại trước khi bấm Đã nhận (O3) -->
			<div
				v-if="accepting"
				class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
				role="dialog"
				aria-modal="true"
				aria-label="Xác nhận đã nhận tài sản"
			>
				<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Xác nhận đã nhận tài sản</h2>
					<p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
						{{ accepting.asset.code }} · {{ accepting.asset.name }}
					</p>
					<dl class="mt-3 space-y-1 text-sm text-gray-700 dark:text-gray-300">
						<div v-if="accepting.asset.serialNumber" class="flex gap-2">
							<dt class="text-gray-600 dark:text-gray-400">Số serial:</dt>
							<dd class="font-mono">{{ accepting.asset.serialNumber }}</dd>
						</div>
						<div v-if="accepting.conditionOnAssignLabel" class="flex gap-2">
							<dt class="text-gray-600 dark:text-gray-400">Tình trạng khi cấp phát:</dt>
							<dd>{{ accepting.conditionOnAssignLabel }}</dd>
						</div>
						<div v-if="accepting.note" class="flex gap-2">
							<dt class="text-gray-600 dark:text-gray-400">Ghi chú:</dt>
							<dd class="break-words">{{ accepting.note }}</dd>
						</div>
					</dl>
					<p class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
						Bấm Đã nhận nghĩa là bạn xác nhận đã nhận đủ tài sản đúng như mô tả.
					</p>
					<div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
						<CommonAppButton variant="secondary" :class="btnTouch" :disabled="submitting" @click="accepting = null">
							Đóng
						</CommonAppButton>
						<CommonAppButton variant="primary" :class="btnTouch" :loading="submitting" @click="confirmAssignment(accepting, true)">
							Đã nhận
						</CommonAppButton>
					</div>
				</div>
			</div>

			<!-- Hộp báo chưa đúng -->
			<div
				v-if="disputing"
				class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
				role="dialog"
				aria-modal="true"
				aria-label="Báo thông tin cấp phát chưa đúng"
			>
				<form class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900" @submit.prevent="confirmAssignment(disputing, false)">
					<h2 class="text-base font-semibold text-gray-900 dark:text-white">Báo thông tin cấp phát chưa đúng</h2>
					<p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
						{{ disputing.asset.code }} · {{ disputing.asset.name }}
					</p>
					<div class="mt-4 space-y-1">
						<label for="dispute-reason" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
							Điều gì chưa đúng <span class="text-red-500">*</span>
						</label>
						<textarea
							id="dispute-reason"
							v-model="disputeReason"
							rows="3"
							placeholder="VD: máy không có sạc kèm theo"
							class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
						<p class="text-sm text-gray-600 dark:text-gray-400">
							Người cấp phát sẽ nhận được thông báo. Sau khi hai bên thống nhất, bạn vẫn bấm Đã nhận được.
						</p>
					</div>
					<div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
						<CommonAppButton
							variant="secondary"
							type="button"
							:class="btnTouch"
							:disabled="submitting"
							@click="disputing = null; disputeReason = ''"
						>
							Đóng
						</CommonAppButton>
						<CommonAppButton
							variant="primary"
							type="submit"
							:class="btnTouch"
							:disabled="!disputeReason.trim()"
							:loading="submitting"
						>
							Gửi phản hồi
						</CommonAppButton>
					</div>
					<p v-if="!disputeReason.trim()" class="mt-2 text-right text-sm text-gray-600 dark:text-gray-400">
						Bạn ghi điều chưa đúng để gửi được phản hồi.
					</p>
				</form>
			</div>

			<!-- Chi tiết một lần cấp phát (O4) -->
			<div
				v-if="viewing"
				class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
				role="dialog"
				aria-modal="true"
				aria-label="Chi tiết cấp phát"
			>
				<div class="my-8 w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-gray-900">
					<div class="flex items-start justify-between gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
						<div class="min-w-0">
							<h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ viewing.asset.name }}</h2>
							<p class="mt-0.5 font-mono text-xs text-gray-600 dark:text-gray-400">{{ viewing.asset.code }}</p>
						</div>
						<button
							type="button"
							class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:h-8 sm:w-8 dark:hover:bg-gray-800"
							aria-label="Đóng chi tiết cấp phát"
							@click="viewing = null"
						>
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
					<dl class="divide-y divide-gray-100 px-6 py-2 text-sm dark:divide-gray-800">
						<div class="flex gap-4 py-2">
							<dt class="w-40 flex-shrink-0 text-gray-600 dark:text-gray-400">Loại</dt>
							<dd class="min-w-0 flex-1 text-gray-900 dark:text-gray-100">{{ viewing.asset.groupName }} → {{ viewing.asset.categoryName }}</dd>
						</div>
						<div class="flex gap-4 py-2">
							<dt class="w-40 flex-shrink-0 text-gray-600 dark:text-gray-400">Số serial</dt>
							<dd class="min-w-0 flex-1 font-mono text-gray-900 dark:text-gray-100">{{ viewing.asset.serialNumber ?? 'Không ghi' }}</dd>
						</div>
						<div class="flex gap-4 py-2">
							<dt class="w-40 flex-shrink-0 text-gray-600 dark:text-gray-400">Người cấp phát</dt>
							<dd class="min-w-0 flex-1 text-gray-900 dark:text-gray-100">{{ viewing.assignedBy.name }}</dd>
						</div>
						<div class="flex gap-4 py-2">
							<dt class="w-40 flex-shrink-0 text-gray-600 dark:text-gray-400">Ngày cấp phát</dt>
							<dd class="min-w-0 flex-1 text-gray-900 dark:text-gray-100">{{ formatDate(viewing.assignedAt) }}</dd>
						</div>
						<div v-if="viewing.transferredFrom" class="flex gap-4 py-2">
							<dt class="w-40 flex-shrink-0 text-gray-600 dark:text-gray-400">Nhận từ</dt>
							<dd class="min-w-0 flex-1 text-gray-900 dark:text-gray-100">{{ viewing.transferredFrom.holderName }}</dd>
						</div>
						<div class="flex gap-4 py-2">
							<dt class="w-40 flex-shrink-0 text-gray-600 dark:text-gray-400">Tình trạng khi cấp phát</dt>
							<dd class="min-w-0 flex-1 text-gray-900 dark:text-gray-100">{{ viewing.conditionOnAssignLabel ?? 'Không ghi' }}</dd>
						</div>
						<div v-if="viewing.expectedReturnDate" class="flex gap-4 py-2">
							<dt class="w-40 flex-shrink-0 text-gray-600 dark:text-gray-400">Ngày dự kiến trả</dt>
							<dd class="min-w-0 flex-1 text-gray-900 dark:text-gray-100">{{ formatDate(viewing.expectedReturnDate) }}</dd>
						</div>
						<div v-if="viewing.note" class="flex gap-4 py-2">
							<dt class="w-40 flex-shrink-0 text-gray-600 dark:text-gray-400">Ghi chú cấp phát</dt>
							<dd class="min-w-0 flex-1 break-words text-gray-900 dark:text-gray-100">{{ viewing.note }}</dd>
						</div>
						<div class="flex gap-4 py-2">
							<dt class="w-40 flex-shrink-0 text-gray-600 dark:text-gray-400">Người nhận xác nhận</dt>
							<dd class="min-w-0 flex-1 text-gray-900 dark:text-gray-100">
								{{ viewing.confirmationLabel }}
								<template v-if="viewing.confirmedAt"> lúc {{ formatDateTime(viewing.confirmedAt) }}</template>
							</dd>
						</div>
						<template v-if="viewing.returnedAt">
							<div class="flex gap-4 py-2">
								<dt class="w-40 flex-shrink-0 text-gray-600 dark:text-gray-400">Kết thúc</dt>
								<dd class="min-w-0 flex-1 text-gray-900 dark:text-gray-100">
									{{ assignmentEndText(viewing) }}, ngày {{ formatDate(viewing.returnedAt) }}
								</dd>
							</div>
							<div v-if="viewing.conditionOnReturnLabel" class="flex gap-4 py-2">
								<dt class="w-40 flex-shrink-0 text-gray-600 dark:text-gray-400">Tình trạng khi thu hồi</dt>
								<dd class="min-w-0 flex-1 text-gray-900 dark:text-gray-100">{{ viewing.conditionOnReturnLabel }}</dd>
							</div>
							<div v-if="viewing.returnNote" class="flex gap-4 py-2">
								<dt class="w-40 flex-shrink-0 text-gray-600 dark:text-gray-400">Ghi chú</dt>
								<dd class="min-w-0 flex-1 break-words text-gray-900 dark:text-gray-100">{{ viewing.returnNote }}</dd>
							</div>
						</template>
					</dl>
					<div class="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
						<MyAssetActions
							:button-class="btnTouch"
							:can-handover-pdf="isPhysical(viewing)"
							:can-return-pdf="isPhysical(viewing) && !!viewing.returnedAt && viewing.endReason !== 'LOST'"
							:handover-label="viewing.transferredFrom ? 'Biên bản điều chuyển' : 'Biên bản bàn giao'"
							:return-label="viewing.endReason === 'TRANSFERRED' ? 'Biên bản điều chuyển' : 'Biên bản thu hồi'"
							:loading-pdf="pdfState(viewing)"
							@pdf="openHandoverPdf(viewing, $event)"
						/>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>
