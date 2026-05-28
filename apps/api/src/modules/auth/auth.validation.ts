import { z } from 'zod';
import { PassengerCategory, UserRole } from '@transport/shared-types';

// ──────────────────────────────────────────────
// RegisterDto
// ──────────────────────────────────────────────

export const registerSchema = z
  .object({
    email: z.string().email('Must be a valid email address'),

    // Bangladesh mobile format: +880 followed by exactly 10 digits.
    phone: z
      .string()
      .regex(
        /^\+880\d{10}$/,
        'Phone must be in Bangladesh format: +880xxxxxxxxxx',
      ),

    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
      .regex(/\d/, 'Password must contain at least 1 digit')
      .regex(
        /[^a-zA-Z0-9]/,
        'Password must contain at least 1 special character',
      ),

    confirmPassword: z.string(),

    role: z.nativeEnum(UserRole, {
      errorMap: () => ({ message: 'role must be a valid UserRole' }),
    }),

    full_name: z.string().min(2, 'Full name must be at least 2 characters'),

    /**
     * Only meaningful when role = PASSENGER.
     * Omitting it for a PASSENGER defaults to REGULAR in the DB.
     */
    passenger_category: z
      .nativeEnum(PassengerCategory, {
        errorMap: () => ({
          message: 'passenger_category must be a valid PassengerCategory',
        }),
      })
      .optional(),
  })
  .strict()
  // confirmPassword must match password
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  })
  // passenger_category is only valid for PASSENGER role
  .refine(
    (data) =>
      data.passenger_category === undefined ||
      data.role === UserRole.PASSENGER,
    {
      message: 'passenger_category is only valid when role is PASSENGER',
      path: ['passenger_category'],
    },
  );

export type RegisterDto = z.infer<typeof registerSchema>;

// ──────────────────────────────────────────────
// LoginDto
// ──────────────────────────────────────────────

export const loginSchema = z
  .object({
    email: z.string().email('Must be a valid email address'),
    password: z.string().min(1, 'Password is required'),
  })
  .strict();

export type LoginDto = z.infer<typeof loginSchema>;

// ──────────────────────────────────────────────
// VerifyDocumentDto
// ──────────────────────────────────────────────

export const verifyDocumentSchema = z
  .object({
    approve: z.boolean({
      required_error: 'approve is required',
      invalid_type_error: 'approve must be a boolean',
    }),
  })
  .strict();

export type VerifyDocumentDto = z.infer<typeof verifyDocumentSchema>;
