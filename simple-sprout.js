import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

class SimpleVCS {
  constructor() {
    // Main folder to store all VCS data
    this.vcsFolder = ".simplevcs";
    this.setupFolders();
  }

  // Create necessary folders
  async setupFolders() {
    try {
      await fs.mkdir(this.vcsFolder, { recursive: true });
      await fs.mkdir(path.join(this.vcsFolder, "commits"), { recursive: true });
      await fs.mkdir(path.join(this.vcsFolder, "files"), { recursive: true });
      
      // Create or read staging file
      const stagingPath = path.join(this.vcsFolder, "staging.json");
      try {
        await fs.access(stagingPath);
      } catch {
        await fs.writeFile(stagingPath, "[]");
      }
      
      console.log("VCS initialized successfully!");
    } catch (error) {
      console.error("Setup error:", error);
    }
  }

  // Add file to staging
  async add(filename) {
    try {
      // Read file content
      const content = await fs.readFile(filename, 'utf-8');
      
      // Create file hash
      const hash = crypto.createHash('sha1').update(content).digest('hex');
      
      // Save file content
      await fs.writeFile(path.join(this.vcsFolder, "files", hash), content);
      
      // Update staging
      const stagingPath = path.join(this.vcsFolder, "staging.json");
      const staging = JSON.parse(await fs.readFile(stagingPath, 'utf-8'));
      
      staging.push({
        filename,
        hash
      });
      
      await fs.writeFile(stagingPath, JSON.stringify(staging, null, 2));
      console.log(`Added ${filename} to staging`);
      
    } catch (error) {
      console.error(`Error adding file ${filename}:`, error);
    }
  }

  // Commit changes
  async commit(message) {
    try {
      // Read staging
      const stagingPath = path.join(this.vcsFolder, "staging.json");
      const staging = JSON.parse(await fs.readFile(stagingPath, 'utf-8'));
      
      if (staging.length === 0) {
        console.log("Nothing to commit!");
        return;
      }

      // Create commit object
      const commit = {
        timestamp: new Date().toISOString(),
        message,
        files: staging
      };

      // Save commit
      const commitHash = crypto.createHash('sha1')
        .update(JSON.stringify(commit))
        .digest('hex');
      
      await fs.writeFile(
        path.join(this.vcsFolder, "commits", commitHash),
        JSON.stringify(commit, null, 2)
      );

      // Clear staging
      await fs.writeFile(stagingPath, "[]");

      console.log(`Created commit: ${commitHash}`);
      console.log(`Message: ${message}`);
      
    } catch (error) {
      console.error("Commit error:", error);
    }
  }

  // Show history
  async log() {
    try {
      const commits = await fs.readdir(path.join(this.vcsFolder, "commits"));
      
      for (const commitHash of commits) {
        const commitData = JSON.parse(
          await fs.readFile(path.join(this.vcsFolder, "commits", commitHash), 'utf-8')
        );
        
        console.log("-".repeat(50));
        console.log(`Commit: ${commitHash}`);
        console.log(`Date: ${commitData.timestamp}`);
        console.log(`Message: ${commitData.message}`);
        console.log("\nFiles:");
        commitData.files.forEach(file => {
          console.log(`- ${file.filename}`);
        });
        console.log();
      }
      
    } catch (error) {
      console.error("Log error:", error);
    }
  }

  // Show current status
  async status() {
    try {
      const stagingPath = path.join(this.vcsFolder, "staging.json");
      const staging = JSON.parse(await fs.readFile(stagingPath, 'utf-8'));
      
      if (staging.length === 0) {
        console.log("No files staged for commit");
      } else {
        console.log("Files staged for commit:");
        staging.forEach(file => {
          console.log(`- ${file.filename}`);
        });
      }
      
    } catch (error) {
      console.error("Status error:", error);
    }
  }
}


const [command, ...args] = process.argv.slice(2);
const vcs = new SimpleVCS();

switch (command) {
  case 'init':
    // Already initialized in constructor
    break;
    
  case 'add':
    if (args.length === 0) {
      console.log("Please specify file(s) to add");
      break;
    }
    args.forEach(file => vcs.add(file));
    break;
    
  case 'commit':
    if (args.length === 0) {
      console.log("Please provide a commit message");
      break;
    }
    vcs.commit(args.join(" "));
    break;
    
  case 'log':
    vcs.log();
    break;
    
  case 'status':
    vcs.status();
    break;
    
  default:
    console.log(`
Simple VCS Usage:
  node simple-sprout.js init              Initialize repository
  node simple-sprout.js add <file>        Add file to staging
  node simple-sprout.js commit <message>   Commit staged changes
  node simple-sprout.js status            Show current status
  node simple-sprout.js log               Show commit history
    `);
}


// # Create a test file
// echo "Hello World" > test.txt

// # Add it to VCS
// node simple-sprout.js add test.txt

// # Check what's staged
// node simple-sprout.js status

// # Commit it
// node simple-sprout.js commit "Add test file"

// # View history
// node simple-sprout.js log