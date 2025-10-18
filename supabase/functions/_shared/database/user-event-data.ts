import { createClient } from "jsr:@supabase/supabase-js@2";
import { formatDublinLocal } from "../utils/date.ts";

export interface UserEventData {
  userEmail: string;
  displayName: string;
  eventTitle: string;
  eventDateLocal: string;
  tournamentTitle?: string;
  gameName?: string;
}

export interface FetchUserEventDataResult {
  success: boolean;
  data?: UserEventData;
  error?: string;
}

/**
 * Fetch user and event data for email notification
 * @param supabaseUrl - Supabase project URL
 * @param supabaseServiceKey - Supabase service role key
 * @param userId - User ID from the webhook payload
 * @param eventId - Event ID from the webhook payload
 * @returns Promise with user and event data or error
 */
export async function fetchUserEventData(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string,
  eventId: string
): Promise<FetchUserEventDataResult> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Fetch user email (Auth Admin API)
    const userRes = await supabase.auth.admin.getUserById(userId);
    if (userRes.error || !userRes.data?.user?.email) {
      return {
        success: false,
        error: `User not found or no email: ${userRes.error?.message || "Unknown error"}`
      };
    }
    const userEmail = userRes.data.user.email;
    
    // Optional: fetch first/last name from public.app_users (if present)
    const { data: appUser } = await supabase
      .from("app_users")
      .select("first_name,last_name")
      .eq("user_id", userId)
      .maybeSingle();
    
    const displayName = [
      appUser?.first_name,
      appUser?.last_name
    ].filter(Boolean).join(" ").trim() || "there";
    
    // Get event info with tournament & game
    const { data: eventRow, error: eventErr } = await supabase
      .from("league_events")
      .select(`
        id,
        event_title,
        event_date,
        league_tournaments (
          title,
          ref_games (
            name
          )
        )
      `)
      .eq("id", eventId)
      .maybeSingle();

    if (eventErr || !eventRow) {
      return {
        success: false,
        error: `Event not found: ${eventErr?.message || "Unknown error"}`
      };
    }
    
    const eventTitle = eventRow.event_title ?? "League Event";
    const eventDateLocal = formatDublinLocal(eventRow.event_date);
    
    // Handle tournament data - it might be an array or object
    const tournament = Array.isArray(eventRow.league_tournaments) 
      ? eventRow.league_tournaments[0] 
      : eventRow.league_tournaments;
    
    const tournamentTitle = tournament?.title ?? undefined;
    const game = Array.isArray(tournament?.ref_games) 
      ? tournament.ref_games[0] 
      : tournament?.ref_games;
    const gameName = game?.name ?? undefined;    return {
      success: true,
      data: {
        userEmail,
        displayName,
        eventTitle,
        eventDateLocal,
        tournamentTitle,
        gameName
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Database fetch error: ${String(error)}`
    };
  }
}