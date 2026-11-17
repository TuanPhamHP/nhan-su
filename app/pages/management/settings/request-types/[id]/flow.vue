<script setup lang="ts">
	import { storeToRefs } from 'pinia';
	import EmployeePicker from '~/components/modules/general-request/EmployeePicker.vue';
	import { useGeneralRequestService } from '~/services/general-request.service';
	import { REQUEST_PERMISSIONS } from '~/utils/permission';
	import { apiErrorCode } from '~/utils/asset.utils';
	import {
		buildFlowPayload,
		conditionFieldOptions,
		conditionText,
		conditionValueInput,
		parseConditionValue,
		pickText,
		validateFlowDraft,
	} from '~/utils/general-request.utils';
	import {
		APPROVAL_MODE_LABELS,
		APPROVER_KIND_HINTS,
		APPROVER_KIND_LABELS,
		CONDITION_OP_LABELS,
		FLOW_ROLE_LABELS,
		type ApproverKind,
		type DocumentTemplateDetail,
		type FlowCondition,
		type FlowConditionOp,
		type FlowRole,
		type FlowStep,
	} from '~/types/general-request.types';

	/**
	 * Màn cấu hình luồng duyệt của một loại phiếu (UI-05, lô 4a).
	 *
	 * Luồng là danh sách bước theo thứ tự, mỗi bước khai NGƯỜI DUYỆT LÀ AI theo một trong sáu
	 * kiểu, cần một người đồng ý hay tất cả, hạn xử lý tính bằng giờ làm việc, và điều kiện để
	 * bước có hiệu lực. Bước có điều kiện không khớp thì phiếu bỏ qua bước đó và ghi lý do.
	 *
	 * Lưu là tạo một PHIÊN BẢN MỚI: phiếu đang chạy giữ chuỗi duyệt tính lúc gửi, nên sửa luồng
	 * không làm xáo trộn phiếu đang đi. Nếu người khác vừa lưu trước mình thì máy chủ trả 409
	 * `APPROVAL_FLOW_CHANGED` và trang tải lại luồng của họ, vì ghi đè lên luồng vừa lưu của người
	 * khác là mất việc của họ mà không ai biết.
	 *
	 * Người duyệt kiểu "người gửi chọn" giữ cả `min`, `max` và cờ duyệt lần lượt: lần lượt thì mỗi
	 * người được chọn thành một bước riêng, chọn cùng lúc thì họ nằm trong một bước theo chế độ.
	 */
	definePageMeta({ title: 'Luồng duyệt' });

	const route = useRoute();
	const toast = useToast();
	const service = useGeneralRequestService();
	const { hasPermission } = usePermissions();
	const directoryStore = useDirectoryStore();
	const { employees: directoryEmployees, departments: directoryDepartments } = storeToRefs(directoryStore);

	const templateId = Number(route.params.id);
	const canManage = computed(() => hasPermission(REQUEST_PERMISSIONS.typeManage));

	const template = ref<DocumentTemplateDetail | null>(null);
	const steps = ref<FlowStep[]>([]);
	const version = ref(0);
	const loading = ref(true);
	const loadError = ref<string | null>(null);
	const saving = ref(false);
	const errors = ref<string[]>([]);

	const people = computed(() =>
		directoryEmployees.value.map(e => ({ id: e.id, fullName: e.fullName, hint: e.department?.name ?? e.employeeCode })),
	);
	const kindOptions = Object.entries(APPROVER_KIND_LABELS).map(([value, label]) => ({ value, label }));
	const roleOptions = Object.entries(FLOW_ROLE_LABELS).map(([value, label]) => ({ value, label }));
	const modeOptions = Object.entries(APPROVAL_MODE_LABELS).map(([value, label]) => ({ value, label }));
	const opOptions = Object.entries(CONDITION_OP_LABELS).map(([value, label]) => ({ value, label }));
	const fieldOptions = computed(() => conditionFieldOptions(template.value?.fields ?? []));

	async function load() {
		loading.value = true;
		loadError.value = null;
		try {
			const [detail, flow] = await Promise.all([service.findTemplate(templateId), service.findFlow(templateId)]);
			template.value = detail;
			version.value = flow.version;
			steps.value = flow.steps.map(normalizeStep);
			clearConditionDrafts();
		} catch (e) {
			loadError.value = e instanceof Error ? e.message : 'Chưa tải được luồng duyệt.';
		} finally {
			loading.value = false;
		}
	}

	/**
	 * Mỗi bước trên màn giữ sẵn tham số của CẢ sáu kiểu người duyệt.
	 *
	 * Người dùng đổi kiểu qua lại để xem thử mà không mất thứ vừa nhập ở kiểu trước. Lúc lưu thì
	 * `buildFlowPayload` chỉ gửi tham số của kiểu đang chọn, nên máy chủ không nhận khoá thừa.
	 */
	function normalizeStep(step: FlowStep): FlowStep {
		return {
			name: step.name,
			mode: step.mode,
			slaHours: step.slaHours,
			approver: {
				kind: step.approver.kind,
				level: step.approver.level ?? 1,
				employeeIds: step.approver.employeeIds ?? [],
				role: step.approver.role,
				pick: step.approver.pick ?? { roles: [], min: 1, max: 1, sequential: false },
			},
			condition: step.condition ?? { all: [], any: [] },
		};
	}

	onMounted(() => {
		load();
		directoryStore.load().catch(() => {
			toast.error('Chưa tải được danh bạ, nên ô chọn người duyệt của bước sẽ trống.');
		});
	});

	// ─── Sửa bước ─────────────────────────────────────────────────────────────────
	function addStep() {
		steps.value = [
			...steps.value,
			normalizeStep({
				name: `Bước ${steps.value.length + 1}`,
				mode: 'ANY',
				approver: { kind: 'DEPARTMENT_HEAD' },
				slaHours: 16,
			}),
		];
	}

	function removeStep(index: number) {
		steps.value.splice(index, 1);
	}

	function moveStep(index: number, delta: -1 | 1) {
		const next = index + delta;
		if (next < 0 || next >= steps.value.length) return;
		const list = [...steps.value];
		const tmp = list[index]!;
		list[index] = list[next]!;
		list[next] = tmp;
		steps.value = list;
	}

	function setKind(step: FlowStep, kind: ApproverKind) {
		step.approver.kind = kind;
	}

	function togglePickRole(step: FlowStep, role: FlowRole) {
		const pick = step.approver.pick!;
		pick.roles = pick.roles.includes(role) ? pick.roles.filter(r => r !== role) : [...pick.roles, role];
	}

	// ─── Điều kiện ────────────────────────────────────────────────────────────────
	/** Nhóm điều kiện đang dùng: khớp tất cả, hay khớp một trong các dòng. */
	function conditionMode(step: FlowStep): 'all' | 'any' {
		return step.condition?.any?.length ? 'any' : 'all';
	}

	function conditionRows(step: FlowStep) {
		return conditionMode(step) === 'any' ? (step.condition!.any ?? []) : (step.condition!.all ?? []);
	}

	function setConditionMode(step: FlowStep, mode: 'all' | 'any') {
		const rows = conditionRows(step);
		step.condition = mode === 'any' ? { all: [], any: [...rows] } : { all: [...rows], any: [] };
	}

	function addCondition(step: FlowStep) {
		const rows = [...conditionRows(step), { field: '', op: '=' as FlowConditionOp, value: '' }];
		step.condition = conditionMode(step) === 'any' ? { all: [], any: rows } : { all: rows, any: [] };
	}

	function removeCondition(step: FlowStep, index: number) {
		const rows = [...conditionRows(step)];
		rows.splice(index, 1);
		step.condition = conditionMode(step) === 'any' ? { all: [], any: rows } : { all: rows, any: [] };
	}

	/** Kiểu của trường được chọn, để đổi chữ người dùng gõ thành số hay đúng sai khi lưu. */
	function fieldKind(field: string): 'number' | 'checkbox' | 'department' | 'text' {
		if (field === 'submitter.departmentId') return 'department';
		const def = template.value?.fields.find(f => f.key === field);
		if (def?.type === 'number') return 'number';
		if (def?.type === 'checkbox') return 'checkbox';
		return 'text';
	}

	/**
	 * Chữ người dùng đang gõ ở ô giá trị điều kiện, giữ riêng cho từng dòng.
	 *
	 * Ô này vẽ lại từ giá trị đã phân tích, nên nếu chỉ dựa vào đó thì không gõ nổi một danh
	 * sách: gõ `1.000; 2.000` thì ngay sau dấu chấm, giá trị đã thành số 1000 và ô vẽ lại thành
	 * "1000", dấu chấm và dấu chấm phẩy biến mất, cuối cùng ra một số 10002000. Giữ chữ thô ở
	 * đây để người dùng gõ xong câu của mình, rời ô mới chuẩn hoá lại theo giá trị đã lưu.
	 */
	const conditionDrafts = reactive<Record<string, string>>({});

	function draftKey(stepIndex: number, rowIndex: number): string {
		return `${stepIndex}:${rowIndex}`;
	}

	function conditionInputText(stepIndex: number, rowIndex: number, row: FlowCondition): string {
		return conditionDrafts[draftKey(stepIndex, rowIndex)] ?? conditionValueInput(row.value);
	}

	function updateConditionValue(step: FlowStep, index: number, raw: string, stepIndex?: number) {
		const rows = conditionRows(step);
		const row = rows[index];
		if (!row) return;
		if (stepIndex !== undefined) conditionDrafts[draftKey(stepIndex, index)] = raw;
		row.value = parseConditionValue(raw, row.op, fieldKind(row.field));
	}

	/** Rời ô thì bỏ chữ thô, để ô hiện lại đúng giá trị đã lưu (số có dấu nhóm, danh sách có dấu chấm phẩy). */
	function normalizeConditionInput(stepIndex: number, rowIndex: number) {
		delete conditionDrafts[draftKey(stepIndex, rowIndex)];
	}

	/** Đổi trường hay phép so thì chữ thô cũ không còn nghĩa. */
	function clearConditionDrafts() {
		for (const key of Object.keys(conditionDrafts)) delete conditionDrafts[key];
	}

	/** Điều kiện so một giá trị trên trường số thì dùng ô số dùng chung. */
	function isNumberCondition(row: FlowCondition): boolean {
		const kind = fieldKind(row.field);
		return row.op !== 'in' && (kind === 'number' || kind === 'department');
	}

	function setConditionNumber(step: FlowStep, index: number, value: number | undefined) {
		const row = conditionRows(step)[index];
		if (!row) return;
		row.value = value ?? '';
	}

	function updateConditionOp(step: FlowStep, index: number, op: FlowConditionOp) {
		const row = conditionRows(step)[index];
		if (!row) return;
		clearConditionDrafts();
		row.op = op;
		row.value = parseConditionValue(conditionValueInput(row.value), op, fieldKind(row.field));
	}

	function updateConditionField(step: FlowStep, index: number, field: string) {
		const row = conditionRows(step)[index];
		if (!row) return;
		clearConditionDrafts();
		row.field = field;
		row.value = parseConditionValue(conditionValueInput(row.value), row.op, fieldKind(field));
	}

	/** Gợi ý giá trị cho ô điều kiện: phòng ban và vai trò có danh sách sẵn. */
	function valueHint(field: string, op?: FlowConditionOp): string | null {
		if (field === 'submitter.departmentId') {
			const list = directoryDepartments.value.map(d => `${d.name} là ${d.id}`).join(', ');
			return list ? `Bạn nhập mã số phòng ban, ví dụ ${list}.` : 'Bạn nhập mã số phòng ban của người gửi.';
		}
		if (field === 'submitter.role') return 'Bạn nhập mã vai trò, ví dụ HR là Nhân sự, MANAGER là Trưởng phòng, DIRECTOR là Giám đốc.';
		if (op === 'in') return 'Nhiều giá trị thì bạn cách nhau bằng dấu chấm phẩy, vì dấu phẩy là dấu thập phân.';
		if (fieldKind(field) === 'checkbox') return 'Bạn nhập true khi muốn khớp ô đã tích, false khi muốn khớp ô chưa tích.';
		return null;
	}

	// ─── Lưu ──────────────────────────────────────────────────────────────────────
	/**
	 * Bước nào đang sai, để tô viền và cuộn tới.
	 *
	 * Danh sách lỗi ở đầu trang nói đúng bước số mấy, nhưng bước đó có thể nằm ngoài tầm nhìn,
	 * nhất là khi luồng có nhiều bước; chỉ một dòng chữ ở trên thì người dùng không biết cuộn
	 * đi đâu.
	 */
	const invalidSteps = computed(() => {
		const set = new Set<number>();
		for (const message of errors.value) {
			const m = /^Bước (\d+)|bước (\d+)/.exec(message);
			const index = Number(m?.[1] ?? m?.[2]);
			if (index) set.add(index - 1);
		}
		return set;
	});

	async function save() {
		errors.value = validateFlowDraft(steps.value);
		if (errors.value.length) {
			toast.error('Luồng duyệt còn chỗ chưa hợp lệ, bạn xem danh sách lỗi ở đầu trang.');
			await nextTick();
			const first = document.querySelector<HTMLElement>('[data-step-invalid="true"]');
			first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			return;
		}
		saving.value = true;
		try {
			// Gửi kèm phiên bản đang mở: người khác vừa lưu thì máy chủ trả 409 và việc của họ còn.
			const flow = await service.saveFlow(templateId, {
				steps: buildFlowPayload(steps.value),
				expectedVersion: version.value,
			});
			version.value = flow.version;
			steps.value = flow.steps.map(normalizeStep);
			toast.success(`Đã lưu luồng duyệt, phiên bản ${flow.version}.`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Chưa lưu được luồng duyệt.');
			// Người khác vừa lưu một phiên bản khác: đọc lại để không ghi đè việc của họ.
			if (apiErrorCode(e) === 'APPROVAL_FLOW_CHANGED') load();
		} finally {
			saving.value = false;
		}
	}
</script>

<template>
	<div class="space-y-5">
		<div class="flex flex-wrap items-start gap-3">
			<NuxtLink
				to="/management/settings/request-types"
				class="mt-0.5 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
				</svg>
			</NuxtLink>
			<div class="min-w-0 flex-1">
				<h1 class="text-xl font-semibold text-gray-900 dark:text-white">
					Luồng duyệt{{ template ? ` của loại phiếu ${template.name}` : '' }}
				</h1>
				<p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
					Phiên bản hiện tại {{ version }}. Lưu luồng mới không ảnh hưởng tới những phiếu đang duyệt.
				</p>
			</div>
		</div>

		<div
			v-if="!canManage"
			class="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900"
		>
			<p class="text-base font-medium text-gray-900 dark:text-white">Bạn không có quyền sửa luồng duyệt</p>
			<p class="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
				Việc này cần quyền quản lý loại phiếu. Bạn vẫn xem được luồng hiện tại ở dưới.
			</p>
		</div>

		<div v-if="loading" class="space-y-2">
			<div v-for="i in 2" :key="i" class="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
		</div>

		<div
			v-else-if="loadError"
			class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900/40 dark:bg-rose-900/10"
		>
			<p class="text-sm text-rose-700 dark:text-rose-300">{{ loadError }}</p>
			<CommonAppButton size="sm" variant="outline" @click="load">Thử lại</CommonAppButton>
		</div>

		<template v-else>
			<ul
				v-if="errors.length"
				class="space-y-1 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-900/10 dark:text-rose-200"
			>
				<li v-for="message in errors" :key="message">{{ message }}</li>
			</ul>

			<p
				v-if="!steps.length"
				class="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400"
			>
				Luồng này chưa có bước nào. Bạn thêm bước đầu tiên để phiếu có người duyệt.
			</p>

			<ol class="space-y-4">
				<li
					v-for="(step, index) in steps"
					:key="index"
					:data-step-invalid="invalidSteps.has(index)"
					class="space-y-4 rounded-xl border bg-white p-4 dark:bg-gray-900"
					:class="
						invalidSteps.has(index)
							? 'border-rose-300 ring-1 ring-rose-200 dark:border-rose-900/60 dark:ring-rose-900/40'
							: 'border-gray-200 dark:border-gray-700'
					"
				>
					<div class="flex flex-wrap items-center justify-between gap-2">
						<span
							class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
						>
							{{ index + 1 }}
						</span>
						<!--
							Nút đủ cao để bấm trên điện thoại, và nút xoá tách hẳn sang phải để ngón tay không
							trượt từ "Chuyển xuống" sang xoá cả bước.
						-->
						<div class="flex items-center gap-1">
							<button
								type="button"
								class="min-h-11 rounded-md px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-700"
								:disabled="!canManage || index === 0"
								@click="moveStep(index, -1)"
							>
								Chuyển lên
							</button>
							<button
								type="button"
								class="min-h-11 rounded-md px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-700"
								:disabled="!canManage || index === steps.length - 1"
								@click="moveStep(index, 1)"
							>
								Chuyển xuống
							</button>
							<button
								type="button"
								class="ml-4 min-h-11 rounded-md px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40 dark:text-rose-400 dark:hover:bg-rose-900/20"
								:disabled="!canManage"
								@click="removeStep(index)"
							>
								Xoá bước
							</button>
						</div>
					</div>

					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tên bước</label>
							<input
								v-model="step.name"
								type="text"
								maxlength="100"
								:disabled="!canManage"
								placeholder="VD Trưởng phòng duyệt"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>
						<UiSelect
							:model-value="step.approver.kind"
							:options="kindOptions"
							label="Người duyệt của bước"
							:disabled="!canManage"
							:hint="APPROVER_KIND_HINTS[step.approver.kind]"
							@update:model-value="value => setKind(step, value as ApproverKind)"
						/>
					</div>

					<!-- Tham số theo kiểu người duyệt -->
					<div v-if="step.approver.kind === 'MANAGER_LEVEL'" class="max-w-xs space-y-1">
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Bậc quản lý</label>
						<UiNumberInput
							v-model="step.approver.level"
							:min="1"
							:max="5"
							:disabled="!canManage"
						/>
						<p class="text-xs text-gray-500 dark:text-gray-400">Một là quản lý trực tiếp, hai là cấp trên của người đó.</p>
					</div>

					<EmployeePicker
						v-else-if="step.approver.kind === 'EMPLOYEES'"
						v-model="step.approver.employeeIds!"
						:people="people"
						:disabled="!canManage"
						label="Người duyệt của bước này"
					/>

					<UiSelect
						v-else-if="step.approver.kind === 'ROLE'"
						:model-value="step.approver.role"
						:options="roleOptions"
						label="Vai trò người duyệt"
						placeholder="Chọn vai trò"
						:disabled="!canManage"
						@update:model-value="value => (step.approver.role = value as FlowRole)"
					/>

					<div v-else-if="step.approver.kind === 'SUBMITTER_PICK'" class="space-y-3">
						<div>
							<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Người gửi được chọn trong nhóm</p>
							<div class="mt-1.5 flex flex-wrap gap-2">
								<button
									v-for="role in roleOptions"
									:key="role.value"
									type="button"
									class="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors"
									:class="
										step.approver.pick!.roles.includes(role.value as FlowRole)
											? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
											: 'border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300'
									"
									:disabled="!canManage"
									@click="togglePickRole(step, role.value as FlowRole)"
								>
									{{ role.label }}
								</button>
							</div>
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								Không chọn nhóm nào thì người gửi chọn được mọi người đang làm việc.
							</p>
						</div>
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
							<div class="space-y-1">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Chọn ít nhất</label>
								<UiNumberInput v-model="step.approver.pick!.min" :min="1" :disabled="!canManage" />
							</div>
							<div class="space-y-1">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Chọn nhiều nhất</label>
								<UiNumberInput v-model="step.approver.pick!.max" :min="1" :disabled="!canManage" />
							</div>
							<label class="flex cursor-pointer items-center gap-2 pt-6">
								<input
									v-model="step.approver.pick!.sequential"
									type="checkbox"
									:disabled="!canManage"
									class="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
								/>
								<span class="text-sm text-gray-600 dark:text-gray-400">Duyệt lần lượt</span>
							</label>
						</div>
						<p class="text-xs text-gray-500 dark:text-gray-400">{{ pickText(step.approver.pick) }}</p>
					</div>

					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<UiSelect
							:model-value="step.mode"
							:options="modeOptions"
							label="Số người cần đồng ý"
							:disabled="!canManage"
							@update:model-value="value => (step.mode = value === 'ALL' ? 'ALL' : 'ANY')"
						/>
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Hạn xử lý (giờ làm việc)</label>
							<UiNumberInput
								v-model="step.slaHours"
								:min="1"
								:max="400"
								:disabled="!canManage"
								placeholder="Để trống là không có hạn"
							/>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Tính theo giờ làm việc từ thứ Hai đến thứ Sáu, trừ ngày lễ. Mười sáu giờ là hai ngày làm việc.
							</p>
						</div>
					</div>

					<!-- Điều kiện -->
					<div class="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Điều kiện để bước này được áp dụng</p>
							<!-- Chưa có dòng điều kiện nào thì hai lựa chọn này không tác động gì, nên ẩn cho gọn. -->
							<div v-if="conditionRows(step).length" class="flex items-center gap-1">
								<button
									v-for="opt in [
										{ value: 'all', label: 'Khớp tất cả các dòng' },
										{ value: 'any', label: 'Khớp một trong các dòng' },
									]"
									:key="opt.value"
									type="button"
									class="rounded-md px-2 py-1 text-xs font-medium transition-colors"
									:class="
										conditionMode(step) === opt.value
											? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
											: 'text-gray-500 dark:text-gray-400'
									"
									:disabled="!canManage"
									@click="setConditionMode(step, opt.value as 'all' | 'any')"
								>
									{{ opt.label }}
								</button>
							</div>
						</div>

						<p v-if="!conditionRows(step).length" class="text-xs text-gray-500 dark:text-gray-400">
							Không có điều kiện nào, nên bước này luôn được áp dụng.
						</p>

						<div v-for="(row, rowIndex) in conditionRows(step)" :key="rowIndex" class="space-y-2">
						<!-- Ô phép so cần rộng hơn: nhãn dài nhất là "lớn hơn hoặc bằng", hẹp quá thì bị cắt chữ. -->
							<div class="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_200px_minmax(0,1fr)_auto]">
								<UiSelect
									:model-value="row.field"
									:options="fieldOptions"
									placeholder="Chọn trường"
									:disabled="!canManage"
									@update:model-value="value => updateConditionField(step, rowIndex, String(value ?? ''))"
								/>
								<UiSelect
									:model-value="row.op"
									:options="opOptions"
									:disabled="!canManage"
									@update:model-value="value => updateConditionOp(step, rowIndex, value as FlowConditionOp)"
								/>
							<!--
									Trường số với phép so một giá trị thì dùng ô số dùng chung, nên nhân sự thấy ngay
									100.000.000 thay vì phải đếm chữ số. Phép "nằm trong" nhận danh sách nên vẫn là ô
									chữ, và các trường còn lại cũng vậy.
								-->
								<UiNumberInput
									v-if="isNumberCondition(row)"
									:model-value="typeof row.value === 'number' ? row.value : undefined"
									:decimals="2"
									:disabled="!canManage"
									placeholder="Giá trị so sánh"
									@update:model-value="value => setConditionNumber(step, rowIndex, value)"
								/>
								<input
									v-else
									:value="conditionInputText(index, rowIndex, row)"
									type="text"
									:disabled="!canManage"
									placeholder="Giá trị so sánh"
									class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
									@input="event => updateConditionValue(step, rowIndex, (event.target as HTMLInputElement).value, index)"
									@blur="normalizeConditionInput(index, rowIndex)"
								/>
								<button
									type="button"
									class="min-h-11 whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-40 dark:text-rose-400 dark:hover:bg-rose-900/20"
									:disabled="!canManage"
									@click="removeCondition(step, rowIndex)"
								>
									Xoá điều kiện
								</button>
							</div>
							<p v-if="valueHint(row.field, row.op)" class="text-xs text-gray-500 dark:text-gray-400">
								{{ valueHint(row.field, row.op) }}
							</p>
						</div>

						<button
							type="button"
							class="rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40 dark:text-brand-300 dark:hover:bg-brand-900/20"
							:disabled="!canManage"
							@click="addCondition(step)"
						>
							Thêm điều kiện
						</button>

						<p
							v-if="conditionText(step.condition, template?.fields ?? [])"
							class="text-xs text-gray-600 dark:text-gray-300"
						>
							Bước này chỉ được áp dụng khi {{ conditionText(step.condition, template?.fields ?? []) }}.
						</p>
					</div>
				</li>
			</ol>

			<div class="flex flex-wrap items-center justify-between gap-3">
				<CommonAppButton v-if="canManage" variant="secondary" :disabled="steps.length >= 10" @click="addStep">
					Thêm bước
				</CommonAppButton>
				<p v-if="steps.length >= 10" class="text-xs text-gray-500 dark:text-gray-400">
					Luồng duyệt chỉ có nhiều nhất mười bước.
				</p>
				<CommonAppButton v-if="canManage" :loading="saving" @click="save">Lưu luồng duyệt</CommonAppButton>
			</div>
		</template>
	</div>
</template>
