import { renderOptional } from "../utils/string.ts";

export interface EventRegistrationEmailData {
  displayName: string;
  eventTitle: string;
  eventDateLocal: string;
  tournamentTitle?: string;
  gameName?: string;
}

/**
 * Generate event registration confirmation email content
 * @param data - Event registration data
 * @returns Object with subject and html content
 */
export function createEventRegistrationEmail(data: EventRegistrationEmailData): {
  subject: string;
  html: string;
} {
  const { displayName, eventTitle, eventDateLocal, tournamentTitle, gameName } = data;
  
  const subject = `You're registered for ${eventTitle}`;
  
  const tournamentLine = tournamentTitle 
    ? `${tournamentTitle}${renderOptional(gameName, " (", ")")}`
    : renderOptional(gameName);
  
  const html = `
    <div>
      <p>Hi ${displayName},</p>
      <p>Thanks for registering for:</p>
      <p>
        <strong>${eventTitle}</strong><br />
        ${tournamentLine}<br />
        ${eventDateLocal} (Europe/Dublin)
      </p>
      <p><strong>Your registration is not yet complete.</strong> Please ensure you complete the following steps:</p>
      <p>
        - <strong>Payment:</strong> Complete payment with Tournament Organizers<br />
        - <strong>Discord:</strong> Join the server and select the correct game role<br />
      </p>
      <p>Make sure you're on Discord with the correct role at event time.</p>
      <p>See you at the event!</p>
      <p>--<br />
      Rogue League Team</p>
    </div>
  `;
  
  return { subject, html };
}