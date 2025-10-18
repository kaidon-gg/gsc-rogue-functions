// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CheckinHandlerConfig, performBulkCheckin, BulkCheckinRequest } from "../_shared/handlers/checkin-handler.ts";

Deno.serve(async (req: Request) => {
  console.log(`${req.method} ${req.url}`);

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Configuration for handlers - get environment variables when needed
    const config: CheckinHandlerConfig = {
      supabaseUrl: Deno.env.get("SUPABASE_URL")!,
      supabaseServiceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      discordBotToken: Deno.env.get("DISCORD_BOT_TOKEN")!,
      discordGuildId: Deno.env.get("DISCORD_GUILD_ID")!,
      discordRoleName: Deno.env.get("DISCORD_ROLE_NAME") // Optional role name
    };

    // Handle event-based bulk checkin requests only
    const requestBody = await req.json();

    if (!requestBody.eventId) {
      return new Response(JSON.stringify({
        success: false,
        message: "Missing eventId",
        error: "eventId is required for bulk checkin"
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Event-based bulk checkin request
    const bulkRequest: BulkCheckinRequest = {
      eventId: requestBody.eventId,
      force: requestBody.force || false
    };

    const result = await performBulkCheckin(bulkRequest, config);
    
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Request handling failed:", error);
    return new Response(JSON.stringify({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
