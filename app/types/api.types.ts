export interface ApiResponse<T> {
	success: boolean;
	data: T;
	message?: string;
}

export interface PaginatedMeta {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface PaginatedResponse<T> {
	success: boolean;
	data: T[];
	meta: PaginatedMeta;
}

export interface QueryParams {
	page?: number;
	limit?: number;
	search?: string;
}
