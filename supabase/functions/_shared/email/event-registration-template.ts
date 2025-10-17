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
        - <strong>Payment:</strong> Complete the payment with the Tournament Organizers using your selected payment method<br />
        - <strong>Discord:</strong> Make sure you are on the Discord server and have the correct role selected for the game<br />
        - <strong>Confirmation:</strong> Once all information is correct, you will receive an email confirming your registration
      </p>
      <p> See you at the event </p>
      <p>--<br />
      Rogue League Team</p>
    </div>
  `;
  
  return { subject, html };
}