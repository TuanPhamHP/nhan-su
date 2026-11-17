import { usePublicFetch } from './http/public.fetch';
import { usePublicFormFetch } from './http/public-form.fetch';
import type { ApiResponse } from '~/types/api.types';
import type {
	PublicApplicationBody,
	PublicCareers,
	PublicJobDetail,
	PublicOfferDeclineBody,
	PublicOfferResponse,
} from '~/types/recruitment-public.types';

/**
 * Trang tuyển dụng công khai và trang phản hồi offer.
 *
 * ⚠ Nhóm route này KHÔNG được gửi header `Authorization`, kể cả khi người xem đang đăng nhập app.
 * Có token hợp lệ thì API đặt ngữ cảnh theo công ty TRONG TOKEN và cổng module kiểm module của
 * công ty đó chứ không phải công ty trên đường dẫn — nhân viên công ty chưa mua module mở trang
 * tuyển dụng của công ty khác sẽ nhận 403 `MODULE_NOT_SUBSCRIBED`. Vì vậy service này dùng
 * `usePublicFetch` / `usePublicFormFetch`, tuyệt đối không dùng `useAuthFetch`.
 */
export const useRecruitmentPublicService = () => {
	const publicFetch = usePublicFetch();
	const formFetch = usePublicFormFetch();

	return {
		/** Trang tuyển dụng của công ty. 404 `RECRUIT_CAREERS_CLOSED` khi mã sai hoặc module tắt. */
		async careers(companyCode: string): Promise<PublicCareers> {
			const res = await publicFetch<ApiResponse<PublicCareers>>(
				`/v1/public/careers/${encodeURIComponent(companyCode)}`,
			);
			return res.data;
		},

		/** Chi tiết một tin kèm điều khoản xử lý dữ liệu hiện hành. */
		async job(companyCode: string, slug: string): Promise<PublicJobDetail> {
			const res = await publicFetch<ApiResponse<PublicJobDetail>>(
				`/v1/public/careers/${encodeURIComponent(companyCode)}/jobs/${encodeURIComponent(slug)}`,
			);
			return res.data;
		},

		/**
		 * Nộp hồ sơ. Luôn trả cùng một câu "Đã nhận hồ sơ", kể cả khi BE coi là gửi tự động hay
		 * bấm trùng — cố ý như vậy để bot không dò được.
		 */
		async apply(companyCode: string, slug: string, body: PublicApplicationBody): Promise<{ message: string }> {
			const form = new FormData();
			form.append('fullName', body.fullName);
			form.append('email', body.email);
			if (body.phone) form.append('phone', body.phone);
			form.append('consentProcessing', 'true');
			form.append('consentTalentPool', body.consentTalentPool ? 'true' : 'false');
			form.append('termsVersion', String(body.termsVersion));
			// Hai chốt chống spam: ô ẩn phải rỗng, và form phải mở được hơn 3 giây.
			form.append('website', body.website);
			form.append('formStartedAt', String(body.formStartedAt));
			form.append('cv', body.cv);

			const res = await formFetch<ApiResponse<{ message: string }>>(
				`/v1/public/careers/${encodeURIComponent(companyCode)}/jobs/${encodeURIComponent(slug)}/applications`,
				{ method: 'POST', body: form },
			);
			return res.data;
		},

		/**
		 * Trạng thái link offer. LUÔN trả 200, kể cả khi link sai (`state: 'UNAVAILABLE'`), nên
		 * đừng bắt lỗi để suy trạng thái — đọc `data.state`.
		 */
		async offerResponse(token: string): Promise<PublicOfferResponse> {
			const res = await publicFetch<ApiResponse<PublicOfferResponse>>(
				`/v1/public/offer-responses/${encodeURIComponent(token)}`,
			);
			return res.data;
		},

		/** Đồng ý offer. `confirmed` phải là boolean `true` (chuỗi `"true"` bị 400). */
		async acceptOffer(token: string): Promise<PublicOfferResponse> {
			const res = await publicFetch<ApiResponse<PublicOfferResponse>>(
				`/v1/public/offer-responses/${encodeURIComponent(token)}/accept`,
				{ method: 'POST', body: { confirmed: true } },
			);
			return res.data;
		},

		/** Từ chối offer, bắt buộc `reasonId` lấy từ `declineReasons`. */
		async declineOffer(token: string, body: PublicOfferDeclineBody): Promise<PublicOfferResponse> {
			const res = await publicFetch<ApiResponse<PublicOfferResponse>>(
				`/v1/public/offer-responses/${encodeURIComponent(token)}/decline`,
				{ method: 'POST', body },
			);
			return res.data;
		},
	};
};
