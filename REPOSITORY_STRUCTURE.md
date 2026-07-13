# GoalPilot AI - Repository Structure

## Overview

This document provides a comprehensive overview of the GoalPilot AI repository structure, organization, and key files.

## Directory Structure

```
goalpilot-ai/
├── .github/                    # GitHub configuration
│   ├── workflows/             # CI/CD workflows
│   │   └── ci.yml            # GitHub Actions pipeline
│   ├── ISSUE_TEMPLATE/        # Issue templates
│   │   ├── bug_report.md     # Bug report template
│   │   └── feature_request.md # Feature request template
│   └── pull_request_template.md # PR template
├── benchmarks/                # Performance benchmarking tools
│   └── benchmark.ts          # Model comparison benchmark
├── docs/                      # Documentation
├── scripts/                   # Setup and startup scripts
│   ├── setup.bat             # Windows setup script
│   ├── setup.sh              # Linux/Mac setup script
│   ├── start.bat             # Windows startup script
│   ├── start.sh              # Linux/Mac startup script
│   ├── setup-ollama.bat      # Windows Ollama setup
│   └── setup-ollama.sh       # Linux/Mac Ollama setup
├── server/                    # Backend server and AI agents
│   ├── agent-intelligence.ts # Agent logic (11 agents)
│   ├── agent-memory.ts        # Memory management
│   ├── orchestrator.ts        # Agent coordination
│   ├── llm-service.ts         # LLM abstraction layer
│   ├── gemini-provider.ts     # Gemini LLM implementation
│   ├── gemini.ts              # Gemini adapter (backward compat)
│   ├── auth.ts                # Authentication
│   ├── db.ts                  # Database layer
│   └── product-service.ts     # Product/goal service
├── src/                       # Frontend React application
│   ├── components/            # React components
│   ├── lib/                   # Utilities and API client
│   └── App.tsx                # Main application
├── tests/                     # Test files
├── assets/                    # Static assets
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
├── CONTRIBUTING.md           # Contribution guidelines
├── Dockerfile                # Docker configuration
├── docker-compose.yml        # Docker Compose configuration
├── LICENSE                   # MIT License
├── load-env.ts               # Environment loader
├── package.json              # Dependencies and scripts
├── README.md                 # Project documentation
├── server.ts                 # Main server entry point
├── tsconfig.json             # TypeScript configuration
└── vite.config.ts            # Vite build configuration
```

## Key Files Description

### Root Configuration Files

- **.env.example** - Template for environment variables (LLM provider, API keys, etc.)
- **.gitignore** - Git ignore patterns (excludes node_modules, .env, logs, etc.)
- **package.json** - Project dependencies and npm scripts
- **tsconfig.json** - TypeScript compiler configuration
- **vite.config.ts** - Vite build tool configuration
- **Dockerfile** - Docker image build configuration
- **docker-compose.yml** - Multi-container Docker setup
- **LICENSE** - MIT License
- **CONTRIBUTING.md** - Contribution guidelines
- **README.md** - Main project documentation

### Server Files

- **server.ts** - Express server entry point, serves both API and frontend
- **server/llm-service.ts** - Generic LLM service interface and factory
- **server/gemini-provider.ts** - Gemini API implementation of LLM service
- **server/gemini.ts** - Backward-compatible adapter for existing code
- **server/agent-intelligence.ts** - Core agent logic (11 specialized agents)
- **server/agent-memory.ts** - Memory management and context retention
- **server/orchestrator.ts** - Agent orchestration and coordination
- **server/auth.ts** - JWT authentication
- **server/db.ts** - JSON database layer
- **server/product-service.ts** - Goal and plan creation service

### Frontend Files

