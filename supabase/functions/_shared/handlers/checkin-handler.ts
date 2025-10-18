import { createClient } from "jsr:@supabase/supabase-js@2";
import { validatePlayerPresence } from "../discord/validate-player-presence.ts";
import { checkPaymentStatus } from "../database/payment-status.ts";
import { checkDecklistStatus } from "../database/decklist-status.ts";
import { getDiscordHandle } from "../database/discord-handle.ts";
import { updatePlayerStatus } from "../database/player-status.ts";

export interface CheckinRequest {
  userId?: string;
  eventId?: string;
  discordHandle?: string;
  force?: boolean; // Force checkin even if conditions not met (for debugging)
}

export interface CheckinResult {
  success: boolean;
  message: string;
  details?: {
    userId: string;
    eventId: string;
    hasPaid: boolean;
    hasDecklist: boolean;
    discordPresence?: {
      isMember: boolean;
      isRole: boolean;
      isPresent: boolean;
      username?: string;
    };
    statusUpdated: boolean;
  };
  error?: string;
}

export interface CheckinHandlerConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  discordBotToken: string;
  discordGuildId: string;
  discordRoleName?: string;
}

export interface BulkCheckinRequest {
  eventId: string;
  force?: boolean; // Force checkin even if event status is not REGISTRATION_CLOSED
}

export interface BulkCheckinResult {
  success: boolean;
  message: string;
  details?: {
    eventId: string;
    eventStatus: string;
    totalPlayers: number;
    successfulCheckins: number;
    results: Array<{
      userId: string;
      success: boolean;
      message: string;
      originalStatus: string;
    }>;
  };
  error?: string;
}

/**
 * Perform event checkin process
 * @param request - Checkin request parameters
 * @param config - Handler configuration
 * @returns Promise<CheckinResult> - Result of the checkin process
 */
export async function performCheckin(
  request: CheckinRequest, 
  config: CheckinHandlerConfig
): Promise<CheckinResult> {
  const { userId, eventId, discordHandle: providedDiscordHandle, force = false } = request;
  const { 
    supabaseUrl, 
    supabaseServiceKey, 
    discordBotToken, 
    discordGuildId, 
    discordRoleName 
  } = config;

  if (!userId || !eventId) {
    return {
      success: false,
      message: "Missing userId or eventId",
      error: "userId and eventId are required"
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Step 1: Check payment status
    const hasPaid = await checkPaymentStatus(supabase, userId, eventId);
    
    // Step 2: Check decklist status
    const hasDecklist = await checkDecklistStatus(supabase, userId, eventId);
    
    // Step 3: Get Discord handle and validate presence
    const discordHandle = providedDiscordHandle || await getDiscordHandle(supabase, userId);
    
    let discordPresence: {
      isMember: boolean;
      isRole: boolean;
      isPresent: boolean;
      username?: string;
    };

    console.log(`Validating Discord presence for handle: ${discordHandle}`);

    if (discordHandle) {
      try {
        const presenceResult = await validatePlayerPresence({
          target: discordHandle,
          token: discordBotToken,
          guildId: discordGuildId,
          roleNames: discordRoleName ? [discordRoleName] : undefined
        });

        console.log(`Discord presence result for ${discordHandle}:`, presenceResult);

        discordPresence = {
          isMember: presenceResult.isMember,
          isRole: presenceResult.isRole,
          isPresent: presenceResult.isPresent,
          username: presenceResult.username
        };
      } catch (error) {
        console.error("Discord validation failed:", error);
        discordPresence = {
          isMember: false,
          isRole: false,
          isPresent: false
        };
      }
    } else {
      discordPresence = {
        isMember: false,
        isRole: false,
        isPresent: false
      };
    }

    // Step 4: Determine if checkin is successful
    const allConditionsMet =
      hasPaid &&
      hasDecklist &&
      discordPresence.isMember &&
      discordPresence.isRole;

    let statusUpdated = false;
    let message = "";

    if (allConditionsMet || force) {
      statusUpdated = await updatePlayerStatus(supabase, userId, eventId);
      message = statusUpdated 
        ? "Player successfully checked in and confirmed"
        : "All conditions met but failed to update status";
    } else {
      const missingConditions = [];
      if (!hasPaid) missingConditions.push("payment");
      if (!hasDecklist) missingConditions.push("decklist");
      if (!discordPresence.isMember) missingConditions.push("Discord membership");
      if (!discordPresence.isRole) missingConditions.push("Discord role");

      message = `Checkin failed. Missing: ${missingConditions.join(", ")}`;
    }

    return {
      success: allConditionsMet || (force && statusUpdated),
      message,
      details: {
        userId,
        eventId,
        hasPaid,
        hasDecklist,
        discordPresence,
        statusUpdated
      }
    };

  } catch (error) {
    console.error("Checkin process failed:", error);
    return {
      success: false,
      message: "Checkin process failed due to internal error",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Perform bulk event checkin for all registered players
 * @param request - Bulk checkin request parameters
 * @param config - Handler configuration
 * @returns Promise<BulkCheckinResult> - Result of the bulk checkin process
 */
export async function performBulkCheckin(
  request: BulkCheckinRequest,
  config: CheckinHandlerConfig
): Promise<BulkCheckinResult> {
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

    console.log(`Processing bulk checkin for event: ${event.event_title} (${event.id}) - Status: ${event.status}`);

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
          successfulCheckins: 0,
          results: []
        }
      };
    }

    console.log(`Found ${players.length} players to process for event ${eventId}`);

    // Step 4: Process each player
    const results = [];
    let successCount = 0;

    for (const player of players) {
      const originalStatus = player.status;
      console.log(`Processing player ${player.user_id} (current status: ${originalStatus})`);

      try {
        // Perform individual checkin
        const checkinResult = await performCheckin(
          {
            userId: player.user_id,
            eventId: eventId
          },
          config
        );

        results.push({
          userId: player.user_id,
          success: checkinResult.success,
          message: checkinResult.message,
          originalStatus: originalStatus
        });

        if (checkinResult.success) {
          successCount++;
        }

      } catch (error) {
        console.error(`Failed to process player ${player.user_id}:`, error);
        results.push({
          userId: player.user_id,
          success: false,
          message: error instanceof Error ? error.message : "Unknown error",
          originalStatus: originalStatus
        });
      }
    }

    const successRate = players.length > 0 ? (successCount / players.length * 100).toFixed(1) : "0";

    console.log(`Bulk checkin completed: ${successCount}/${players.length} players confirmed (${successRate}%)`);

    return {
      success: true,
      message: `Bulk checkin completed for event ${eventId}. ${successCount}/${players.length} players processed successfully (${successRate}%)`,
      details: {
        eventId,
        eventStatus: event.status,
        totalPlayers: players.length,
        successfulCheckins: successCount,
        results
      }
    };

  } catch (error) {
    console.error("Bulk checkin process failed:", error);
    return {
      success: false,
      message: "Bulk checkin process failed due to internal error",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
