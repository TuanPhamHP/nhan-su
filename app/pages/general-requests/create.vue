<script setup lang="ts">
	import { storeToRefs } from 'pinia';
	import FlowPreviewPanel from '~/components/modules/general-request/FlowPreviewPanel.vue';
	import RequestAttachments from '~/components/modules/general-request/RequestAttachments.vue';
	import EmployeePicker from '~/components/modules/general-request/EmployeePicker.vue';
	// `app/services/` không được Nuxt auto-import.
	import { useGeneralRequestService } from '~/services/general-request.service';
	import { fieldErrorSentences, mapFieldErrors, requestCodeText } from '~/utils/general-request.utils';
	import {
		REQUEST_CATEGORY_CLASS,
		REQUEST_CATEGORY_LABELS,
		REQUEST_CATEGORY_ORDER,
		type DocumentTemplateDetail,
		type FieldDataSource,
		type FlowPreviewStep,
		type GeneralRequestDetail,
		type PickedApprovers,
	} from '~/types/general-request.types';

	/**
	 * Gửi phiếu đề xuất, và sửa rồi nộp lại phiếu bị trả về (UI-02, lô 4a).
	 *
	 * Từ lô 4a người gửi KHÔNG tự chọn chuỗi người duyệt nữa: luồng duyệt thuộc loại phiếu, máy
	 * chủ tính chuỗi và trả về ở `flow/preview`. Người gửi chỉ chọn người ở những bước luồng khai
	 * là "người gửi chọn", và không chọn được chính mình.
	 *
	 * Trang gọi lại `flow/preview` mỗi khi giá trị biểu mẫu hoặc người được chọn đổi, vì điều
	 * kiện của bước đọc đúng những giá trị đó: sửa số tiền từ 80 lên 120 triệu là chuỗi duyệt đổi
	 * theo. Gọi có trễ một nhịp để người dùng gõ số không bị bắn một loạt request.
	 *
	 * `?id=` mở phiếu có sẵn: nháp đang viết dở, hoặc phiếu "Cần bổ sung" cần sửa rồi nộp lại.
	 * Nộp lại là cùng một route `submit`, số hiệu giữ nguyên và vòng duyệt tăng lên.
	 */
	definePageMeta({ title: 'Gửi phiếu đề xuất' });

	const toast = useToast();
	const route = useRoute();
	const router = useRouter();
	const { user } = useAuth();
	const service = useGeneralRequestService();
	const directoryStore = useDirectoryStore();
	const {
		employees: directoryEmployees,
		departments: directoryDepartments,
		positions: directoryPositions,
		loading: directoryLoading,
	} = storeToRefs(directoryStore);

	/**
	 * Danh bạ dùng cho ô chọn người theo dõi và cho những ô chọn lấy dữ liệu từ danh mục.
	 *
	 * Không chặn theo vai trò: máy chủ cho cả nhân viên đọc danh sách phòng ban và nhân viên, nên
	 * cứ tải rồi dựa vào kết quả. Công ty nào khoá danh bạ thì danh sách rỗng và những ô cần nó tự
	 * ẩn, thay vì hiện một ô chọn trống không giải thích.
	 */
	const directoryReady = computed(() => directoryEmployees.value.length > 0);

	// ─── Bước của trang ───────────────────────────────────────────────────────────
	/** 1 chọn loại phiếu, 2 điền và gửi. Phiếu mở từ `?id=` vào thẳng bước 2. */
	const step = ref<1 | 2>(1);

	const templates = ref<DocumentTemplateDetail[]>([]);
	const templatesLoading = ref(false);
	const template = ref<DocumentTemplateDetail | null>(null);

	/** Phiếu đang soạn trên máy chủ: nháp mới tạo, hoặc phiếu cần bổ sung. */
	const request = ref<GeneralRequestDetail | null>(null);
	const pageLoading = ref(false);

	const title = ref('');
	const fieldValues = reactive<Record<string, unknown>>({});
	const fieldErrors = reactive<Record<string, string>>({});
	const formErrors = ref<string[]>([]);

	/**
	 * Loại phiếu xếp theo nhóm, nhóm "Khác" xuống cuối.
	 *
	 * Trước đây nhóm nào có loại phiếu đầu tiên thì lên trên, nên nhóm "Khác" thường chiếm đầu
	 * trang và đẩy những loại phiếu người dùng thật sự cần xuống dưới.
	 */
	const groupedTemplates = computed(() => {
		const groups = new Map<string, DocumentTemplateDetail[]>();
		for (const t of templates.value) {
			const list = groups.get(t.category) ?? [];
			list.push(t);
			groups.set(t.category, list);
		}
		const rank = (category: string) => {
			const index = REQUEST_CATEGORY_ORDER.indexOf(category);
			return index === -1 ? REQUEST_CATEGORY_ORDER.length - 0.5 : index;
		};
		return [...groups.entries()]
			.sort((a, b) => rank(a[0]) - rank(b[0]))
			.map(([category, list]) => ({ category, list }));
	});

	const systemOptions = computed<Record<FieldDataSource, string[]>>(() => ({
		custom: [],
		departments: directoryDepartments.value.map(d => d.name),
		positions: directoryPositions.value.map(p => p.name),
		employees: directoryEmployees.value.map(e => e.fullName),
	}));

	async function loadTemplates() {
		templatesLoading.value = true;
		try {
			templates.value = await service.findTemplates({ isActive: true });
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa tải được danh sách loại phiếu.');
		} finally {
			templatesLoading.value = false;
		}
	}

	function initFieldValues(detail: DocumentTemplateDetail, values?: Record<string, unknown>) {
		for (const key of Object.keys(fieldValues)) delete fieldValues[key];
		for (const field of detail.fields) {
			const existing = values?.[field.key];
			fieldValues[field.key] = existing ?? field.defaultValue ?? (field.type === 'checkbox' ? false : '');
		}
	}

	/** Mẫu có ô chọn lấy dữ liệu từ danh mục thì phải tải danh mục mới có lựa chọn để hiện. */
	function loadDirectoryIfNeeded(detail: DocumentTemplateDetail) {
		const needs = detail.fields.some(f => f.type === 'select' && f.dataSource && f.dataSource !== 'custom');
		if (!needs) return;
		directoryStore.load().catch(() => {
			toast.error('Chưa tải được danh bạ cho các ô chọn, bạn thử tải lại trang.');
		});
	}

	async function selectTemplate(summary: DocumentTemplateDetail) {
		try {
			const detail = await service.findTemplate(summary.id);
			template.value = detail;
			initFieldValues(detail);
			loadDirectoryIfNeeded(detail);
			step.value = 2;
			schedulePreview(0);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa mở được loại phiếu này.');
		}
	}

	/** Mở phiếu đã có: nháp hoặc phiếu cần bổ sung. */
	async function loadExisting(id: number) {
		pageLoading.value = true;
		try {
			const detail = await service.findOne(id);
			if (!detail.canEdit) {
				toast.error('Phiếu này không còn sửa được nên hệ thống chuyển bạn sang trang xem phiếu.');
				router.replace(`/general-requests/${id}`);
				return;
			}
			request.value = detail;
			title.value = detail.title;
			const tpl = await service.findTemplate(detail.template.id);
			template.value = tpl;
			initFieldValues(tpl, detail.fieldValues);
			loadDirectoryIfNeeded(tpl);
			watcherIds.value = detail.watchers.filter(w => w.source === 'ADDED').map(w => w.employeeId);
			step.value = 2;
			// Tính chuỗi, điền lại người đã chọn ở vòng trước, rồi tính lại để chuỗi hiện đúng họ.
			await loadPreview();
			if (prefillPicks()) await loadPreview();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa mở được phiếu này, bạn thử lại sau ít phút.');
			router.replace('/general-requests');
		} finally {
			pageLoading.value = false;
		}
	}

	// ─── Lưu nháp ─────────────────────────────────────────────────────────────────
	const savingDraft = ref(false);
	let draftTimer: ReturnType<typeof setTimeout> | null = null;

	/** Tạo nháp trên máy chủ nếu chưa có, để đính kèm file và lưu nháp có chỗ bám. */
	async function ensureDraft(): Promise<GeneralRequestDetail | null> {
		if (request.value) return request.value;
		if (!template.value) return null;
		if (!title.value.trim()) {
			fieldErrors.__title = 'Bạn nhập tiêu đề phiếu trước khi lưu nháp.';
			return null;
		}
		try {
			request.value = await service.create({
				templateId: template.value.id,
				title: title.value.trim(),
				fieldValues: { ...fieldValues },
			});
			return request.value;
		} catch (e) {
			applyFieldErrors(e);
			toast.error(e instanceof Error ? e.message : 'Chưa tạo được phiếu nháp.');
			return null;
		}
	}

	async function saveDraft(silent = true): Promise<boolean> {
		const current = await ensureDraft();
		if (!current) return false;
		savingDraft.value = true;
		try {
			request.value = await service.saveDraft(current.id, {
				fieldValues: { ...fieldValues },
				title: title.value.trim() || undefined,
			});
			if (!silent) toast.success('Đã lưu nháp.');
			return true;
		} catch (e) {
			applyFieldErrors(e);
			if (!silent) toast.error(e instanceof Error ? e.message : 'Chưa lưu được nháp.');
			return false;
		} finally {
			savingDraft.value = false;
		}
	}

	/** Người dùng gõ xong một lúc mới lưu nháp, và tính lại chuỗi duyệt. */
	function onFieldInput() {
		if (draftTimer) clearTimeout(draftTimer);
		draftTimer = setTimeout(() => {
			if (request.value) void saveDraft();
		}, 2500);
		schedulePreview();
	}

	function applyFieldErrors(e: unknown): boolean {
		const sentences = fieldErrorSentences(e);
		if (!sentences.length || !template.value) return false;
		const mapped = mapFieldErrors(sentences, template.value.fields);
		for (const key of Object.keys(fieldErrors)) delete fieldErrors[key];
		Object.assign(fieldErrors, mapped.byKey);
		formErrors.value = mapped.rest;
		// Ô sai có thể nằm ngoài tầm nhìn, nhất là biểu mẫu mười một trường trên điện thoại.
		nextTick(scrollToFirstError);
		return true;
	}

	/** Cuộn tới ô sai đầu tiên, để người dùng thấy ngay chỗ phải sửa. */
	function scrollToFirstError() {
		if (!import.meta.client) return;
		const first = document.querySelector<HTMLElement>('[data-field-error="true"]');
		first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	/**
	 * Giá trị của một trường kiểu số, đưa về `number | undefined` cho ô số dùng chung.
	 *
	 * Nháp cũ có thể còn giữ chuỗi (phiếu tạo trước khi có ô số), nên vẫn đọc được chuỗi số.
	 */
	function numberValue(key: string): number | undefined {
		const raw = fieldValues[key];
		if (typeof raw === 'number') return raw;
		if (typeof raw === 'string' && raw.trim() !== '') {
			const n = Number(raw);
			return Number.isFinite(n) ? n : undefined;
		}
		return undefined;
	}

	/** Viền đỏ cho ô đang có lỗi; chỉ dòng chữ đỏ phía dưới thì rất dễ bỏ sót khi cuộn nhanh. */
	function fieldClass(key: string): string {
		return fieldErrors[key]
			? 'border-rose-400 focus:ring-rose-300 dark:border-rose-500'
			: 'border-gray-300 focus:ring-brand-500 dark:border-gray-600';
	}

	function clearErrors() {
		for (const key of Object.keys(fieldErrors)) delete fieldErrors[key];
		formErrors.value = [];
	}

	// ─── Xem trước chuỗi duyệt ────────────────────────────────────────────────────
	const previewSteps = ref<FlowPreviewStep[]>([]);
	const previewLoading = ref(false);
	const previewError = ref<string | null>(null);
	const picked = ref<Record<number, number[]>>({});
	let previewTimer: ReturnType<typeof setTimeout> | null = null;

	function pickedPayload(): PickedApprovers[] {
		return Object.entries(picked.value)
			.filter(([, ids]) => ids.length > 0)
			.map(([stepOrder, employeeIds]) => ({ stepOrder: Number(stepOrder), employeeIds }));
	}

	async function loadPreview() {
		if (!template.value) return;
		previewLoading.value = true;
		previewError.value = null;
		try {
			const res = await service.previewFlow(template.value.id, {
				fieldValues: { ...fieldValues },
				pickedApprovers: pickedPayload(),
			});
			previewSteps.value = res.steps;
		} catch (e) {
			// Chọn sai người (VD chính mình) cũng vào đây: hiện câu của máy chủ ngay cạnh chuỗi.
			previewError.value = e instanceof Error ? e.message : 'Chưa tính được chuỗi người duyệt.';
		} finally {
			previewLoading.value = false;
		}
	}

	function schedulePreview(delay = 600) {
		if (previewTimer) clearTimeout(previewTimer);
		previewTimer = setTimeout(loadPreview, delay);
	}

	function onPickedUpdate(value: Record<number, number[]>) {
		picked.value = value;
		schedulePreview(0);
	}

	/**
	 * Phiếu bị trả lại: điền lại sẵn những người mà người gửi đã chọn ở vòng trước.
	 *
	 * Nộp lại là tính lại chuỗi từ đầu, và máy chủ KHÔNG giữ lựa chọn của vòng cũ (`submit` không
	 * có `pickedApprovers` thì trả 400 `REQUEST_NO_APPROVER`). Bắt người gửi chọn lại từ con số
	 * không chỉ vì họ bổ sung một dòng nội dung là bắt họ làm lại việc đã làm, nên trang tự điền
	 * theo chuỗi của vòng bị trả, giữ nguyên thứ tự, và họ vẫn sửa được.
	 *
	 * Ghép theo `order` của bước: chuỗi vòng cũ tính từ cùng một luồng nên thứ tự bước khớp nhau.
	 * Lượt duyệt thay theo uỷ quyền thì lấy người được chọn ban đầu (`onBehalfOf`), không lấy
	 * người nhận thay.
	 */
	function prefillPicks(): boolean {
		const current = request.value;
		if (!current || !previewSteps.value.length) return false;
		const byOrder = new Map(current.steps.map(step => [step.order, step]));
		const next: Record<number, number[]> = { ...picked.value };
		let changed = false;
		for (const step of previewSteps.value) {
			if (!step.pick || next[step.flowStepOrder]?.length) continue;
			const previous = byOrder.get(step.order);
			if (!previous) continue;
			const ids: number[] = [];
			for (const assignment of previous.assignments) {
				if (assignment.status === 'SUPERSEDED') continue;
				const id = assignment.onBehalfOf?.id ?? assignment.employee.id;
				if (!ids.includes(id)) ids.push(id);
			}
			if (!ids.length) continue;
			next[step.flowStepOrder] = ids.slice(0, step.pick.max);
			changed = true;
		}
		if (changed) picked.value = next;
		return changed;
	}

	/** Bước cần chọn người mà chưa chọn đủ, để chặn trước khi gửi. */
	const unpickedSteps = computed(() =>
		previewSteps.value.filter(s => {
			if (s.skipped || !s.pick) return false;
			const chosen = picked.value[s.flowStepOrder]?.length ?? 0;
			return chosen < s.pick.min;
		}),
	);

	// ─── Người theo dõi ───────────────────────────────────────────────────────────
	const watcherIds = ref<number[]>([]);

	const watcherChoices = computed(() =>
		directoryEmployees.value
			.filter(e => e.id !== user.value?.id)
			.map(e => ({ id: e.id, fullName: e.fullName, hint: e.department?.name ?? e.employeeCode })),
	);

	// ─── Gửi phiếu ────────────────────────────────────────────────────────────────
	const submitting = ref(false);

	async function submit() {
		clearErrors();
		if (!title.value.trim() || title.value.trim().length < 3) {
			fieldErrors.__title = 'Tiêu đề phiếu phải có ít nhất ba ký tự.';
			return;
		}
		if (unpickedSteps.value.length) {
			const names = unpickedSteps.value.map(s => s.name).join(', ');
			toast.error(`Bạn chọn đủ người duyệt cho bước ${names}.`);
			return;
		}
		submitting.value = true;
		try {
			const current = await ensureDraft();
			if (!current) return;
			await service.saveDraft(current.id, {
				fieldValues: { ...fieldValues },
				title: title.value.trim(),
			});
			const submitted = await service.submit(current.id, {
				pickedApprovers: pickedPayload(),
				watcherIds: watcherIds.value.length ? watcherIds.value : undefined,
			});
			toast.success(
				submitted.round > 1
					? `Đã nộp lại phiếu ${requestCodeText(submitted.code)}, vòng ${submitted.round}.`
					: `Đã gửi phiếu, số hiệu ${requestCodeText(submitted.code)}.`,
			);
			router.push(`/general-requests/${submitted.id}`);
		} catch (e) {
			// Lỗi của từng trường đã hiện ngay cạnh ô, nên toast chỉ nói một câu tổng quát thay vì
			// nhắc lại cả chuỗi câu của máy chủ lần thứ hai.
			const perField = applyFieldErrors(e);
			toast.error(
				perField
					? 'Phiếu còn trường chưa hợp lệ, bạn xem các dòng đỏ trong biểu mẫu.'
					: e instanceof Error
						? e.message
						: 'Chưa gửi được phiếu, bạn thử lại sau ít phút.',
			);
		} finally {
			submitting.value = false;
		}
	}

	async function saveDraftAndExit() {
		const ok = await saveDraft(false);
		if (ok) router.push('/general-requests');
	}

	async function reloadRequest() {
		if (!request.value) return;
		try {
			request.value = await service.findOne(request.value.id);
		} catch {
			// Danh sách file không đọc lại được thì vẫn giữ màn hình đang nhập.
		}
	}

	onMounted(() => {
		const raw = route.query.id;
		if (raw) {
			const id = Number(raw);
			if (id && !Number.isNaN(id)) {
				loadExisting(id);
				return;
			}
		}
		loadTemplates();
		// Ô người theo dõi cần danh bạ; công ty nào không mở danh bạ thì ô đó tự ẩn.
		directoryStore.load().catch(() => {});
	});

	onUnmounted(() => {
		if (draftTimer) clearTimeout(draftTimer);
		if (previewTimer) clearTimeout(previewTimer);
	});

	const isResubmit = computed(() => request.value?.status === 'RETURNED');
</script>

<template>
	<div class="mx-auto max-w-3xl space-y-6">
		<!-- Đầu trang -->
		<div class="flex items-center gap-3">
			<NuxtLink
				to="/general-requests"
				class="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
				</svg>
			</NuxtLink>
			<div>
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">
					{{ isResubmit ? 'Sửa và nộp lại phiếu' : 'Gửi phiếu đề xuất' }}
				</h1>
				<p v-if="request?.code" class="text-sm text-gray-500 dark:text-gray-400">
					Số hiệu {{ request.code }}, vòng {{ request.round }}
				</p>
			</div>
		</div>

		<div v-if="pageLoading" class="space-y-3">
			<div class="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			<div class="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<!-- ═══════════════════ Bước 1: chọn loại phiếu ═══════════════════ -->
		<template v-else-if="step === 1">
			<div v-if="templatesLoading" class="space-y-2">
				<div v-for="i in 3" :key="i" class="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
			</div>

			<div
				v-else-if="!templates.length"
				class="rounded-xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
			>
				Chưa có loại phiếu nào đang dùng. Bạn liên hệ phòng nhân sự để mở loại phiếu.
			</div>

			<div v-else class="space-y-5">
				<section v-for="group in groupedTemplates" :key="group.category" class="space-y-3">
					<span
						class="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
						:class="REQUEST_CATEGORY_CLASS[group.category] ?? REQUEST_CATEGORY_CLASS.OTHER"
					>
						{{ REQUEST_CATEGORY_LABELS[group.category] ?? group.category }}
					</span>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<!-- `h-full` cho các thẻ cùng hàng cao bằng nhau dù mẫu có mô tả hay không -->
						<button
							v-for="t in group.list"
							:key="t.id"
							type="button"
							class="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-brand-400 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-600"
							@click="selectTemplate(t)"
						>
							<div class="flex items-start justify-between gap-2">
								<p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t.name }}</p>
								<span
									class="flex-shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
									:title="`Số hiệu phiếu bắt đầu bằng ${t.codePrefix}`"
								>
									{{ t.codePrefix }}
								</span>
							</div>
							<p v-if="t.description" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t.description }}</p>
						</button>
					</div>
				</section>
			</div>
		</template>

		<!-- ═══════════════════ Bước 2: điền và gửi ═══════════════════ -->
		<template v-else-if="template">
			<div class="space-y-4 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ template.name }}</h2>
					<button
						v-if="!request"
						type="button"
						class="text-xs text-gray-400 hover:text-brand-600 dark:hover:text-brand-400"
						@click="step = 1"
					>
						Đổi loại phiếu
					</button>
				</div>

				<div
					v-if="isResubmit"
					class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200"
				>
					Phiếu này bị trả lại để bổ sung. Bạn sửa thông tin rồi bấm "Nộp lại phiếu", phiếu sẽ được duyệt lại từ bước
					đầu và giữ nguyên số hiệu.
				</div>

				<ul
					v-if="formErrors.length"
					class="space-y-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/10 dark:text-rose-200"
				>
					<li v-for="message in formErrors" :key="message">{{ message }}</li>
				</ul>

				<!-- Tiêu đề -->
				<div class="space-y-1" :data-field-error="!!fieldErrors.__title">
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						Tiêu đề phiếu <span class="text-rose-500">*</span>
					</label>
					<input
						v-model="title"
						type="text"
						placeholder="Ví dụ: Mua hai máy tính cho phòng kinh doanh"
						class="w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 dark:bg-gray-800 dark:text-gray-100"
						:class="fieldClass('__title')"
						@input="onFieldInput"
					/>
					<p v-if="fieldErrors.__title" class="text-xs text-rose-600 dark:text-rose-400">{{ fieldErrors.__title }}</p>
				</div>

				<!-- Các trường của mẫu -->
				<div
					v-for="field in template.fields"
					:key="field.key"
					class="space-y-1"
					:data-field-error="!!fieldErrors[field.key]"
				>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
						{{ field.label }}
						<span v-if="field.required" class="text-rose-500">*</span>
					</label>

					<textarea
						v-if="field.type === 'textarea'"
						v-model="(fieldValues as Record<string, string>)[field.key]"
						rows="3"
						:placeholder="field.placeholder"
						class="w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 dark:bg-gray-800 dark:text-gray-100"
						:class="fieldClass(field.key)"
						@input="onFieldInput"
					/>

					<UiDatePicker
						v-else-if="field.type === 'date'"
						:model-value="(fieldValues as Record<string, string>)[field.key]"
						@update:model-value="
							value => {
								fieldValues[field.key] = value ?? '';
								onFieldInput();
							}
						"
					/>

					<UiSelect
						v-else-if="field.type === 'select'"
						:model-value="(fieldValues as Record<string, string>)[field.key]"
						:options="
							(!field.dataSource || field.dataSource === 'custom' ? (field.options ?? []) : systemOptions[field.dataSource]).map(
								opt => ({ value: opt, label: opt }),
							)
						"
						:disabled="!!(field.dataSource && field.dataSource !== 'custom' && directoryLoading)"
						:placeholder="
							field.dataSource && field.dataSource !== 'custom' && directoryLoading ? 'Đang tải…' : 'Chọn một giá trị'
						"
						@update:model-value="
							value => {
								fieldValues[field.key] = value ?? '';
								onFieldInput();
							}
						"
					/>

					<label v-else-if="field.type === 'checkbox'" class="flex cursor-pointer items-center gap-2">
						<input
							v-model="(fieldValues as Record<string, boolean>)[field.key]"
							type="checkbox"
							class="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
							@change="onFieldInput"
						/>
						<span class="text-sm text-gray-600 dark:text-gray-400">{{ field.placeholder || field.label }}</span>
					</label>

					<!-- Trường kiểu số dùng ô số dùng chung: gõ 80000 thì hiện 80.000, gửi lên vẫn là 80000. -->
					<UiNumberInput
						v-else-if="field.type === 'number'"
						:model-value="numberValue(field.key)"
						:decimals="2"
						:placeholder="field.placeholder"
						:input-class="[
							'w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 dark:bg-gray-800 dark:text-gray-100',
							fieldClass(field.key),
						]"
						@update:model-value="
							value => {
								fieldValues[field.key] = value;
								onFieldInput();
							}
						"
					/>

					<input
						v-else
						v-model="(fieldValues as Record<string, string>)[field.key]"
						type="text"
						:placeholder="field.placeholder"
						class="w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 dark:bg-gray-800 dark:text-gray-100"
						:class="fieldClass(field.key)"
						@input="onFieldInput"
					/>

					<p v-if="fieldErrors[field.key]" class="text-xs text-rose-600 dark:text-rose-400">
						{{ fieldErrors[field.key] }}
					</p>
				</div>
			</div>

			<!-- Chuỗi người duyệt -->
			<FlowPreviewPanel
				:steps="previewSteps"
				:loading="previewLoading"
				:picked="picked"
				:error="previewError"
				@update:picked="onPickedUpdate"
			/>

			<!-- Người theo dõi -->
			<section
				v-if="directoryReady"
				class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
			>
				<h2 class="text-sm font-semibold text-gray-900 dark:text-white">Người theo dõi</h2>
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Người theo dõi nhận thông báo về phiếu và xem được phiếu, nhưng không tham gia duyệt. Loại phiếu có thể đã
					gắn sẵn người theo dõi mặc định.
				</p>
				<div class="mt-3">
					<EmployeePicker v-model="watcherIds" :people="watcherChoices" />
				</div>
			</section>

			<!-- Tệp đính kèm: cần có phiếu trên máy chủ mới đính kèm được -->
			<RequestAttachments
				v-if="request"
				:request-id="request.id"
				:attachments="request.attachments"
				:can-attach="request.canAttach"
				@changed="reloadRequest"
			/>
			<section
				v-else
				class="rounded-xl border border-dashed border-gray-300 bg-white p-5 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400"
			>
				Tệp phải gắn vào một phiếu đã có, nên bạn nhập tiêu đề và nội dung trước; hệ thống tự lưu nháp sau vài giây rồi
				khối đính kèm tệp hiện ra ngay đây.
			</section>

			<!--
				Trên điện thoại biểu mẫu dài hơn một màn hình, nên thanh nút dính ở đáy để người dùng
				không phải cuộn hết mới gửi được. Từ khổ máy tính trở lên nó trở lại một hàng thường.
			-->
			<div
				class="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-950/95 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none dark:sm:bg-transparent"
			>
				<span v-if="request" class="text-xs text-gray-400">
					{{ savingDraft ? 'Đang lưu nháp…' : 'Đã lưu nháp.' }}
				</span>
				<div class="ml-auto flex flex-wrap gap-2">
					<CommonAppButton variant="secondary" :loading="savingDraft" @click="saveDraftAndExit">
						Lưu nháp và thoát
					</CommonAppButton>
					<CommonAppButton :loading="submitting" @click="submit">
						{{ isResubmit ? 'Nộp lại phiếu' : 'Gửi phiếu' }}
					</CommonAppButton>
				</div>
			</div>
		</template>
	</div>
</template>
