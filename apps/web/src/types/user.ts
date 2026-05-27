import { UserRole } from '@transport/shared-types';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
