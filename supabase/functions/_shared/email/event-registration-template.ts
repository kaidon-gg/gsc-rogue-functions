export interface EventRegistrationEmailData {
  displayName: string;
  eventTitle: string;
  eventDateLocal: string;
  tournamentTitle?: string;
  gameName?: string;
}

/**
 * Helper function to render optional text with prefix/suffix
 * @param value - The optional value to render
 * @param prefix - Text to add before the value (default: empty)
 * @param suffix - Text to add after the value (default: empty)
 * @returns Formatted string or empty string if value is falsy
 */
function renderOptional(value?: string, prefix: string = "", suffix: string = ""): string {
  return value ? `${prefix}${value}${suffix}` : "";
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
  
  const subject = `You're registered for ${eventTitle}${renderOptional(gameName, " – ")}`;
  
  const tournamentLine = tournamentTitle 
    ? `${tournamentTitle}${renderOptional(gameName, " (", ")")}`
    : renderOptional(gameName);
  
  const html = `
    <div>
      <p>Hi ${displayName}!</p>
      <p>Thanks for registering for:</p>
      <p>
        ${eventTitle}<br />
        ${tournamentLine}<br />
        ${eventDateLocal} (Europe/Dublin)
      </p>
      <p><strong>Your registration is not yet complete.</strong> Please ensure you complete the following steps:</p>
      <p>
        - <strong>Payment:</strong> Complete the payment with the Tournament Organizers using your selected payment method<br />
        - <strong>Discord:</strong> Make sure you are on the Discord server and have the correct role selected for the game<br />
        - <strong>Confirmation:</strong> Once all information is correct, you will receive an email confirming your registration
      </p>
      <p>--<br />
      Rogue League Team</p>
    </div>
  `;
  
  return { subject, html };
}