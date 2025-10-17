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
  
  const subject = `You're registered for ${eventTitle}` + (gameName ? ` – ${gameName}` : "");
  
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height:1.5;">
      <h2>You're in, ${displayName}! ✅</h2>
      <p>Thanks for registering for <strong>${eventTitle}</strong>${tournamentTitle ? ` (tournament: <strong>${tournamentTitle}</strong>)` : ""}${gameName ? ` – <strong>${gameName}</strong>` : ""}.</p>
      <p><strong>Event date:</strong> ${eventDateLocal} (Europe/Dublin)</p>
      <hr />
      <p style="font-size:12px;color:#666">Rogue League • See you soon!</p>
    </div>
  `;
  
  return { subject, html };
}