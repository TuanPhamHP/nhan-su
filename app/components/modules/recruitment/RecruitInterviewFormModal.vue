<script setup lang="ts">
	import { useRecruitmentService } from '~/services/recruitment.service';
	import { recruitErrorMessage, toRecruitText } from '~/utils/recruitment.utils';
	import {
		INTERVIEW_MODE_LABELS,
		type RecruitmentInterview,
		type RecruitmentInterviewMode,
		type ScorecardTemplate,
	} from '~/types/recruitment.types';

	/**
	 * Đặt lịch phỏng vấn cho một hồ sơ, hoặc đổi lịch một buổi đang có.
	 *
	 * Ba hệ quả cần nói trước với người dùng, vì chúng xảy ra ngay khi bấm Lưu:
	 * người phỏng vấn chưa ngồi hội đồng được tự thêm vào hội đồng của tin, mỗi người
	 * phỏng vấn có một phiếu đánh giá chờ chấm, và ứng viên nhận email kèm file lịch khi
	 * giờ, hình thức hay địa điểm thay đổi.
	 */
	const props = defineProps<{
		/** Khi đặt lịch mới. */
		applicationId?: number;
		candidateName?: string;
		/** Khi đổi lịch. */
		interview?: RecruitmentInterview;
		/** Loại vòng hiện tại, để lọc mẫu đánh giá cho đúng. */
		stageKind?: string;
	}>();

	const emit = defineEmits<{ saved: [interview: RecruitmentInterview]; close: [] }>();

	const service = useRecruitmentService();
	const directoryStore = useDirectoryStore();
	const { employees } = storeToRefs(directoryStore);

	const isEdit = computed(() => !!props.interview);

	/** `UiDateTimePickerV2` làm việc với giờ địa phương dạng `YYYY-MM-DDTHH:mm`. */
	function toLocalInput(iso?: string): string {
		if (!iso) return '';
		const d = new Date(iso);
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	const startAt = ref(toLocalInput(props.interview?.startAt));
	const endAt = ref(toLocalInput(props.interview?.endAt));
	const mode = ref<RecruitmentInterviewMode>(props.interview?.mode ?? 'ONLINE');
	const location = ref(props.interview?.location ?? '');
	const meetingUrl = ref(props.interview?.meetingUrl ?? '');
	const note = ref(props.interview?.note ?? '');
	const interviewerIds = ref<number[]>(props.interview?.interviewers.map(i => i.id) ?? []);
	const scorecardTemplateId = ref<number | undefined>(undefined);
	const notifyCandidate = ref(true);

	const addInterviewerId = ref<number | undefined>(undefined);
	const templates = ref<ScorecardTemplate[]>([]);
	const submitting = ref(false);
	const error = ref<string | null>(null);

	onMounted(async () => {
		directoryStore.load().catch(() => {
			error.value = 'Không tải được danh sách nhân viên';
		});
		try {
			templates.value = await service.findScorecardTemplates(true);
		} catch {
			// Không có mẫu thì BE tự bỏ qua việc tạo phiếu; ô chọn rỗng là đủ.
		}
	});

	const modeOptions = Object.entries(INTERVIEW_MODE_LABELS).map(([value, label]) => ({ value, label }));

	const templateOptions = computed(() => {
		const wanted = props.stageKind === 'TEST' ? 'TEST' : 'INTERVIEW';
		return [
			{ value: undefined as number | undefined, label: 'Theo mẫu gắn với vòng' },
			...templates.value
				.filter(t => t.kind === wanted)
				.map(t => ({ value: t.id as number | undefined, label: t.name })),
		];
	});

	const interviewerOptions = computed(() => [
		{ value: undefined as number | undefined, label: 'Thêm người phỏng vấn...' },
		...employees.value
			.filter(e => !interviewerIds.value.includes(e.id))
			.map(e => ({ value: e.id as number | undefined, label: `${e.fullName} (${e.employeeCode})` })),
	]);

	const pickedInterviewers = computed(() =>
		interviewerIds.value.map(id => ({
			id,
			name:
				employees.value.find(e => e.id === id)?.fullName ??
				props.interview?.interviewers.find(i => i.id === id)?.fullName ??
				`Nhân viên #${id}`,
		})),
	);

	function addInterviewer() {
		if (addInterviewerId.value == null) return;
		if (interviewerIds.value.length >= 10) {
			error.value = 'Một buổi tối đa 10 người phỏng vấn';
			return;
		}
		interviewerIds.value.push(addInterviewerId.value);
		addInterviewerId.value = undefined;
	}

	function removeInterviewer(id: number) {
		interviewerIds.value = interviewerIds.value.filter(x => x !== id);
	}

	/** BE không chặn giờ đã qua, nên FE tự cảnh báo để tránh đặt nhầm lịch quá khứ. */
	const startsInPast = computed(() => !!startAt.value && new Date(startAt.value) < new Date());

	const durationHours = computed(() => {
		if (!startAt.value || !endAt.value) return null;
		const ms = new Date(endAt.value).getTime() - new Date(startAt.value).getTime();
		return ms > 0 ? ms / 3_600_000 : null;
	});

	/**
	 * Gợi ý giờ kết thúc một tiếng sau giờ bắt đầu.
	 *
	 * Ô chọn phát giá trị ngay khi người dùng bấm NGÀY, lúc đó giờ vẫn là 00:00; nếu chỉ gợi
	 * ý khi ô kết thúc còn trống thì lần phát đầu tiên đó đã điền 01:00, và giờ người dùng
	 * chọn sau đó lại nằm sau giờ kết thúc, làm form báo "giờ kết thúc phải sau giờ bắt đầu"
	 * dù họ chưa làm gì sai. Vì vậy gợi ý lại mỗi khi giờ kết thúc không còn hợp lệ, và giữ
	 * nguyên khi người dùng đã tự chọn một giờ muộn hơn.
	 */
	watch(startAt, value => {
		if (!value) return;
		const start = new Date(value).getTime();
		if (!Number.isFinite(start)) return;
		const end = endAt.value ? new Date(endAt.value).getTime() : NaN;
		if (Number.isFinite(end) && end > start) return;
		endAt.value = toLocalInput(new Date(start + 60 * 60 * 1000).toISOString());
	});

	function validate(): string | null {
		if (!startAt.value || !endAt.value) return 'Chọn giờ bắt đầu và giờ kết thúc';
		if (new Date(endAt.value) <= new Date(startAt.value)) return 'Giờ kết thúc phải sau giờ bắt đầu';
		if ((durationHours.value ?? 0) > 12) return 'Một buổi phỏng vấn tối đa 12 giờ';
		if (!interviewerIds.value.length) return 'Chọn ít nhất một người phỏng vấn';
		if (mode.value === 'ONLINE' && !meetingUrl.value.trim()) {
			return 'Phỏng vấn online phải có link họp';
		}
		if (mode.value === 'ONSITE' && !location.value.trim()) {
			return 'Phỏng vấn trực tiếp phải có địa điểm';
		}
		return null;
	}

	async function save() {
		const problem = validate();
		if (problem) {
			error.value = problem;
			return;
		}
		submitting.value = true;
		error.value = null;
		try {
			const body = {
				startAt: new Date(startAt.value).toISOString(),
				endAt: new Date(endAt.value).toISOString(),
				mode: mode.value,
				location: mode.value === 'ONSITE' ? toRecruitText(location.value) : undefined,
				meetingUrl: mode.value === 'ONLINE' ? toRecruitText(meetingUrl.value) : undefined,
				interviewerIds: interviewerIds.value,
				note: toRecruitText(note.value),
				scorecardTemplateId: scorecardTemplateId.value,
				notifyCandidate: notifyCandidate.value,
			};
			const saved = props.interview
				? await service.updateInterview(props.interview.id, body)
				: await service.scheduleInterview(props.applicationId as number, body);
			emit('saved', saved);
		} catch (e) {
			error.value = recruitErrorMessage(e, 'Lưu lịch phỏng vấn thất bại');
		} finally {
			submitting.value = false;
		}
	}
</script>

<template>
	<Teleport to="body">
		<div class="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
			<div class="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
				<div class="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<div>
						<h2 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ isEdit ? 'Đổi lịch phỏng vấn' : 'Đặt lịch phỏng vấn' }}
						</h2>
						<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
							{{ candidateName ?? interview?.candidate.fullName ?? '' }}
						</p>
					</div>
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

				<form class="max-h-[70vh] space-y-4 overflow-y-auto p-6" @submit.prevent="save">
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Bắt đầu <span class="text-red-500">*</span>
							</label>
							<UiDateTimePickerV2 v-model="startAt" />
							<p v-if="startsInPast" class="text-xs text-amber-600 dark:text-amber-400">
								Giờ này đã qua. Hệ thống vẫn nhận, nhưng ứng viên sẽ nhận lời mời cho một buổi trong
								quá khứ.
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Kết thúc <span class="text-red-500">*</span>
							</label>
							<UiDateTimePickerV2 v-model="endAt" />
							<p v-if="durationHours" class="text-xs text-gray-500 dark:text-gray-400">
								Buổi dài {{ durationHours.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) }} giờ.
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Hình thức <span class="text-red-500">*</span>
							</label>
							<UiSelect v-model="mode" :options="modeOptions" />
						</div>

						<div v-if="mode === 'ONLINE'" class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Link họp <span class="text-red-500">*</span>
							</label>
							<input
								v-model="meetingUrl"
								type="url"
								maxlength="500"
								placeholder="https://meet.google.com/..."
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								Hệ thống không tự tạo phòng họp, hãy dán link có sẵn.
							</p>
						</div>

						<div v-if="mode === 'ONSITE'" class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Địa điểm <span class="text-red-500">*</span>
							</label>
							<input
								v-model="location"
								type="text"
								maxlength="300"
								placeholder="Phòng họp tầng 5, số 1 Nguyễn Trãi"
								class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<div class="space-y-1 sm:col-span-2">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
								Người phỏng vấn <span class="text-red-500">*</span>
							</label>
							<div class="flex flex-wrap items-end gap-2">
								<div class="min-w-[16rem] flex-1">
									<UiSelect v-model="addInterviewerId" :options="interviewerOptions" />
								</div>
								<CommonAppButton
									variant="outline"
									size="sm"
									type="button"
									:disabled="addInterviewerId == null"
									@click="addInterviewer"
								>
									Thêm
								</CommonAppButton>
							</div>
							<div v-if="pickedInterviewers.length" class="mt-2 flex flex-wrap gap-2">
								<span
									v-for="person in pickedInterviewers"
									:key="person.id"
									class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
								>
									{{ person.name }}
									<button
										type="button"
										class="text-gray-400 hover:text-rose-600"
										:aria-label="`Bỏ ${person.name}`"
										@click="removeInterviewer(person.id)"
									>
										<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
											<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
										</svg>
									</button>
								</span>
							</div>
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								Người phỏng vấn chưa ngồi hội đồng của tin sẽ được thêm vào hội đồng, và mỗi người có
								một phiếu đánh giá chờ chấm.
							</p>
						</div>

						<div class="space-y-1">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Mẫu đánh giá</label>
							<UiSelect v-model="scorecardTemplateId" :options="templateOptions" />
						</div>

						<div class="space-y-1 sm:col-span-2">
							<label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Ghi chú</label>
							<textarea
								v-model="note"
								rows="2"
								placeholder="Nội dung buổi phỏng vấn..."
								class="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
							/>
						</div>

						<label class="flex items-start gap-2 sm:col-span-2">
							<input
								v-model="notifyCandidate"
								type="checkbox"
								class="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
							/>
							<span class="text-sm text-gray-700 dark:text-gray-300">
								Gửi thư mời cho ứng viên kèm file lịch
								<span class="block text-xs text-gray-500 dark:text-gray-400">
									Khi đổi lịch, ứng viên chỉ nhận thư mới nếu giờ, hình thức, địa điểm hay link thay
									đổi. Đổi người phỏng vấn thì ứng viên không nhận gì.
								</span>
							</span>
						</label>
					</div>

					<p v-if="error" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
						{{ error }}
					</p>

					<div class="flex justify-end gap-3 pt-1">
						<CommonAppButton variant="secondary" type="button" @click="emit('close')">Huỷ</CommonAppButton>
						<CommonAppButton variant="primary" type="submit" :loading="submitting">
							{{ isEdit ? 'Lưu lịch' : 'Đặt lịch' }}
						</CommonAppButton>
					</div>
				</form>
			</div>
		</div>
	</Teleport>
</template>
