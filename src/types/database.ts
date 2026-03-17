import type { Profile } from '@/lib/db/schema/profiles'
import type { StaffMember } from '@/lib/db/schema/staff-members'
import type { Campaign } from '@/lib/db/schema/campaigns'

export type { Profile, StaffMember, Campaign }

export type UserWithProfile = {
  id: string
  email: string
  profile: Profile | null
}
