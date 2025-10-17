import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { validatePlayerPresence } from './validate-player-presence.js';

export { validatePlayerPresence } from './validate-player-presence.js';

const usage = (): string => {
  return [
    'Usage: npm run discord -- <username-or-id> [roleName ...] [--use-id]',
    '',
    'Positional arguments:',
    '  <username-or-id>  Username, display name, or user ID to validate',
    '  [roleName ...]     Optional role names to check (defaults to ROLE_NAME env)',
    '',
    'Flags:',
    '  --use-id           Treat the target as a Discord user ID'
  ].join('\n');
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const useId = args.includes('--use-id') || args.includes('--id');
  const filteredArgs = args.filter(arg => arg !== '--use-id' && arg !== '--id');
  const [target, ...roleNames] = filteredArgs;

  if (!target) {
    console.error(usage());
    process.exit(1);
  }

  try {
    const result = await validatePlayerPresence({
      target,
      roleNames: roleNames.length > 0 ? roleNames : undefined,
      useId
    });

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Validation failed:', error);
    process.exit(1);
  }
};

const isDirectExecution = (): boolean => {
  if (!process.argv[1]) return false;
  const entryUrl = pathToFileURL(process.argv[1]).href;
  return import.meta.url === entryUrl;
};

if (isDirectExecution()) {
  void main();
}
