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
  if (!member?.presence) return 'unknown';
  return member.presence.status;
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
  const response = await discordApiRequest(
    `/guilds/${guildId}/members?limit=${limit}`, 
    token
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch guild members: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
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
 * Fetch member presence from Discord API
 */
async function fetchMemberPresence(
  guildId: string, 
  memberId: string, 
  token: string
): Promise<DiscordPresence | null> {
  try {
    const response = await discordApiRequest(
      `/guilds/${guildId}/members/${memberId}`, 
      token
    );
    
    if (!response.ok) {
      return null;
    }
    
    const memberData = await response.json();
    return memberData.presence || null;
  } catch {
    return null;
  }
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

          // Fetch presence data
          const presence = await fetchMemberPresence(guildId, member.user.id, token);
          const status = presence?.status ?? 'unknown';
          const isPresent = status !== 'unknown' && ONLINE_STATUSES.includes(status);
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