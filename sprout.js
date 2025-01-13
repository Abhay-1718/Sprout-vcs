import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { diffLines } from "diff";
import chalk from "chalk";


class Sprout {
  constructor(repoPath = ".") {
    this.repoPath = path.join(repoPath, ".sprout");
    this.objectsPath = path.join(this.repoPath, "objects"); // it will make .sprout/objects
    this.headPath = path.join(this.repoPath, "HEAD"); //.sprout/HEAD
    this.indexPath = path.join(this.repoPath, "index"); // .sprout/index
    this.init();
  }

  async init() {
    try {
      // Create objects folder inside .sprout
      await fs.mkdir(this.objectsPath, { recursive: true });
  
      // Only create the HEAD file if it doesn't already exist
      try {
        await fs.writeFile(this.headPath, "", { flag: "wx" });
      } catch (error) {
        if (error.code !== "EEXIST") {
          // If the error is not 'file already exists', rethrow it
          throw error;
        }
      }
  
      // Check if the index file already exists before trying to create it
      try {
        await fs.access(this.indexPath);
      } catch (error) {
        if (error.code === "ENOENT") {
          // If the index file does not exist, create it
          await fs.writeFile(this.indexPath, JSON.stringify([]), { flag: "wx" });
        }
      }
  
      console.log("Repository initialized.");
    } catch (error) {
      console.log(
        "Already initialized the .sprout folder or error occurred:",
        error
      );
    }
  }
  
  

  // Hash the content using SHA-1
  hashObject(content) {
    return crypto.createHash("sha1").update(content, "utf-8").digest("hex");
  }

  // Add a file to the repository
  async add(fileToBeAdded) {
    try {
      // Check if file exists
      try {
        await fs.access(fileToBeAdded);
      } catch (error) {
        throw new Error(`File "${fileToBeAdded}" does not exist.`);
      }

      // Read file content
      const filedata = await fs.readFile(fileToBeAdded, { encoding: "utf-8" });

      // Generate the file's hash
      const fileHash = this.hashObject(filedata);
      console.log(`File Hash: ${fileHash}`);

      // Define the new file path in the objects directory
      const newFileHashedObjectPath = path.join(this.objectsPath, fileHash);
      console.log(`Object path: ${newFileHashedObjectPath}`);

      // Write file data to the objects directory using the hash as filename
      await fs.writeFile(newFileHashedObjectPath, filedata);

      // Update the staging area (index)
      await this.updateStagingArea(fileToBeAdded, fileHash);

      console.log(`Added "${fileToBeAdded}" successfully.`);
    } catch (error) {
      console.error("Error in add method:", error);
    }
  }

  // Update the staging area (index)
  async updateStagingArea(filePath, fileHash) {
    try {
      // Read the current index file
      const index = JSON.parse(
        await fs.readFile(this.indexPath, { encoding: "utf-8" })
      );

      // Add new entry to the index
      index.push({ path: filePath, hash: fileHash });

      // Write updated index back to the file
      await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2));

      console.log("Staging area updated.");
    } catch (error) {
      console.error("Error updating staging area:", error);
    }
  }

  // Commit changes to the repository
  async commit(message) {
    const index = JSON.parse(
      await fs.readFile(this.indexPath, { encoding: "utf-8" })
    );
    const parentCommit = await this.getCurrentHead();

    const commitData = {
      timeStamp: new Date().toISOString(),
      message,
      files: index,
      parent: parentCommit,
    };

    const commitHash = this.hashObject(JSON.stringify(commitData));
    const commitPath = path.join(this.objectsPath, commitHash);
    await fs.writeFile(commitPath, JSON.stringify(commitData));
    await fs.writeFile(this.headPath, commitHash);
    await fs.writeFile(this.indexPath, JSON.stringify([]));
    console.log(`Commit successfully created: ${commitHash}`);
  }

  // Get the current HEAD (latest commit)
  async getCurrentHead() {
    try {
      return await fs.readFile(this.headPath, { encoding: "utf-8" });
    } catch (error) {
      console.log("Warning: No commits found. Initialize the repository with a commit.");
      return null;
    }
  }

  // Log all commits from the current HEAD
  async log() {
    let currentCommitHash = await this.getCurrentHead();
    while (currentCommitHash) {
      const commitData = JSON.parse(
        await fs.readFile(path.join(this.objectsPath, currentCommitHash), {
          encoding: "utf-8",
        })
      );
      console.log(
        `---------------------------------------------------------------------------`
      );

      console.log(
        `commit: ${currentCommitHash}\nDate: ${commitData.timeStamp}\n\n${commitData.message}\n\n`
      );
      currentCommitHash = commitData.parent;
    }
  }

  // Show the diff of a specific commit
async showCommitDiff(commitHash) {
    const commitData = JSON.parse(await this.getCommitData(commitHash));
    if (!commitData) {
      console.log("Commit not found");
      return;
    }
    console.log("Changes in the last commit:");
  
    for (const file of commitData.files) {
      console.log(`File: ${file.path}`);
      const fileContent = await this.getFileContent(file.hash);
      console.log("Current file content:\n", fileContent);
  
      if (commitData.parent) {
        const parentCommitData = JSON.parse(
          await this.getCommitData(commitData.parent)
        );
        const parentFileContent = await this.getParentFileContent(
          parentCommitData,
          file.path
        );
  
        if (parentFileContent !== undefined) {
          console.log("\nDiff: ");
          const diff = diffLines(parentFileContent, fileContent);
  
          let diffPrinted = false;
          diff.forEach((part) => {
            if (part.added) {
              process.stdout.write(chalk.green("++" + part.value)); // added lines in green
              diffPrinted = true;
            } else if (part.removed) {
              process.stdout.write(chalk.red("--" + part.value)); // removed lines in red
              diffPrinted = true;
            } else {
              process.stdout.write(chalk.gray(part.value)); // unchanged lines in gray
            }
          });
  
          if (!diffPrinted) {
            console.log(chalk.yellow("No differences detected in this file."));
          }
          console.log(); // new line after diff output
        } else {
          console.log("New file in this commit");
          console.log(fileContent); // Print the content of the new file
        }
      } else {
        console.log("First commit — No parent commit to compare.");
      }
    }
  }
  
  // Get the content of a file from the parent commit
  async getParentFileContent(parentCommitData, filePath) {
    const parentFile = parentCommitData.files.find(
      (file) => file.path === filePath
    );
    if (parentFile) {
      // Retrieve the file content from the parent commit and return it
      return await this.getFileContent(parentFile.hash);
    }
    return undefined; // If no file found in parent commit, return undefined
  }

  // Get commit data by hash
  async getCommitData(commitHash) {
    const commitPath = path.join(this.objectsPath, commitHash);
    try {
      return await fs.readFile(commitPath, { encoding: "utf-8" });
    } catch (error) {
      console.log("Failed to read commit data:", error);
      return null;
    }
  }

  // Get the content of a file by its hash
  async getFileContent(fileHash) {
    const objectPath = path.join(this.objectsPath, fileHash);
    return fs.readFile(objectPath, { encoding: "utf-8" });
  }
}



// Usage Example
(async () => {
  const sprout = new Sprout();
  // await sprout.add("sample.txt");
  // await sprout.add("sample2.txt");
  // await sprout.commit("first commit");
  // await sprout.log();
  // await sprout.showCommitDiff('c477926ce87572a7975d960899df81224f01c5b5');
})();
