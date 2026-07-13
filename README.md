# GoalPilot AI

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![TypeScript](https://img.shields.io/badge/typescript-5.0-blue)

**Autonomous Goal Engineering System**

A full-stack multi-agent AI platform that systematically orchestrates and guides user progression toward complex goals through intelligent curriculum roadmaps.

[Features](#-features) • [Installation](#-installation) • [Architecture](#-architecture) • [Documentation](#-documentation)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Screenshots](#-screenshots)
- [Technologies](#-technologies)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Overview](#-api-overview)
- [Benchmarking](#-benchmarking)
- [Docker](#-docker)
- [Contributing](#-contributing)
- [License](#-license)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Overview

GoalPilot AI is a sophisticated autonomous agent system that breaks down ambitious goals into structured, actionable learning paths. Powered by 11 specialized AI agents working in coordination, it provides:

- **Intelligent Goal Decomposition** - Breaks complex goals into hierarchical sub-goals
- **Adaptive Roadmap Generation** - Creates personalized curriculum with dependency tracking
- **Real-time Progress Monitoring** - Predicts success probability and burnout risk
- **Context-Aware Coaching** - Provides personalized guidance based on learning style
- **Dynamic Replanning** - Automatically adjusts plans based on progress and feedback

---

## ✨ Features

### Core Capabilities

- **🤖 Multi-Agent Architecture** - 11 specialized AI agents working in coordination
- **🎯 Goal Analysis** - Intelligent decomposition of complex goals into manageable sub-goals
- **📊 Predictive Analytics** - Success probability, burnout risk, and consistency metrics
- **🧠 Memory System** - Long-term semantic memory for context retention across sessions
- **🔄 Dynamic Replanning** - Automatic roadmap adaptation based on progress
- **💬 AI Coaching** - Personalized guidance with context-aware responses
- **📈 Progress Tracking** - Real-time dashboard with visual metrics

### LLM Provider Support

- **🦙 Ollama (Local Models)**
  - DeepSeek-R1
  - Qwen2.5
  - Llama3.2
  - Any Ollama-compatible model

- **🔮 Google Gemini (Cloud)**
  - Gemini 3.1 Flash Lite
  - Other Gemini models

### Developer Experience

- **⚡ Quick Setup** - Automated scripts for local deployment
- **🐳 Docker Support** - Containerized deployment
- **📊 Benchmarking Tools** - Built-in model performance comparison
- **🔧 Modular Architecture** - Easy to extend and customize
- **🔀 Separated Frontend/Backend** - Clean architecture for maintainability

---

## 📸 Screenshots

> [!NOTE]
> Screenshots will be added in future updates. The application features:
> 
> - Autonomous Log Terminal with real-time agent reasoning
> - Context-Aware Coaching Terminal
> - Dynamic Curriculum Roadmap with interactive checkboxes
> - Predictive Metric Dashboards
> - Interactive Command Palette (Ctrl+K)

---

## 🛠 Technologies

### Frontend
- **React 19** - UI framework
- **TypeScript 5** - Type-safe development
- **Vite** - Build tool and dev server
- **TailwindCSS** - Styling (Glassmorphic dark theme)
- **Motion** - Animation library

### Backend
- **Node.js 18+** - Runtime environment
- **Express** - Web server
- **TypeScript** - Type-safe backend
- **tsx** - TypeScript execution
- **CORS** - Cross-origin resource sharing

### AI/ML
- **Ollama** - Local LLM inference
- **Google Gemini** - Cloud LLM API
- **Custom Agent Framework** - Multi-agent orchestration

### Development
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **GitHub Actions** - CI/CD pipeline

---

## 🏗 Project Structure

```
goalpilot-ai/
├── frontend/              # Frontend React application
│   ├── src/              # React components and logic
│   │   ├── components/   # UI components
│   │   ├── lib/          # Utilities and API client
│   │   └── types/        # TypeScript types
│   ├── index.html        # HTML entry point
│   ├── vite.config.ts    # Vite configuration
│   ├── package.json      # Frontend dependencies
│   └── .env.example      # Frontend environment template
├── backend/              # Backend server and AI agents
│   ├── server/           # Server modules
│   │   ├── agent-intelligence.ts  # Agent logic
│   │   ├── agent-memory.ts         # Memory management
│   │   ├── orchestrator.ts         # Agent coordination
│   │   ├── llm-service.ts          # LLM abstraction
│   │   ├── gemini-provider.ts      # Gemini implementation
│   │   ├── auth.ts                 # Authentication
│   │   ├── db.ts                   # Database layer
│   │   └── product-service.ts      # Goal/plan service
│   ├── server.ts         # Main server entry point
│   ├── load-env.ts       # Environment loader
│   ├── db.json           # JSON database
│   ├── package.json      # Backend dependencies
│   └── .env.example      # Backend environment template
├── benchmarks/           # Performance benchmarking tools
├── scripts/              # Setup and startup scripts
├── docs/                 # Documentation
├── tests/                # Test files
├── .github/              # GitHub configuration
│   ├── workflows/        # CI/CD workflows
│   └── ISSUE_TEMPLATE/   # Issue templates
├── .env.example          # Root environment template (deprecated)
├── .gitignore            # Git ignore rules
├── docker-compose.yml    # Docker configuration
├── Dockerfile            # Docker image configuration
├── package.json          # Root package with workspace scripts
├── start.bat             # Windows startup script
├── start.sh              # Linux/Mac startup script
├── CONTRIBUTING.md       # Contribution guidelines
├── LICENSE               # MIT License
└── README.md             # This file
```

---

## � Installation

### Prerequisites

- **Node.js** 18 or higher
- **npm** or **yarn** package manager
- **Ollama** (for local models) or **Gemini API key** (for cloud models)

### Quick Start

#### Option 1: Using Root Scripts (Recommended)

**Windows:**
```bash
# Install all dependencies
npm run install:all

# Start both frontend and backend
start.bat
```

**Linux/Mac:**
```bash
# Install all dependencies
npm run install:all

# Start both frontend and backend
chmod +x start.sh
./start.sh
```

#### Option 2: Manual Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/goalpilot-ai.git
cd goalpilot-ai
```

2. **Install dependencies**
```bash
# Root dependencies
npm install

# Frontend dependencies
cd frontend
npm install

# Backend dependencies
cd ../backend
npm install
```

3. **Configure environment**

**Frontend:**
```bash
cd frontend
cp .env.example .env
# Edit .env with your backend URL (default: http://localhost:3000)
```

**Backend:**
```bash
cd backend
cp .env.example .env
# Edit .env with your LLM provider configuration
```

4. **Start the application**

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000

#### Option 3: Using npm scripts from root

```bash
# Start backend only
npm run backend

# Start frontend only
npm run frontend

# Start both simultaneously
npm run dev
```

---

## ⚙️ Configuration

### Backend Environment Variables

Create `backend/.env` from `backend/.env.example`:

```bash
# ─── LLM Provider Configuration ────────────────────────────────────────
# Choose between: ollama or gemini
LLM_PROVIDER=ollama

# ─── Ollama Configuration (for LLM_PROVIDER=ollama) ───────────────────
OLLAMA_ENDPOINT=http://localhost:11434
LLM_MODEL=deepseek-r1:8b

# ─── Gemini Configuration (for LLM_PROVIDER=gemini) ───────────────────
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3.1-flash-lite

# ─── Application Configuration ─────────────────────────────────────────
APP_URL="http://localhost:3000"
PORT=3000
JWT_SECRET="replace-with-a-long-random-secret"
NODE_ENV=development

# ─── CORS Configuration ───────────────────────────────────────────────
FRONTEND_URL=http://localhost:5173
```

### Frontend Environment Variables

Create `frontend/.env` from `frontend/.env.example`:

```bash
# Backend API URL
VITE_API_URL=http://localhost:3000

# Application URL
VITE_APP_URL=http://localhost:5173
```

### Ollama Setup

1. **Install Ollama** from [https://ollama.ai/download](https://ollama.ai/download)

2. **Pull models**:
```bash
ollama pull deepseek-r1:8b
ollama pull qwen2.5:7b
```

3. **Start Ollama server**:
```bash
ollama serve
```

### Switching Models

To switch between models, update `LLM_MODEL` in `backend/.env` and restart the backend:

```bash
# DeepSeek
LLM_MODEL=deepseek-r1:8b

# Qwen
LLM_MODEL=qwen2.5:7b

# Llama
LLM_MODEL=llama3.2:3b
```

---

## 📖 Usage

### Creating a Goal

1. Open the application at `http://localhost:5173`
2. Sign up or log in
3. Enter your goal (e.g., "I want to become a Data Scientist in 6 months")
4. Click "Initialize Goal"
5. Watch as agents analyze and create your personalized roadmap

### Interacting with the AI Coach

- Use the chat interface to ask questions about your learning path
- The AI coach remembers context across sessions
- Request adjustments to your roadmap based on progress

### Tracking Progress

- Complete tasks by clicking checkboxes
- View real-time metrics in the dashboard
- Monitor agent reasoning in the log terminal

---

## 🔌 API Overview

### Main Endpoints

- `POST /api/auth/signup` - Create a new account
- `POST /api/auth/login` - Login to existing account
- `GET /api/auth/me` - Get current user
- `GET /api/dashboard` - Get user dashboard
- `GET /api/state` - Get current application state
- `GET /api/goals/active` - Get active goal
- `POST /api/goals` - Create a new goal
- `GET /api/milestones` - Get milestones and tasks
- `POST /api/tasks/:taskId/complete` - Complete a task
- `POST /api/tasks/:taskId/skip` - Skip a task
- `POST /api/tasks/:taskId/reschedule` - Reschedule a task
- `POST /api/tasks/:taskId/notes` - Add progress note
- `POST /api/check-ins` - Submit daily check-in
- `POST /api/availability` - Update availability
- `POST /api/goals/status` - Set goal status
- `POST /api/goals/replan` - Replan goal
- `POST /api/chat` - Send chat message to AI coach
- `GET /api/today` - Get today's focus
- `POST /api/clear` - Clear active goal

---

## 📊 Benchmarking

Compare model performance using the built-in benchmark tool:

```bash
cd benchmarks
npx tsx benchmark.ts
```

This will:
- Test both DeepSeek and Qwen models
- Measure response time, memory usage, and CPU utilization
- Evaluate quality across goal analysis, planning, and reasoning
- Generate a markdown comparison report (`PERFORMANCE_REPORT.md`)

### Benchmark Metrics

- **Response Latency** - Time to generate responses
- **Tokens Generated** - Output token count
- **Memory Usage** - RAM consumption
- **CPU Utilization** - Processor usage
- **Goal Analysis Quality** - Structured goal breakdown
- **Planning Quality** - Roadmap coherence
- **Task Generation** - Actionable task quality
- **Context Retention** - Memory awareness
- **Reasoning Quality** - Chain-of-thought depth
- **Overall Score** - Composite quality rating

---

## 🐳 Docker

### Using Docker Compose

```bash
docker-compose up
```

This will:
- Build the application
- Start the backend server
- Configure Ollama (if using local models)
- Launch the frontend

### Manual Docker Build

```bash
# Build image
docker build -t goalpilot-ai .

# Run container
docker run -p 3000:3000 --env-file backend/.env goalpilot-ai
```

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🔧 Troubleshooting

### Common Issues

**Backend won't start**
- Ensure backend dependencies are installed: `cd backend && npm install`
- Check backend/.env is configured correctly
- Verify port 3000 is not in use

**Frontend won't start**
- Ensure frontend dependencies are installed: `cd frontend && npm install`
- Check frontend/.env is configured with correct backend URL
- Verify port 5173 is not in use

**CORS errors**
- Ensure FRONTEND_URL in backend/.env matches your frontend URL
- Check that backend is running before starting frontend

**Ollama connection refused**
- Ensure Ollama server is running: `ollama serve`
- Check endpoint in `backend/.env`: `OLLAMA_ENDPOINT=http://localhost:11434`

**Model not found**
- Pull the model: `ollama pull deepseek-r1:8b`
- Check model name in `backend/.env`

**API calls failing**
- Verify backend is running on http://localhost:3000
- Check VITE_API_URL in frontend/.env
- Check browser console for specific error messages

## Production deployment

Deploy GoalPilot as two services: the React site on Netlify and the Express API on a Node.js host with persistent disk.

1. Deploy the backend with Node.js 20+. Build with `npm ci && npm run build:backend` and start with `node backend/dist/server.cjs`.
2. Set backend variables: `NODE_ENV=production`, a long random `JWT_SECRET`, `FRONTEND_URL=https://your-site.netlify.app`, `DB_FILE=/persistent-volume/db.json`, and either Ollama (`LLM_PROVIDER=ollama`, `OLLAMA_ENDPOINT`) or Gemini (`LLM_PROVIDER=gemini`, `GEMINI_API_KEY`).
3. Attach durable storage at `DB_FILE`. The JSON database is stateful; an ephemeral filesystem or uncoordinated multiple API replicas will lose or corrupt data.
4. Import the repository in Netlify. `netlify.toml` builds `frontend/` and publishes `frontend/dist`. Set `VITE_API_URL=https://your-api.example.com` before production builds; redeploy whenever it changes.
5. Add every Netlify domain that can call the API to `FRONTEND_URL`, then confirm `GET /api/health` reports `status: ok`.

### Ollama in production

Ollama must run on the backend's private network or on a secured reachable host. `OLLAMA_ENDPOINT=http://localhost:11434` only works when Ollama shares the API machine/network namespace. Pre-pull `deepseek-r1:8b` and `qwen2.5:3b`. Local models require a persistent Node/container host with sufficient RAM and request duration; typical serverless limits are not appropriate.

### Getting Help

- Open an issue on GitHub
- Check existing issues for solutions
- Review documentation in `/docs`

---

## 🚧 Future Scope

- [ ] Web UI for model selection
- [ ] Additional LLM provider integrations (Claude, GPT)
- [ ] Mobile application
- [ ] Collaborative goal tracking
- [ ] Advanced analytics dashboard
- [ ] Integration with learning platforms
- [ ] Export roadmaps to various formats
- [ ] Multi-language support

---

<div align="center">

**Built with ❤️ by the GoalPilot AI Team**

[⬆ Back to Top](#goalpilot-ai)

</div>
