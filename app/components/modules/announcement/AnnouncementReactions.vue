<script setup lang="ts">
	import { useAnnouncementRealtime } from '~/composables/useAnnouncementRealtime';
	import { useAuth } from '~/composables/useAuth';
	import { useCompanyAnnouncements } from '~/composables/useCompanyAnnouncements';
	import { EMOJI_KEYS, EMOJI_MAP, type EmojiKey, type ReactionResponse } from '~/types/announcement.types';

	const props = defineProps<{
		announcementId: number;
		initialReactions?: ReactionResponse;
	}>();

	const emit = defineEmits<{
		reacted: [];
	}>();

	const { react, getReactions } = useCompanyAnnouncements();
	const { subscribe: subscribeRealtime } = useAnnouncementRealtime();
	const { user } = useAuth();
	const toast = useToast();

	const reactions = ref<ReactionResponse | null>(props.initialReactions ?? null);
	const isLoading = ref(false);
	const showPicker = ref(false);
	const showModal = ref(false);
	const activeTab = ref<'all' | EmojiKey>('all');

	const totalReactions = computed(() =>
		reactions.value ? Object.values(reactions.value.summary).reduce((a, b) => a + b, 0) : 0,
	);

	const activeEmojis = computed(() => (reactions.value ? EMOJI_KEYS.filter(k => reactions.value!.summary[k] > 0) : []));

	const myReaction = computed(() => reactions.value?.myReaction ?? null);

	const mainButtonLabel = computed(() => (myReaction.value ? EMOJI_MAP[myReaction.value].label : 'Thích'));

	const mainButtonEmoji = computed<EmojiKey>(() => myReaction.value ?? 'heart');

	const modalEmployees = computed(() => {
		if (!reactions.value) return [];
		if (activeTab.value === 'all') {
			return reactions.value.details
				.filter(d => d.employees.length > 0)
				.flatMap(d => d.employees.map(emp => ({ ...emp, emoji: d.emoji })));
		}
		const detail = reactions.value.details.find(d => d.emoji === activeTab.value);
		return detail ? detail.employees.map(emp => ({ ...emp, emoji: detail.emoji })) : [];
	});

	async function loadReactions() {
		try {
			reactions.value = await getReactions(props.announcementId);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Không tải được reactions');
		}
	}

	async function handleReact(emoji: EmojiKey) {
		if (isLoading.value || !reactions.value) return;
		isLoading.value = true;
		showPicker.value = false;

		const snapshot: ReactionResponse = JSON.parse(JSON.stringify(reactions.value));
		const myPrev = reactions.value.myReaction;

		if (myPrev && myPrev !== emoji) {
			reactions.value.summary[myPrev]--;
			reactions.value.summary[emoji]++;
			reactions.value.myReaction = emoji;
		} else if (myPrev === emoji) {
			reactions.value.summary[emoji]--;
			reactions.value.myReaction = null;
		} else {
			reactions.value.summary[emoji]++;
			reactions.value.myReaction = emoji;
		}

		try {
			await react(props.announcementId, emoji);
			reactions.value = await getReactions(props.announcementId);
			emit('reacted');
		} catch (e) {
			reactions.value = snapshot;
			toast.error(e instanceof Error ? e.message : 'Không react được, thử lại sau');
		} finally {
			isLoading.value = false;
		}
	}

	function handleMainClick() {
		handleReact(myReaction.value ?? 'heart');
	}

	function onHoverEnter() {
		showPicker.value = true;
	}

	function onHoverLeave() {
		showPicker.value = false;
	}

	function openModal() {
		activeTab.value = 'all';
		showModal.value = true;
	}

	function initials(name: string): string {
		return name
			.split(/\s+/)
			.filter(Boolean)
			.slice(-2)
			.map(w => w.charAt(0).toUpperCase())
			.join('');
	}

	// ── Realtime ──────────────────────────────────────────────────────────────
	// Server broadcast payload.summary là source-of-truth cho counts. Actor tự bấm
	// đã optimistic update rồi → khi event của chính mình về, replace bằng summary
	// server-authoritative để đồng bộ với các tab khác.
	let unsubscribeRealtime: (() => void) | null = null;

	onMounted(() => {
		if (!reactions.value) loadReactions();
		unsubscribeRealtime = subscribeRealtime(props.announcementId, {
			onReactionChanged: payload => {
				if (!reactions.value) return;
				reactions.value.summary = { ...payload.summary };
				if (user.value?.id === payload.actor.id) {
					reactions.value.myReaction = payload.action === 'removed' ? null : payload.emoji;
				}
				// Chi tiết ai react — refetch để cập nhật list trong modal (avatar/tên).
				// Chỉ fetch khi modal đang mở để tránh spam request.
				if (showModal.value) {
					getReactions(props.announcementId)
						.then(r => {
							reactions.value = r;
						})
						.catch(() => {});
				}
			},
		});
	});

	onBeforeUnmount(() => {
		unsubscribeRealtime?.();
		unsubscribeRealtime = null;
	});
</script>

