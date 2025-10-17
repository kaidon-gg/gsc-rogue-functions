import { renderOptional } from "../utils/string.ts";

export interface EventPaymentEmailData {
  displayName: string;
  eventTitle: string;
  eventDateLocal: string;
  tournamentTitle?: string;
  gameName?: string;
}

/**
 * Generate event payment email content
 * @param data - Event registration data
 * @returns Object with subject and html content
 */
export function createEventPaymentEmail(data: EventPaymentEmailData): {
  subject: string;
  html: string;
} {
  const { displayName, eventTitle, eventDateLocal, tournamentTitle, gameName } = data;
  
  const subject = `Payment confirmation for for ${eventTitle}`;
  
  const tournamentLine = tournamentTitle 
    ? `${tournamentTitle}${renderOptional(gameName, " (", ")")}`
    : renderOptional(gameName);
  
  const html = `
    <div>
      <p>Hi ${displayName},</p>
      <p>Your payment is now confirmed for:</p>
      <p>
        <strong>${eventTitle}</strong><br />
        ${tournamentLine}<br />
        ${eventDateLocal} (Europe/Dublin) <br />
      </p>
      <p>Make sure to be on the Discord server and have the correct role selected for the game at the event date/time.</p>
      <p>See you at the event!</p>
      <p>--<br />
      Rogue League Team</p>
    </div>
  `;
  
  return { subject, html };
}