import { createFetch } from './fetch.factory';

/**
 * Như `usePublicFetch` (không gắn token, không đá về `/login` khi 401) nhưng KHÔNG đặt sẵn
 * `Content-Type`, để dùng cho `multipart/form-data`.
 *
 * Vì sao phải có bản riêng: `usePublicFetch` khai cứng `Content-Type: application/json`. ofetch
 * không sửa header khi body là `FormData`, nên header đó vẫn được gửi và request mất `boundary`
 * — server đọc multipart không ra. Trình duyệt tự đặt `Content-Type` kèm `boundary` đúng khi ta
 * không khai gì.
 */
export const usePublicFormFetch = () => {
	return createFetch()();
};
