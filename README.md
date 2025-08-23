# EcoSense.ai

Environmental intelligence platform for community pollution monitoring.

## Overview

EcoSense.ai combines real-time environmental data with AI-powered image analysis to provide communities with actionable insights about local pollution levels. The platform helps users monitor air, water, and noise pollution while offering personalized recommendations for environmental action.

## Features

- Real-time environmental data collection from multiple sources
- AI-powered image analysis for pollution detection
- Community engagement and gamification
- Interactive dashboard with pollution heatmaps
- Mobile-first experience with push notifications
- Conversational AI interface for natural language queries

## Tech Stack

- **Backend**: Node.js, TypeScript, Express.js
- **Database**: PostgreSQL with PostGIS extension
- **Cache**: Redis
- **Message Queue**: RabbitMQ
- **AI/ML**: Python with TensorFlow/PyTorch
- **Frontend**: React with TypeScript
- **Mobile**: React Native
- **Deployment**: Docker, Kubernetes

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- PostgreSQL with PostGIS (if running locally)
- Redis (if running locally)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ecosense-ai
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment configuration:
```bash
cp .env.example .env
```

4. Start the development environment with Docker:
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

5. Run database migrations:
```bash
npm run migrate
```

6. Start the backend development server:
```bash
npm run dev
```

7. Start the frontend dashboard (in a new terminal):
```bash
cd frontend
npm install
npm run dev
```

The backend API will be available at `http://localhost:8000` and the frontend dashboard at `http://localhost:3000`.

### Development Services

- **Frontend Dashboard**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Database Admin (Adminer)**: http://localhost:8080
- **RabbitMQ Management**: http://localhost:15672
- **MailHog (Email testing)**: http://localhost:8025

## Project Structure

```
src/                 # Backend source code
├── config/          # Configuration files
├── middleware/      # Express middleware
├── models/          # Data models and types
├── routes/          # API route handlers
├── services/        # Business logic services
├── utils/           # Utility functions
└── test/            # Test setup and utilities

frontend/            # Frontend React dashboard
├── src/
│   ├── components/  # React components
│   ├── pages/       # Page components
│   ├── services/    # API services
│   └── types/       # TypeScript types
├── public/          # Static assets
└── package.json     # Frontend dependencies

database/
├── init.sql         # Database initialization
└── migrations/      # Database migration files
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

## Environment Variables

See `.env.example` for all available configuration options.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

This project is licensed under the MIT License.