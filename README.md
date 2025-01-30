# Modern VCS

A lightweight, modern version control system implemented in Node.js. This simple VCS provides basic version control functionality including staging files, committing changes, branching, and viewing differences between versions.

## Features

- File staging and committing
- Branch creation and management
- Commit history viewing
- File diff visualization
- Status checking for staged and unstaged changes
- Directory support for adding multiple files
- Colored command-line output for better readability

## Prerequisites

- Node.js (v14.0.0 or higher)
- npm (Node Package Manager)

## Installation

1. Clone or download this repository:
```bash
git clone [repository-url]
cd modern-vcs
```

2. Install the required dependencies:
```bash
npm install chalk diff
```

3. Make the script executable (optional):
```bash
chmod +x vcs.js
```

## Usage

The VCS can be used with the following commands:

### Initialize a Repository
```bash
node vcs.js init
```
This creates a new VCS repository in the current directory.

### Add Files to Staging
```bash
node vcs.js add <file1> <file2> ...
```
Add one or more files to the staging area. You can also add entire directories.

### Commit Changes
```bash
node vcs.js commit "Your commit message"
```
Commit staged changes with a descriptive message.

### Create a Branch
```bash
node vcs.js branch <branch-name>
```
Create a new branch from the current commit.

### Switch Branches
```bash
node vcs.js checkout <branch-name>
```
Switch to a different branch.

### View File Differences
```bash
node vcs.js diff <filename>
```
Show the differences between the current version of a file and its last committed version.

### Check Repository Status
```bash
node vcs.js status
```
Display the current branch, staged files, and unstaged changes.

### View Commit History
```bash
node vcs.js log
```
Show the commit history with timestamps, messages, and affected files.

## File Structure

The VCS creates a `.simplevcs` directory with the following structure:
```
.simplevcs/
├── commits/      # Stores commit objects
├── files/        # Stores file contents
├── branches/     # Stores branch references
├── staging.json  # Current staged files
├── config.json   # VCS configuration
└── HEAD          # Points to current branch
```

## Error Handling

The system includes comprehensive error handling and will display clear error messages in red when:
- Required arguments are missing
- Files cannot be found
- Operations fail
- Invalid commands are used

## Limitations

- No remote repository support
- No merge functionality
- Single-user focused
- No binary file support (text files only)

## Contributing

Feel free to submit issues and pull requests to help improve this project.

## License

This project is licensed under the MIT License - see the LICENSE file for details.