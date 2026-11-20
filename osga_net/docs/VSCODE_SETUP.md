# Setting Up OSGA-Net in Visual Studio Code

This guide walks you through setting up and running the **OSGA-Net Workstation** inside **Visual Studio Code** on Windows, macOS, or Linux.

---

## 1. Prerequisites

Make sure the following are installed on your machine:
- **VS Code**: [https://code.visualstudio.com](https://code.visualstudio.com)
- **Python 3.10, 3.11, 3.12, or 3.13**: [https://python.org](https://python.org)
- **Node.js (v18 or higher) and npm**: [https://nodejs.org](https://nodejs.org)

### Recommended VS Code Extensions
Open the **Extensions view** (`Ctrl+Shift+X` or `Cmd+Shift+X`) and install:
1. **Python** (`ms-python.python`)
2. **Pylance** (`ms-python.vscode-pylance`)
3. **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`)
4. **ESLint** (`dbaeumer.vscode-eslint`)

---

## 2. Opening the Project in VS Code

1. Launch VS Code.
2. Select **File > Open Folder...** (`Ctrl+K Ctrl+O` on Windows / `Cmd+O` on macOS).
3. Select the folder:
   ```
   .../OSGA-Net_Code_v2/osga_net
   ```
   *(Important: Open the `osga_net` directory where `osga/`, `backend/`, and `frontend/` are located).*

---

## 3. Python Virtual Environment Setup

Open the integrated terminal in VS Code (**Terminal > New Terminal** or ``Ctrl+` ``):

### Step A: Create the Virtual Environment
```bash
# Windows (PowerShell or Command Prompt):
python -m venv .venv

# macOS / Linux:
python3 -m venv .venv
```

### Step B: Activate the Virtual Environment
```bash
# Windows PowerShell:
.venv\Scripts\Activate.ps1

# Windows Command Prompt (cmd):
.venv\Scripts\activate.bat

# macOS / Linux:
source .venv/bin/activate
```

> **Note for Windows PowerShell:** If you see an `execution of scripts is disabled` error, run:
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` and retry.

### Step C: Select Python Interpreter in VS Code
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open the Command Palette.
2. Type `Python: Select Interpreter` and press Enter.
3. Choose the `.venv` interpreter (`./.venv/Scripts/python.exe` or `./.venv/bin/python`).

### Step D: Install Python Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```
*(If you have an NVIDIA GPU, install PyTorch with CUDA support first from [pytorch.org](https://pytorch.org)).*

---

## 4. Frontend Setup (Node.js)

In the same or a second integrated terminal:

```bash
cd frontend
npm install
npm run build
cd ..
```

---

## 5. Running the Project (Choose One Method)

### Method 1: Single-Port Production Mode (Recommended)
This runs the FastAPI backend and automatically serves the pre-built React dashboard on port 8000:

```bash
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
Open **`http://localhost:8000`** in your browser.

---

### Method 2: Dual Development Mode (Live Hot Reloading)
Open two terminal tabs in VS Code:

- **Terminal 1 (Backend):**
  ```bash
  uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
  ```
- **Terminal 2 (Frontend Dev Server):**
  ```bash
  cd frontend
  npm run dev
  ```
Open **`http://localhost:5173`** in your browser (Vite automatically proxies `/api` calls to port 8000).

---

### Method 3: 1-Click VS Code Debugger (F5)
1. Open the **Run & Debug** panel on the left sidebar (`Ctrl+Shift+D` or `Cmd+Shift+D`).
2. In the dropdown at the top, select **"FastAPI: Run Workstation Server"**.
3. Press **F5** (or click the green Play button).
4. The backend starts with live debugging enabled. Open `http://localhost:8000` in your browser.

---

## 6. Running Verification Tests in VS Code

You can run all automated tests right from the VS Code terminal:

```bash
# 1. Auxiliary extraction equivalence test
python tests/test_aux_equivalence.py

# 2. End-to-end repository plumbing test
python tests/smoke_test.py

# 3. Backend test suite (Auth, User isolation, Direct assessment, PDF report, SPA fallback)
python -m pytest backend/tests -v

# 4. Frontend TypeScript build check
cd frontend && npm run build
```

---

## 7. Troubleshooting in VS Code

- **ModuleNotFoundError: No module named 'osga'**:
  Make sure you opened the `osga_net` folder as the workspace root (not the parent `OSGA-Net_Code_v2`). The `.vscode/settings.json` file adds `${workspaceFolder}` and `${workspaceFolder}/backend` to the Python path.
- **Port 8000 or 5173 in use**:
  Run `Get-NetTCPConnection -LocalPort 8000` (Windows PowerShell) or `lsof -i :8000` (macOS/Linux) to find and stop any running instance.
- **Sample Radiograph**:
  Click **"Load sample pediatric radiograph"** in the web dashboard to instantly test bone age assessment without needing to find a local X-ray file.