- **src/App.tsx** - Main React application component
- **src/components/** - React UI components
- **src/lib/api.ts** - API client for backend communication

### Scripts

- **scripts/setup.bat** - Windows automated setup (installs deps, creates .env)
- **scripts/setup.sh** - Linux/Mac automated setup
- **scripts/start.bat** - Windows application startup
- **scripts/start.sh** - Linux/Mac application startup
- **scripts/setup-ollama.bat** - Windows Ollama configuration
- **scripts/setup-ollama.sh** - Linux/Mac Ollama configuration

### Benchmarks

- **benchmarks/benchmark.ts** - Model performance comparison tool
  - Tests DeepSeek vs Qwen
  - Measures response time, memory, CPU
  - Evaluates quality metrics
  - Generates PERFORMANCE_REPORT.md

### GitHub Configuration

- **.github/workflows/ci.yml** - CI/CD pipeline
  - Runs on push/PR to main/develop
  - Tests multiple Node.js versions
  - Runs TypeScript compilation
  - Security audit
  - Docker build test
- **.github/ISSUE_TEMPLATE/bug_report.md** - Bug report template
- **.github/ISSUE_TEMPLATE/feature_request.md** - Feature request template
- **.github/pull_request_template.md** - PR template

## Environment Variables

Required environment variables (see .env.example):

```bash
# LLM Provider
LLM_PROVIDER=ollama  # or gemini

# Ollama Configuration
OLLAMA_ENDPOINT=http://localhost:11434
LLM_MODEL=deepseek-r1:8b

# Gemini Configuration
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-3.1-flash-lite

# Application
APP_URL=http://localhost:3000
PORT=3000
JWT_SECRET=your_secret
NODE_ENV=development
```

## NPM Scripts

Available npm scripts in package.json:

```json
{
  "dev": "tsx server.ts",
  "build": "vite build",
  "start": "NODE_ENV=production tsx server.ts",
  "test": "echo \"Tests not configured\"",
  "lint": "echo \"Linting not configured\""
}
```

## AI Agent Architecture

The system uses 11 specialized AI agents:

1. **GoalAnalysisAgent** - Deconstructs goals into sub-goals
2. **PlanningAgent** - Creates chronological roadmaps
3. **MemoryAgent** - Archives context and achievements
4. **ReasoningAgent** - Validates dependencies
5. **DecisionAgent** - Resolves next actions
6. **PredictionAgent** - Calculates metrics
7. **CoachAgent** - Provides guidance
8. **ResourceAgent** - Connects to resources
9. **ReflectionAgent** - Reviews milestones
10. **ReplanningAgent** - Adjusts schedules
11. **DashboardAgent** - Coordinates status

## LLM Integration

The project supports multiple LLM providers through a modular abstraction:

- **Ollama** (Local Models)
  - DeepSeek-R1
  - Qwen2.5
  - Llama3.2
  - Any Ollama-compatible model

- **Google Gemini** (Cloud)
  - Gemini 3.1 Flash Lite
  - Other Gemini models

Switching providers requires only changing the `LLM_PROVIDER` environment variable.

## Security Features

- Environment variables for all secrets
- Comprehensive .gitignore
- No hardcoded API keys
- JWT authentication
- Input validation
- Error handling

## Development Workflow

1. Clone repository
2. Run `scripts/setup.bat` (Windows) or `scripts/setup.sh` (Linux/Mac)
3. Configure `.env` file
4. Run `scripts/start.bat` or `scripts/start.sh`
5. Application available at http://localhost:3000

## Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up

# Build manually
docker build -t goalpilot-ai .
docker run -p 3000:3000 --env-file .env goalpilot-ai
```

## Testing

Run benchmarks to compare model performance:

```bash
npx tsx benchmarks/benchmark.ts
```

This generates `PERFORMANCE_REPORT.md` with detailed comparison.

## Modified Files for Ollama Integration

### New Files
- `server/llm-service.ts` - Generic LLM service interface
- `server/gemini-provider.ts` - Gemini provider implementation
- `benchmarks/benchmark.ts` - Model benchmarking tool
- `scripts/setup-ollama.bat` - Windows Ollama setup
- `scripts/setup-ollama.sh` - Linux/Mac Ollama setup
- `Dockerfile` - Docker configuration
- `docker-compose.yml` - Docker Compose setup
- `.github/workflows/ci.yml` - CI/CD pipeline
- `.github/ISSUE_TEMPLATE/` - Issue templates
- `.github/pull_request_template.md` - PR template
- `CONTRIBUTING.md` - Contribution guidelines
- `LICENSE` - MIT License

### Modified Files
- `server/gemini.ts` - Updated to delegate to llm-service
- `.env.example` - Added Ollama configuration
- `.gitignore` - Enhanced with comprehensive patterns
- `README.md` - Complete rewrite with professional documentation
- `scripts/setup.bat` - Updated for new structure
- `scripts/setup.sh` - Updated for new structure
- `scripts/start.bat` - Updated for new structure
- `scripts/start.sh` - Updated for new structure

### Unchanged Files
All agent modules remain unchanged:
- `server/agent-intelligence.ts`
- `server/agent-memory.ts`
- `server/orchestrator.ts`
- All frontend files
- All other server files

## Repository Statistics

- **Total Files**: ~50+
- **Lines of Code**: ~10,000+
- **Languages**: TypeScript, JavaScript, HTML, CSS, Bash, Batch
- **Dependencies**: ~50 npm packages
- **License**: MIT

## Maintenance Notes

- All secrets are in environment variables
- No hardcoded credentials in code
- Comprehensive error handling
- Modular architecture for easy extension
- Docker support for deployment
- CI/CD pipeline for automated testing
