# Smart Tipping & Direct Checkout Portal

A modern, high-performance web application designed for seamless tip collection, digital staff onboarding, and cloud-synchronized digital QR code generation. Built with a full-stack architecture powered by React, Vite, Express, and Firebase.

---

## 🚀 How to Export & Upload this Project to GitHub

Because the exported ZIP archive does not come with an active Local Git repository, you need to initialize Git and point it to your preferred GitHub repository. 

We have provided two helper scripts in this folder (`setup-github.sh` for Mac/Linux and `setup-github.bat` for Windows) to automate this. Alternatively, you can follow the step-by-step commands below.

### Option 1: Automate using the Setup Script

1. **Open your local terminal** (Command Prompt, terminal, or Git Bash) in your extracted project folder.
2. Run the script for your operating system:
   * **macOS / Linux**: 
     ```bash
     chmod +x setup-github.sh
     ./setup-github.sh
     ```
   * **Windows**:
     ```cmd
     setup-github.bat
     ```
3. Enter your GitHub repository URL (e.g., `https://github.com/your-username/your-repo-name.git`) when prompted. The script will initialize your repository, commit all files, pair it with GitHub, and push it to your `main` branch.

---

### Option 2: Run Git Commands Manually

If you prefer to run the commands yourself, perform the following steps:

#### 1. Initialize a Git Repository
Initialize a clean local Git repository in the project's root folder:
```bash
git init
```

#### 2. Configure Git to Ignore Build Artifacts
We have already pre-configured a `.gitignore` file for you, which ensures heavy directories (like `node_modules/` or production build outputs `dist/`) are not sent to your repository. Verify your files are staged by running:
```bash
git status
```

#### 3. Stage & Commit the Files
Add all tracking files to the staging index and make your initial commit:
```bash
git add .
git commit -m "feat: initial commit of tipping portal codebase from Google AI Studio"
```

#### 4. Rename the Default Branch to Main
Historically, Git defaults to standard master branch names. Make sure it matches modern GitHub expectations:
```bash
git branch -M main
```

#### 5. Link to your Remote GitHub Repository
Go to your [GitHub Account](https://github.com), click **New Repository**, choose a name, and leave it empty (do **not** check initialize with README, license, or .gitignore). 

Copy the secure repository URL and run:
```bash
git remote add origin https://github.com/your-username/your-repo-name.git
```
*(Replace `https://github.com/your-username/your-repo-name.git` with your actual repository link)*

#### 6. Push your Code to GitHub
Push the local code on your main branch to your remote GitHub repository:
```bash
git push -u origin main
```

---

## 🛠️ Local Development & Launching

Once you clone or download the repository to your desktop:

### 1. Install Dependencies
Initialize and pull down all required npm packages:
```bash
npm install
```

### 2. Configure Environment Secrets
Create a local `.env` file in the root folder (based on our provided `.env.example`):
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Spin up the Developer Servers
Boot up the full-stack server (Vite middleware asset server and Express backend):
```bash
npm run dev
```
Open your browser to `http://localhost:3000` to preview and test your application locally.
