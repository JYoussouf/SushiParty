import { apiRequest } from './client';

export interface PartnerApplicationInput {
  restaurantName: string;
  address: string;
  email: string;
  phone?: string;
}

// Submits a restaurant's application to become a featured partner. This is a
// B2B lead / account-creation request (no payment), so it stays outside Apple's
// in-app-purchase rules.
export async function createPartnerApplication(
  input: PartnerApplicationInput,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/partners', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
