import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import chalk from "chalk";
import { Diff as textDiff } from "diff";

class ModernVCS {
  constructor(options = {}) {
    this.vcsFolder = options.vcsFolder || ".simplevcs";
    this.currentBranch = "main";
    this.paths = {
      root: this.vcsFolder,
      commits: path.join(this.vcsFolder, "commits"),
      files: path.join(this.vcsFolder, "files"),
      branches: path.join(this.vcsFolder, "branches"),
      staging: path.join(this.vcsFolder, "staging.json"),
      config: path.join(this.vcsFolder, "config.json"),
      HEAD: path.join(this.vcsFolder, "HEAD")
    };
  }

  async initialize() {
    try {
      // Create all necessary directories
      await Promise.all([
        fs.mkdir(this.paths.root, { recursive: true }),
        fs.mkdir(this.paths.commits, { recursive: true }),
        fs.mkdir(this.paths.files, { recursive: true }),
        fs.mkdir(this.paths.branches, { recursive: true })
      ]);

      // Initialize default files
      const defaultFiles = [
        { path: this.paths.staging, content: "[]" },
        { path: this.paths.config, content: JSON.stringify({ 
          user: null,
          created: new Date().toISOString()
        }, null, 2)},
        { path: this.paths.HEAD, content: "ref: refs/heads/main" }
      ];

      await Promise.all(defaultFiles.map(file => 
        fs.writeFile(file.path, file.content).catch(() => {})
      ));

      console.log(chalk.green("✓ VCS initialized successfully!"));
    } catch (error) {
      console.error(chalk.red("Initialization error:"), error);
      throw error;
    }
  }

  async add(filenames) {
    const files = Array.isArray(filenames) ? filenames : [filenames];
    
    try {
      const staging = await this.getStaging();
      
      for (const filename of files) {
        const stats = await fs.stat(filename);
        
        if (stats.isDirectory()) {
          const dirFiles = await this.getFilesFromDirectory(filename);
          await Promise.all(dirFiles.map(file => this.addFile(file, staging)));
        } else {
          await this.addFile(filename, staging);
        }
      }

      await this.saveStaging(staging);
      console.log(chalk.green("✓ Files added to staging"));
    } catch (error) {
      console.error(chalk.red("Error adding files:"), error);
      throw error;
    }
  }

  async addFile(filename, staging) {
    const content = await fs.readFile(filename, 'utf-8');
    const hash = this.createHash(content);
    
    await fs.writeFile(path.join(this.paths.files, hash), content);
    
    const existingIndex = staging.findIndex(f => f.filename === filename);
    if (existingIndex !== -1) {
      staging[existingIndex].hash = hash;
    } else {
      staging.push({ filename, hash });
    }
  }

  async commit(message) {
    try {
      const staging = await this.getStaging();
      
      if (staging.length === 0) {
        throw new Error("Nothing to commit!");
      }

      const previousCommit = await this.getCurrentCommit();
      const commit = {
        timestamp: new Date().toISOString(),
        message,
        files: staging,
        parent: previousCommit?.hash || null,
        branch: this.currentBranch
      };

      const commitHash = this.createHash(JSON.stringify(commit));
      const commitPath = path.join(this.paths.commits, commitHash);
      
      await fs.writeFile(commitPath, JSON.stringify(commit, null, 2));
      await this.updateBranchPointer(this.currentBranch, commitHash);
      await this.saveStaging([]);

      console.log(chalk.green(`✓ Created commit: ${chalk.bold(commitHash)}`));
      console.log(chalk.blue(`Message: ${message}`));
      
      return commitHash;
    } catch (error) {
      console.error(chalk.red("Commit error:"), error);
      throw error;
    }
  }

  async branch(branchName) {
    try {
      const currentCommit = await this.getCurrentCommit();
      if (!currentCommit) {
        throw new Error("Cannot create branch: no commits exist");
      }

      const branchPath = path.join(this.paths.branches, branchName);
      await fs.writeFile(branchPath, currentCommit.hash);
      console.log(chalk.green(`✓ Created branch: ${chalk.bold(branchName)}`));
    } catch (error) {
      console.error(chalk.red("Branch error:"), error);
      throw error;
    }
  }

  async checkout(branchName) {
    try {
      const branchPath = path.join(this.paths.branches, branchName);
      await fs.access(branchPath);
      
      this.currentBranch = branchName;
      await fs.writeFile(this.paths.HEAD, `ref: refs/heads/${branchName}`);
      
      console.log(chalk.green(`✓ Switched to branch: ${chalk.bold(branchName)}`));
    } catch (error) {
      console.error(chalk.red("Checkout error:"), error);
      throw error;
    }
  }

  async diff(filename) {
    try {
      const currentContent = await fs.readFile(filename, 'utf-8');
      const lastCommit = await this.getCurrentCommit();
      
      if (!lastCommit) {
        console.log(chalk.yellow("No previous commits to compare with"));
        return;
      }

      const lastCommitFile = lastCommit.files.find(f => f.filename === filename);
      if (!lastCommitFile) {
        console.log(chalk.yellow("File not found in last commit"));
        return;
      }

      const oldContent = await fs.readFile(
        path.join(this.paths.files, lastCommitFile.hash), 
        'utf-8'
      );

      const differences = textDiff(oldContent, currentContent);
      
      differences.forEach(part => {
        const color = part.added ? chalk.green : 
                     part.removed ? chalk.red : 
                     chalk.grey;
        process.stdout.write(color(part.value));
      });
    } catch (error) {
      console.error(chalk.red("Diff error:"), error);
      throw error;
    }
  }

