# Godspeed Operations Portal

A full-stack application built with React and Express, using Supabase for authentication and database operations.

## 🚀 Project Overview

The Godspeed Operations Portal is a modern web application designed to streamline operational workflows. It features a React-based client application with TypeScript support and an Express backend server.

## 📋 Project Structure

```
godspeed-ops-portal/
├── client/               # Frontend React application
│   ├── public/           # Static assets
│   ├── src/              # Source code
│   │   ├── assets/       # Images, fonts, etc.
│   │   ├── components/   # Reusable UI components
│   │   ├── contexts/     # React context providers
│   │   ├── lib/          # Utility functions and helpers
│   │   ├── pages/        # Page components
│   │   ├── services/     # API service integrations
│   │   └── styles/       # CSS and styling files
│   ├── index.html        # Main HTML entry point
│   └── package.json      # Frontend dependencies
│
├── server/               # Backend Express server
│   ├── src/              # Source code
│   │   ├── middleware/   # Express middlewares
│   │   ├── routes/       # API route definitions
│   │   └── index.ts      # Server entry point
│   └── package.json      # Backend dependencies
│
└── README.md             # Project documentation (this file)
```

## 🛠️ Technologies Used

### Frontend
- React 18
- TypeScript
- Vite
- React Router DOM
- React Hook Form
- Supabase Client
- Axios

### Backend
- Node.js
- Express
- TypeScript
- Supabase Server SDK
- CORS

## 🔧 Getting Started

### Prerequisites
- Node.js (v24.21.0 or `>=24.21.0 <25.0.0`, see `.nvmrc`)
- pnpm (v10.28.2 or `>=10.28.2 <11.0.0`)
- Supabase account and project

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/godspeed-ops-portal.git
   cd godspeed-ops-portal
   ```

2. Set up the client:
   ```bash
   cd client
   cp .env.example .env  # Update with your environment variables
   pnpm install
   ```

3. Set up the server:
   ```bash
   cd ../server
   cp .env.example .env  # Update with your environment variables
   pnpm install
   ```

### Running the Application

1. Start the backend server:
   ```bash
   cd server
   pnpm dev
   ```

2. Start the frontend client:
   ```bash
   cd client
   pnpm dev
   ```

The client application will be available at http://localhost:5173, and the server will run on http://localhost:3000.

## 📝 Environment Variables

### Client (.env)
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### Server (.env)
- `PORT` - Server port (default: 3000)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Your Supabase service role key

## 📄 License

This project is licensed under the ISC License.