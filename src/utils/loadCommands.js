const fs = require('fs');
const path = require('path');

function loadCommands() {
  const commands = new Map();
  const commandsDir = path.join(__dirname, '..', 'commands');
  const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    const command = require(path.join(commandsDir, file));
    if (!command?.data?.name || typeof command.execute !== 'function') {
      console.warn(`[Commands] Skipped invalid command file: ${file}`);
      continue;
    }
    commands.set(command.data.name, command);
  }
  return commands;
}

module.exports = { loadCommands };
