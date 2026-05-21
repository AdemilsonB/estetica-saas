import { SlotUnavailableError } from "@/shared/errors";

import { appointmentRepository } from "./appointment.repository";

export class AvailabilityService {
  async ensureSlotAvailable(
    tenantId: string,
    professionalId: string,
    startsAt: Date,
    endsAt: Date,
  ) {
    const overlapping = await appointmentRepository.findOverlappingForProfessional(
      tenantId,
      professionalId,
      startsAt,
      endsAt,
    );

    if (overlapping) {
      throw new SlotUnavailableError();
    }
  }
}

export const availabilityService = new AvailabilityService();
