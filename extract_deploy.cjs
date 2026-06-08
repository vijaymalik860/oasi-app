const fs = require('fs');

try {
  const logContent = fs.readFileSync('C:\\Users\\HP\\.gemini\\antigravity\\brain\\95af0959-f40c-40e0-b236-c7d29daa5c90\\.system_generated\\logs\\overview.txt', 'utf8');
  const lines = logContent.split('\n');
  
  let targetContent = '';
  for (let line of lines) {
    if (!line) continue;
    try {
      const json = JSON.parse(line);
      if (json.tool_calls && json.tool_calls[0] && json.tool_calls[0].name === 'write_to_file') {
        const args = json.tool_calls[0].args;
        if (args.TargetFile && typeof args.TargetFile === 'string' && args.TargetFile.includes('DeployManager.jsx')) {
           let content = args.CodeContent;
           if (typeof content === 'string' && content.startsWith('"')) {
             try {
               content = JSON.parse(content);
             } catch(e) {}
           }
           targetContent = content;
           break;
        }
      }
    } catch(err) {
      // Ignore parse errors for individual lines
    }
  }
  
  if (targetContent) {
    fs.writeFileSync('temp_deploy.jsx', targetContent);
    console.log('Successfully extracted code to temp_deploy.jsx');
  } else {
    console.log('Could not find DeployManager code in log file');
  }
} catch (error) {
  console.error('Error:', error);
}
