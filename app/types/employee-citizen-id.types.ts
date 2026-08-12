export interface CitizenIdResponse {
	id: number;
	employeeId: number;
	citizenIdNumber: string;
	fullNameOnCard: string | null;
	issuedDate: string;
	issuedPlace: string | null;
	hometown: string | null;
	permanentAddress: string | null;
	temporaryAddress: string | null;
	currentAddress: string | null;
	frontPhotoUrl: string | null;
	backPhotoUrl: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateCitizenIdPayload {
	citizenIdNumber: string;
	fullNameOnCard?: string;
	issuedDate: string;
	issuedPlace?: string;
	hometown?: string;
	permanentAddress?: string;
	temporaryAddress?: string;
	currentAddress?: string;
}

export type UpdateCitizenIdPayload = Partial<CreateCitizenIdPayload>;
