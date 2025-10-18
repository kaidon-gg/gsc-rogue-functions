import { createClient } from "jsr:@supabase/supabase-js@2";
import { performCheckin, CheckinHandlerConfig } from "./checkin-handler.ts";

export interface EventCheckinRequest {
  eventId: string;
  force?: boolean; // Force checkin even if event status is not REGISTRATION_CLOSED
}

export interface EventCheckinResult {
  success: boolean;
  message: string;
  details?: {
    eventId: string;
    eventStatus: string;
    totalPlayers: number;
    processedPlayers: number;
    confirmedPlayers: number;
    failedPlayers: number;
    results: Array<{
      userId: string;
      success: boolean;
      message: string;
      previousStatus: string;
      newStatus: string;
    }>;
  };
  error?: string;
}

/**
 * Perform bulk event checkin for all registered players
 * @param request - Event checkin request parameters
 * @param config - Handler configuration
 * @returns Promise<EventCheckinResult> - Result of the bulk checkin process
 */
export async function performEventCheckin(
  request: EventCheckinRequest,
  config: CheckinHandlerConfig
): Promise<EventCheckinResult> {
  const { eventId, force = false } = request;
  const { supabaseUrl, supabaseServiceKey } = config;

  if (!eventId) {
    return {
      success: false,
      message: "Missing eventId",
      error: "eventId is required"
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Step 1: Check event status
    const { data: event, error: eventError } = await supabase
      .from("league_events")
      .select("id, event_title, status")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return {
        success: false,
        message: "Event not found",
        error: eventError?.message || "Event does not exist"
      };
    }

    console.log(`Processing event: ${event.event_title} (${event.id}) - Status: ${event.status}`);

    // Step 2: Validate event status (only run if REGISTRATION_CLOSED unless forced)
    if (event.status !== 'REGISTRATION_CLOSED' && !force) {
      return {
        success: false,
        message: `Event status is ${event.status}, expected REGISTRATION_CLOSED`,
        error: "Event must be in REGISTRATION_CLOSED status to run check-ins"
      };
    }

    // Step 3: Get all registered players with PENDING or CONFIRMED status
    const { data: players, error: playersError } = await supabase
      .from("league_event_players")
      .select("user_id, status")
      .eq("event_id", eventId)
      .in("status", ["PENDING", "CONFIRMED"]);

    if (playersError) {
      return {
        success: false,
        message: "Failed to fetch registered players",
        error: playersError.message
      };
    }

    if (!players || players.length === 0) {
      return {
        success: true,
        message: "No players found with PENDING or CONFIRMED status",
        details: {
          eventId,
          eventStatus: event.status,
          totalPlayers: 0,
          processedPlayers: 0,
          confirmedPlayers: 0,
          failedPlayers: 0,
          results: []
        }
      };
    }

    console.log(`Found ${players.length} players to process for event ${eventId}`);

    // Step 4: Process each player
    const results = [];
    let confirmedCount = 0;
    let failedCount = 0;

    for (const player of players) {
      const previousStatus = player.status;
      console.log(`Processing player ${player.user_id} (current status: ${previousStatus})`);

      try {
        // Perform individual checkin
        const checkinResult = await performCheckin(
          {
            userId: player.user_id,
            eventId: eventId
          },
          config
        );

        let newStatus = previousStatus;
        let success = false;
        let message = "";

        if (checkinResult.success) {
          confirmedCount++;
          newStatus = "CONFIRMED";
          success = true;
          message = checkinResult.message;
        } else {
          failedCount++;
          success = false;
          message = checkinResult.message;
        }

        results.push({
          userId: player.user_id,
          success,
          message,
          previousStatus,
          newStatus
        });

      } catch (error) {
        console.error(`Failed to process player ${player.user_id}:`, error);
        failedCount++;
        results.push({
          userId: player.user_id,
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
          previousStatus,
          newStatus: previousStatus
        });
      }
    }

    const processedCount = players.length;
    const successRate = processedCount > 0 ? (confirmedCount / processedCount * 100).toFixed(1) : "0";

    console.log(`Event checkin completed: ${confirmedCount}/${processedCount} players confirmed (${successRate}%)`);

    return {
      success: true,
      message: `Event checkin completed. ${confirmedCount}/${processedCount} players confirmed (${successRate}%)`,
      details: {
        eventId,
        eventStatus: event.status,
        totalPlayers: processedCount,
        processedPlayers: processedCount,
        confirmedPlayers: confirmedCount,
        failedPlayers: failedCount,
        results
      }
    };

  } catch (error) {
    console.error("Event checkin process failed:", error);
    return {
      success: false,
      message: "Event checkin process failed due to internal error",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}