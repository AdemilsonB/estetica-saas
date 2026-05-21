import { ConflictError } from "@/shared/errors";

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
      throw new ConflictError("Horario nao disponivel para este profissional.");
    }
  }
}

export const availabilityService = new AvailabilityService();
