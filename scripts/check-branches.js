const { execSync } = require('child_process');

const branches = [
  'origin/feat/issue-1-init',
  'origin/feat/issue-18-phaser-integration',
  'origin/feat/issue-2-watcher-service',
  'origin/feat/issue-2-watcher-v2',
  'origin/feat/issue-20-agent-sprites',
  'origin/feat/issue-22-state-sync',
  'origin/feat/issue-23-town-map',
  'origin/feat/issue-24-schedule-system',
  'origin/feat/issue-25-social-interaction',
  'origin/feat/issue-25-social-v2',
  'origin/feat/issue-26-env-v2',
  'origin/feat/issue-26-environment',
  'origin/feat/issue-27-performance',
  'origin/feat/issue-3-event-analysis',
  'origin/feat/issue-4-moment-gen-v2',
  'origin/feat/issue-4-moment-generator',
  'origin/feat/issue-5-status-panel',
  'origin/feat/issue-6-feed-v2',
  'origin/feat/issue-6-social-feed'
];

console.log('Checking merge status of branches into main...');

branches.forEach(branch => {
  try {
    // Get the latest commit message of the branch
    const log = execSync(`git log -n 1 --format=%s ${branch}`).toString().trim();
    
    // Check if this message exists in main
    // We use --grep to find if the commit message exists in main
    // We limit to 100 commits to be safe, assuming recent merges
    const inMain = execSync(`git log --grep="${log}" origin/main`).toString().trim();
    
    if (inMain) {
      console.log(`[MERGED] ${branch} (found by commit message)`);
    } else {
      // Check if the commit hash is in main (direct merge)
      const hash = execSync(`git rev-parse ${branch}`).toString().trim();
      const isMerged = execSync(`git branch -r --contains ${hash} origin/main`).toString().trim();
      
      if (isMerged) {
        console.log(`[MERGED] ${branch} (direct merge)`);
      } else {
        console.log(`[NOT MERGED] ${branch}`);
      }
    }
  } catch (e) {
    console.log(`[ERROR] checking ${branch}: ${e.message}`);
  }
});