  async log(options = {}) {
    try {
      const commits = await fs.readdir(this.paths.commits);
      const sortedCommits = await this.getSortedCommits(commits);
      
      for (const commit of sortedCommits) {
        console.log(chalk.yellow("-".repeat(50)));
        console.log(chalk.blue(`Commit: ${chalk.bold(commit.hash)}`));
        console.log(`Branch: ${chalk.cyan(commit.branch)}`);
        console.log(`Date: ${new Date(commit.timestamp).toLocaleString()}`);
        console.log(`Message: ${commit.message}`);
        
        if (options.showFiles) {
          console.log("\nFiles:");
          commit.files.forEach(file => {
            console.log(chalk.grey(`- ${file.filename}`));
          });
        }
        console.log();
      }
    } catch (error) {
      console.error(chalk.red("Log error:"), error);
      throw error;
    }
  }

  async status() {
    try {
      const staging = await this.getStaging();
      const currentBranch = await this.getCurrentBranch();
      
      console.log(chalk.blue(`On branch ${chalk.bold(currentBranch)}`));
      
      if (staging.length === 0) {
        console.log(chalk.grey("\nNo files staged for commit"));
      } else {
        console.log(chalk.green("\nFiles staged for commit:"));
        staging.forEach(file => {
          console.log(chalk.grey(`- ${file.filename}`));
        });
      }

      // Show unstaged changes
      const unstagedFiles = await this.getUnstagedChanges();
      if (unstagedFiles.length > 0) {
        console.log(chalk.red("\nUnstaged changes:"));
        unstagedFiles.forEach(file => {
          console.log(chalk.grey(`- ${file}`));
        });
      }
    } catch (error) {
      console.error(chalk.red("Status error:"), error);
      throw error;
    }
  }

  // Helper methods
  createHash(content) {
    return crypto.createHash('sha1').update(content).digest('hex');
  }

  async getStaging() {
    const content = await fs.readFile(this.paths.staging, 'utf-8');
    return JSON.parse(content);
  }

  async saveStaging(staging) {
    await fs.writeFile(this.paths.staging, JSON.stringify(staging, null, 2));
  }

  async getCurrentBranch() {
    const head = await fs.readFile(this.paths.HEAD, 'utf-8');
    return head.replace('ref: refs/heads/', '');
  }

  async getCurrentCommit() {
    try {
      const branch = await this.getCurrentBranch();
      const branchPath = path.join(this.paths.branches, branch);
      const commitHash = await fs.readFile(branchPath, 'utf-8');
      const commitPath = path.join(this.paths.commits, commitHash);
      const commitData = await fs.readFile(commitPath, 'utf-8');
      return { hash: commitHash, ...JSON.parse(commitData) };
    } catch {
      return null;
    }
  }

  async updateBranchPointer(branch, commitHash) {
    const branchPath = path.join(this.paths.branches, branch);
    await fs.writeFile(branchPath, commitHash);
  }

  async getFilesFromDirectory(dirPath) {
    const files = [];
    
    async function traverse(currentPath) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          await traverse(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    }

    await traverse(dirPath);
    return files;
  }

  async getUnstagedChanges() {
    const staging = await this.getStaging();
    const currentCommit = await this.getCurrentCommit();
    const unstagedFiles = [];

    if (currentCommit) {
      for (const file of currentCommit.files) {
        try {
          const content = await fs.readFile(file.filename, 'utf-8');
          const currentHash = this.createHash(content);
          const stagedFile = staging.find(f => f.filename === file.filename);
          
          if (!stagedFile && currentHash !== file.hash) {
            unstagedFiles.push(file.filename);
          }
        } catch {
          // File might have been deleted
          unstagedFiles.push(file.filename);
        }
      }
    }

    return unstagedFiles;
  }

  async getSortedCommits(commitHashes) {
    const commits = await Promise.all(
      commitHashes.map(async hash => {
        const data = await fs.readFile(
          path.join(this.paths.commits, hash),
          'utf-8'
        );
        return { hash, ...JSON.parse(data) };
      })
    );

    return commits.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
  }
}

// CLI implementation
const vcs = new ModernVCS();

const commands = {
  async init() {
    await vcs.initialize();
  },

  async add(args) {
    if (args.length === 0) {
      throw new Error("Please specify file(s) to add");
    }
    await vcs.add(args);
  },

  async commit(args) {
    if (args.length === 0) {
      throw new Error("Please provide a commit message");
    }
    await vcs.commit(args.join(" "));
  },

  async branch(args) {
    if (args.length === 0) {
      throw new Error("Please specify branch name");
    }
    await vcs.branch(args[0]);
  },

  async checkout(args) {
    if (args.length === 0) {
      throw new Error("Please specify branch name");
    }
    await vcs.checkout(args[0]);
  },

  async diff(args) {
    if (args.length === 0) {
      throw new Error("Please specify file to diff");
    }
    await vcs.diff(args[0]);
  },

  async log() {
    await vcs.log({ showFiles: true });
  },

  async status() {
    await vcs.status();
  }
};

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || !commands[command]) {
    console.log(chalk.blue(`
Modern VCS Usage:
  node vcs.js init              Initialize repository
  node vcs.js add <file...>     Add file(s) to staging
  node vcs.js commit <message>   Commit staged changes
  node vcs.js branch <name>      Create a new branch
  node vcs.js checkout <name>    Switch to a branch
  node vcs.js diff <file>        Show changes in a file
  node vcs.js status            Show current status
  node vcs.js log               Show commit history
    `));
    return;
  }

  try {
    await commands[command](args);
  } catch (error) {
    console.error(chalk.red("\nError:"), error.message);
    process.exit(1);
  }
}

main();