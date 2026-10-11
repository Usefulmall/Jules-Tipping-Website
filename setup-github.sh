#!/bin/bash

# ANSI Color Codes for beautiful console feedback
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

clear
echo -e "${BLUE}====================================================${NC}"
echo -e "${GREEN}       GitHub Initialization Automation Script        ${NC}"
echo -e "${BLUE}====================================================${NC}"
echo ""

# Check if git is installed
if ! command -v git &> /dev/null
then
    echo -e "${RED}Error: 'git' command not found. Please install Git before executing.${NC}"
    exit 1
fi

# Check if git repository already exists
if [ -d ".git" ]; then
    echo -e "${YELLOW}Warning: A .git folder already exists in this directory.${NC}"
    read -p "Do you want to re-initialize your Git history? (y/n): " REINIT
    if [[ "$REINIT" =~ ^[Yy]$ ]]; then
        rm -rf .git
        echo -e "${GREEN}Cleaned up previous Git history.${NC}"
    else
        echo -e "${BLUE}Aborted script execution. No changes made.${NC}"
        exit 0
    fi
fi

# Ask for the repository URL
echo -e "Please paste your GitHub Repository URL:"
echo -e "${YELLOW}(Example: https://github.com/username/repository-name.git)${NC}"
read -p "Repository URL: " REPO_URL

# Validate that the link looks like a git repo
if [[ -z "$REPO_URL" ]]; then
    echo -e "${RED}Error: Repository URL cannot be empty.${NC}"
    exit 1
fi

echo -e "\n${BLUE}[1/5] Initializing clean Git repository...${NC}"
git init

echo -e "\n${BLUE}[2/5] Staging folder files...${NC}"
git add .

echo -e "\n${BLUE}[3/5] Creating initial commit...${NC}"
git commit -m "feat: initial commit of tipping portal codebase from Google AI Studio"

echo -e "\n${BLUE}[4/5] Restructuring Default Branch to 'main'...${NC}"
git branch -M main

echo -e "\n${BLUE}[5/5] Mapping repository to origin URL...${NC}"
git remote add origin "$REPO_URL"

echo ""
echo -e "${YELLOW}====================================================${NC}"
echo -e "Ready to push files to: ${GREEN}$REPO_URL${NC}"
echo -e "Press Enter to execute 'git push -u origin main' or Ctrl+C to abort."
echo -e "${YELLOW}====================================================${NC}"
read -p ""

git push -u origin main

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✔ SUCCESS! Your repository has been pushed to GitHub successfully.${NC}"
    echo -e "Visit ${BLUE}${REPO_URL%.git}${NC} in your browser to see your files."
else
    echo -e "\n${RED}✖ Something went wrong with the push process.${NC}"
    echo -e "Please verify your GitHub credentials, network connection, and repository permissions."
fi