<template>
	<div class="announcement-reactions space-y-2">
		<!-- Aggregate: stacked icons + total, click to open modal -->
		<button
			v-if="totalReactions > 0"
			type="button"
			class="inline-flex items-center gap-2 px-1 py-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
			@click="openModal"
		>
			<div class="flex -space-x-2">
				<img
					v-for="key in activeEmojis.slice(0, 3)"
					:key="key"
					:src="EMOJI_MAP[key].src"
					:alt="EMOJI_MAP[key].label"
					class="w-5 h-5 rounded-full ring-2 ring-gray-400:50"
				/>
			</div>
			<span class="text-base text-gray-700 dark:text-gray-300 font-semibold pr-2">
				{{ totalReactions }}
			</span>
		</button>

		<!-- Divider row: main react button (with hover picker) -->
		<div class="flex items-center border-t border-gray-100 dark:border-gray-800 pt-2">
			<div class="relative inline-block" @mouseenter="onHoverEnter" @mouseleave="onHoverLeave">
				<!-- Main button: heart by default, or my current reaction -->
				<button
					type="button"
					:disabled="isLoading || !reactions"
					:class="[
						'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
						myReaction
							? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
							: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
						isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
					]"
					@click="handleMainClick"
				>
					<img
						:src="EMOJI_MAP[mainButtonEmoji].src"
						:alt="EMOJI_MAP[mainButtonEmoji].label"
						class="w-5 h-5 select-none"
						draggable="false"
					/>
					<span>{{ mainButtonLabel }}</span>
				</button>

				<!-- Picker popup -->
				<Transition name="picker">
					<div
						v-if="showPicker && reactions"
						class="absolute bottom-full left-0 mb-0 flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-full px-3 py-3 z-10"
					>
						<button
							v-for="key in EMOJI_KEYS"
							:key="key"
							type="button"
							:title="EMOJI_MAP[key].label"
							:class="[
								'p-1 flex items-center justify-center rounded-full transition-transform duration-150 hover:scale-125 hover:bg-brand-300 hover:-translate-y-1 w-10 h-10',
								myReaction === key ? 'ring-2 ring-blue-400' : '',
							]"
							@click="handleReact(key)"
						>
							<img
								:src="EMOJI_MAP[key].src"
								:alt="EMOJI_MAP[key].label"
								class="w-10 h-10 select-none block"
								draggable="false"
							/>
						</button>
					</div>
				</Transition>
			</div>
		</div>

		<!-- Modal danh sách chi tiết -->
		<Teleport to="body">
			<div
				v-if="showModal && reactions"
				class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
				@click.self="showModal = false"
			>
				<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
					<!-- Header -->
					<div
						class="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
					>
						<h3 class="text-base font-semibold text-gray-900 dark:text-white">
							{{ totalReactions }} lượt bày tỏ cảm xúc
						</h3>
						<button
							type="button"
							class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
							@click="showModal = false"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<!-- Tabs -->
					<div
						class="flex items-center gap-1 px-3 py-2 border-b border-gray-100 dark:border-gray-800 overflow-x-auto flex-shrink-0"
					>
						<button
							type="button"
							:class="[
								'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0',
								activeTab === 'all'
									? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
									: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
							]"
							@click="activeTab = 'all'"
						>
							Tất cả
							<span class="text-xs">{{ totalReactions }}</span>
						</button>
						<button
							v-for="key in activeEmojis"
							:key="key"
							type="button"
							:class="[
								'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0',
								activeTab === key
									? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
									: 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
							]"
							@click="activeTab = key"
						>
							<img :src="EMOJI_MAP[key].src" :alt="EMOJI_MAP[key].label" class="w-5 h-5" />
							<span class="text-xs">{{ reactions.summary[key] }}</span>
						</button>
					</div>

					<!-- Body: employee list -->
					<div class="flex-1 overflow-y-auto px-2 py-2">
						<div v-if="modalEmployees.length === 0" class="py-8 text-center text-sm text-gray-400">
							Chưa có ai bày tỏ cảm xúc
						</div>
						<div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
							<div
								v-for="emp in modalEmployees"
								:key="`${emp.emoji}-${emp.id}`"
								class="flex items-center gap-3 px-3 py-2.5"
							>
								<div class="relative flex-shrink-0">
									<div
										class="w-10 h-10 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center"
									>
										<img
											v-if="emp.avatarUrl"
											:src="emp.avatarUrl"
											:alt="emp.fullName"
											class="w-full h-full object-cover"
										/>
										<span v-else class="text-xs font-semibold text-gray-600 dark:text-gray-300">
											{{ initials(emp.fullName) }}
										</span>
									</div>
									<img
										:src="EMOJI_MAP[emp.emoji as EmojiKey].src"
										:alt="EMOJI_MAP[emp.emoji as EmojiKey].label"
										class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full ring-2 ring-white dark:ring-gray-900"
									/>
								</div>
								<p class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
									{{ emp.fullName }}
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>

<style scoped>
	.picker-enter-active,
	.picker-leave-active {
		transition: all 0.18s ease;
	}
	.picker-enter-from,
	.picker-leave-to {
		opacity: 0;
		transform: translateY(6px) scale(0.9);
	}
</style>
