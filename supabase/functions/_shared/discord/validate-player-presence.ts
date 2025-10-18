// Discord.js types adapted for Deno and Supabase Edge Functions
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

export interface DiscordPresenceStatus {
  online: 'online';
  idle: 'idle'; 
  dnd: 'dnd';
  offline: 'offline';
  invisible: 'invisible';
}

export type PresenceStatus = keyof DiscordPresenceStatus | 'unknown';

export interface DiscordUser {
  id: string;
  username: string;
  globalName?: string;
  discriminator?: string;
}

export interface DiscordRole {
  id: string;
  name: string;
}

export interface DiscordMember {
  user: DiscordUser;
  nick?: string;
  roles: string[]; // Array of role IDs
}

export interface DiscordPresence {
  status: PresenceStatus;
}

export interface DiscordGuildMember extends DiscordMember {
  presence?: DiscordPresence;
}

const ONLINE_STATUSES: PresenceStatus[] = ['online', 'idle', 'dnd'];

const normalize = (value: unknown): string =>
  (value ?? '').toString().trim().toLowerCase();

const getOnlineStatus = (member: DiscordGuildMember | null): PresenceStatus => {
  if (!member) {
    console.log('No member provided');
    return 'unknown';
  }
  
  if (!member.presence) {
    console.log('No presence data for member:', member.user?.username || 'unknown user');
    return 'unknown';
  }
  
  const status = member.presence.status;
  console.log('Presence data found for', member.user?.username || 'unknown user', ':', member.presence);
  
  // Ensure status is valid
  if (!status || typeof status !== 'string') {
    console.log('Invalid status type:', typeof status, status);
    return 'unknown';
  }
  
  return status as PresenceStatus;
};

const memberMatchesNameish = (member: DiscordGuildMember, target: string): boolean => {
  const normalizedTarget = normalize(target);
  const user = member.user;
  const candidates = [
    normalize(user?.username),
    normalize(member?.nick),
    normalize(user?.globalName)
  ].filter(Boolean);

  return candidates.includes(normalizedTarget);
};

const memberHasMatchingRole = (
  member: DiscordGuildMember,
  roleIds: Set<string>,
  roleNames: Set<string>,
  guildRoles: Map<string, DiscordRole>
): boolean => {
  if (roleIds.size === 0 && roleNames.size === 0) return false;

  for (const roleId of member.roles) {
    if (roleIds.has(roleId)) return true;
    
    const role = guildRoles.get(roleId);
    if (role && roleNames.has(normalize(role.name))) return true;
  }

  return false;
};

export interface BasePresenceOptions {
  token?: string;
  guildId?: string;
  roleNames?: string[];
  roleIds?: string[];
  useId?: boolean;
}

export interface ValidatePlayerPresenceOptions extends BasePresenceOptions {
  target: string;
}

export interface ValidatePlayersPresenceOptions extends BasePresenceOptions {
  targets: string[];
}

export interface PlayerPresenceResult {
  target: string;
  username: string;
  isMember: boolean;
  isRole: boolean;
  isPresent: boolean;
  error?: string;
}

/**
 * Make Discord API request with proper authentication
 */
