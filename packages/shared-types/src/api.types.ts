/**
 * Standard API response envelope.
 *
 * Every JSON response from the API conforms to one of these two shapes,
 * enabling type-safe handling on the client without `any` casts.
 */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; message: string; code: string };

/**
 * Paginated list wrapper returned by collection endpoints.
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
