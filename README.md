
# NoteFlow – Notes Sharing System

![Build](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Stack](https://img.shields.io/badge/stack-MERN-blueviolet)

NoteFlow is a modern MERN stack notes sharing platform for students.

# noteflow

## Environment Variables on Vercel

For production, set all environment variables (Supabase keys, JWT secret, etc.) in the Vercel dashboard for both frontend and backend. Do not rely on .env files in production.

## ✨ Features

- User registration & login (bcrypt + JWT)
- Browse, search, and filter notes
- Secure note upload & download (with tracking)
- PDF/image preview
- User profile: uploads & downloads
- Responsive UI (Tailwind CSS)
- Automated backend & frontend tests

## 🗂️ Project Structure

- backend/ – Express API, MongoDB, Supabase integration
- frontend/ – React (Vite), Tailwind, API calls
- uploads/ – Uploaded files

## 🚀 Quick Start

### 1. Backend Setup

1. Set all environment variables in the Vercel dashboard for production.
2. Install dependencies:
	```sh
	cd backend
	npm install
	```
3. Start the server:
	```sh
	npm run dev
	```
	Runs at http://localhost:5000

### 2. Frontend Setup

1. Set all environment variables in the Vercel dashboard for production.
2. Install dependencies:
	```sh
	cd frontend
	npm install
	```
3. Start the dev server:
	```sh
	npm run dev
	```
	Runs at http://localhost:5173

## 🧪 Running Tests

### Backend
```sh
cd backend
npx jest --config jest.config.js --runInBand
```

### Frontend
```sh
cd frontend
npx jest
```

## 📚 API Endpoints

- `POST /api/auth/register` – Register
- `POST /api/auth/login` – Login
- `GET /api/notes` – List/search notes
- `GET /api/notes/:id` – Note details
- `POST /api/notes` – Upload (protected)
- `GET /api/notes/:id/download` – Download (protected)
- `GET /api/me` – Profile (protected)

## 🤝 Contributing

1. Fork this repo
2. Create a feature branch
3. Commit and push
4. Open a pull request

## 📄 License

MIT
