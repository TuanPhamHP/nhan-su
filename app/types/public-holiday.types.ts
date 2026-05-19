export interface PublicHolidayResponse {
	id: number;
	name: string;
	date: string;      // "YYYY-MM-DD"
	year: number;
	createdAt: string; // ISO 8601
}

export interface CreatePublicHolidayDto {
	name: string; // 2–100 ký tự
	date: string; // "YYYY-MM-DD"
}

export type UpdatePublicHolidayDto = Partial<CreatePublicHolidayDto>;

export interface BulkYearDto {
	year: number;
}

export interface BulkYearResponse {
	created: number;
	message: string;
}

// POST /public-holidays/range — request
export interface CreateHolidayRangeDto {
	name: string;     // 2–100 ký tự, áp dụng cho tất cả ngày trong khoảng
	fromDate: string; // "YYYY-MM-DD"
	toDate: string;   // "YYYY-MM-DD", phải >= fromDate
}

// POST /public-holidays/range — response
export interface RangeResponse {
	created: number; // số ngày được tạo mới
	skipped: number; // số ngày đã tồn tại, bỏ qua
	message: string;
}