async function discordApiRequest(
  endpoint: string, 
  token: string, 
  options: RequestInit = {}
): Promise<Response> {
  const baseUrl = 'https://discord.com/api/v10';
  const url = `${baseUrl}${endpoint}`;
  
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bot ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

/**
 * Fetch guild members from Discord API
 */
async function fetchGuildMembers(
  guildId: string, 
  token: string, 
  limit: number = 1000
): Promise<DiscordGuildMember[]> {
  // Try to fetch with presence information first
  let response = await discordApiRequest(
    `/guilds/${guildId}/members?limit=${limit}&with_presences=true`, 
    token
  );
  
  if (!response.ok) {
    // If that fails, try without presence information
    console.log('Failed to fetch with presences, trying without...');
    response = await discordApiRequest(
      `/guilds/${guildId}/members?limit=${limit}`, 
      token
    );
  }
  
  if (!response.ok) {
    throw new Error(`Failed to fetch guild members: ${response.status} ${response.statusText}`);
  }
  
  const members = await response.json();
  console.log(`Fetched ${members.length} members. Sample member structure:`, JSON.stringify(members[0], null, 2));
  return members;
}

/**
 * Fetch individual member presence from Discord API as fallback
 */
async function fetchMemberPresence(
  guildId: string, 
  memberId: string, 
  token: string
): Promise<DiscordPresence | null> {
  try {
    // Try the guild member endpoint first
    const response = await discordApiRequest(
      `/guilds/${guildId}/members/${memberId}`, 
      token
    );
    
    if (response.ok) {
      const memberData = await response.json();
      if (memberData.presence) {
        return memberData.presence;
      }
    }
    
    // If no presence in member data, try the user endpoint
    const userResponse = await discordApiRequest(
      `/users/${memberId}`, 
      token
    );
    
    if (userResponse.ok) {
      const userData = await userResponse.json();
      if (userData.presence) {
        return userData.presence;
      }
    }
    
    console.log(`No presence data available for member ${memberId}`);
    return null;
  } catch (error) {
    console.error(`Error fetching presence for member ${memberId}:`, error);
    return null;
  }
}

/**
 * Fetch guild roles from Discord API
 */
async function fetchGuildRoles(
  guildId: string, 
  token: string
): Promise<Map<string, DiscordRole>> {
  const response = await discordApiRequest(`/guilds/${guildId}/roles`, token);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch guild roles: ${response.status} ${response.statusText}`);
  }
  
  const roles: DiscordRole[] = await response.json();
  return new Map(roles.map(role => [role.id, role]));
}



/**
 * Validate multiple players' presence in Discord
 */
export async function validatePlayersPresence(
  options: ValidatePlayersPresenceOptions
): Promise<PlayerPresenceResult[]> {
  const {
    targets,
    roleNames: providedRoleNames,
    roleIds: providedRoleIds,
    useId = false
  } = options;

  const token = options.token ?? Deno.env.get('DISCORD_BOT_TOKEN');
  const guildId = options.guildId ?? Deno.env.get('DISCORD_GUILD_ID');
  const defaultRole = Deno.env.get('ROLE_NAME') ? [Deno.env.get('ROLE_NAME')!] : [];

  if (!token) {
    throw new Error('Missing Discord bot token. Provide via options.token or DISCORD_BOT_TOKEN.');
  }

  if (!guildId) {
    throw new Error('Missing guild ID. Provide via options.guildId or DISCORD_GUILD_ID.');
  }

  if (!targets || targets.length === 0) {
    throw new Error('Provide at least one target identifier (username or ID).');
  }

  const roleIds = new Set((providedRoleIds ?? []).filter(Boolean));
  const roleNames = new Set(
    (providedRoleNames ?? defaultRole).map(normalize).filter(Boolean)
  );

  try {
    // Fetch guild data
    const [members, guildRoles] = await Promise.all([
      fetchGuildMembers(guildId, token),
      fetchGuildRoles(guildId, token)
    ]);

    // Process each target
    const results = await Promise.all(
      targets.map(async (target) => {
        try {
          const member = useId
            ? members.find((m: DiscordGuildMember) => m.user.id === target)
            : members.find((m: DiscordGuildMember) => memberMatchesNameish(m, target));

          if (!member) {
            return {
              target,
              username: target,
              isMember: false,
              isRole: false,
              isPresent: false
            };
          }

          const username =
            member.user.globalName ||
            member.nick ||
            member.user.username ||
            target;

          // Try to get presence data from member object first
          let status = getOnlineStatus(member);
          
          // If no presence data in member object, try fetching it separately
          if (status === 'unknown') {
            console.log(`No presence in member object for ${username}, trying fallback API call...`);
            const presence = await fetchMemberPresence(guildId, member.user.id, token);
            status = presence?.status || 'unknown';
          }
          
          console.log(`Discord presence for ${username}:`, member.presence, status);
          const isPresent = status !== 'unknown' && ONLINE_STATUSES.includes(status.toLowerCase() as PresenceStatus);
          const isRole = memberHasMatchingRole(member, roleIds, roleNames, guildRoles);

          return {
            target,
            username,
            isMember: true,
            isRole,
            isPresent
          };
        } catch (error) {
          console.error(`Error processing target ${target}:`, error);
          return {
            target,
            username: target,
            isMember: false,
            isRole: false,
            isPresent: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    return results;
  } catch (error) {
    console.error('Error validating players presence:', error);
    throw error;
  }
}

/**
 * Validate single player's presence in Discord
 */
export async function validatePlayerPresence(
  options: ValidatePlayerPresenceOptions
): Promise<PlayerPresenceResult> {
  const results = await validatePlayersPresence({
    ...options,
    targets: [options.target]
  });

  return results[0];
}