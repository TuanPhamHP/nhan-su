import type { ProfileResponse, UpdateProfilePayload } from '~/types/auth.types';
import { useAuthService } from '~/services';

export function useProfile() {
	const authStore = useAuthStore();
	const toast = useToast();
	const { updateProfile: updateProfileFn, uploadAvatar: uploadAvatarFn } = useAuthService();

	const loading = ref(false);
	const uploadingAvatar = ref(false);

	function syncUserState(profile: ProfileResponse) {
		if (!authStore.user) return;
		authStore.user.fullName = profile.fullName;
		authStore.user.email = profile.email;
		authStore.user.avatarUrl = profile.avatarUrl;
	}

	async function updateProfile(payload: UpdateProfilePayload): Promise<ProfileResponse> {
		loading.value = true;
		try {
			const profile = await updateProfileFn(payload);
			syncUserState(profile);
			toast.success('Cập nhật thông tin thành công');
			return profile;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Cập nhật thất bại');
			throw e;
		} finally {
			loading.value = false;
		}
	}

	async function uploadAvatar(file: File): Promise<ProfileResponse> {
		uploadingAvatar.value = true;
		try {
			const profile = await uploadAvatarFn(file);
			syncUserState(profile);
			toast.success('Cập nhật ảnh đại diện thành công');
			return profile;
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Upload ảnh thất bại');
			throw e;
		} finally {
			uploadingAvatar.value = false;
		}
	}

	return { loading, uploadingAvatar, updateProfile, uploadAvatar };
}
