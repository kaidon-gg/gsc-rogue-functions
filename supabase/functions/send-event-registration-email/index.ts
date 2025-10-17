// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleEmailFunction } from "../_shared/handlers/email-function-handler.ts";
import { createEventRegistrationEmail } from "../_shared/email/event-registration-template.ts";
import { fetchUserEventData, UserEventData } from "../_shared/database/user-event-data.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL")!; // e.g. "Rogue League <hello@your-domain>"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EDGE_WEBHOOK_SECRET = Deno.env.get("EDGE_WEBHOOK_SECRET")!;

Deno.serve(async (req: Request) => {
  return handleEmailFunction<UserEventData>(
    req,
    {
      resendApiKey: RESEND_API_KEY,
      fromEmail: FROM_EMAIL,
      supabaseUrl: SUPABASE_URL,
      supabaseServiceKey: SUPABASE_SERVICE_ROLE_KEY,
      webhookSecret: EDGE_WEBHOOK_SECRET
    },
    {
      expectedTable: "league_event_players",
      fetchData: async (supabaseUrl, supabaseServiceKey, record) => {
        const { event_id, user_id } = record;
        return fetchUserEventData(supabaseUrl, supabaseServiceKey, user_id, event_id);
      },
      createEmail: (data) => {
        const { subject, html } = createEventRegistrationEmail({
          displayName: data.displayName,
          eventTitle: data.eventTitle,
          eventDateLocal: data.eventDateLocal,
          tournamentTitle: data.tournamentTitle,
          gameName: data.gameName
        });
        
        return {
          to: [data.userEmail],
          subject,
          html
        };
      }
    }
  );
});
