export interface EmailOptions {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

export interface SendEmailResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Send an email using the Resend API
 * @param options - Email configuration options
 * @param apiKey - Resend API key
 * @returns Promise with send result
 */
export async function sendEmail(
  options: EmailOptions,
  apiKey: string
): Promise<SendEmailResult> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(options)
    });

    if (!res.ok) {
      const err = await res.text();
      return {
        success: false,
        error: `Email send failed: ${err}`
      };
    }

    const data = await res.json();
    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: `Email send error: ${String(error)}`
    };
  }
}