# AtsresumecheckerCarrerGuidence
# ⚡ ATS Resume Checker

An AI-powered Resume Analyzer that scores your resume for ATS (Applicant Tracking System) compatibility and generates a personalized career roadmap using the Cohere AI API.

---

## 🚀 Features

- 📄 **Resume Upload** — Upload PDF or DOCX resumes
- 🎯 **ATS Score** — Get a score out of 100 with detailed feedback
- 🔧 **Skill Gap Analysis** — Identifies missing technical skills
- 🗺️ **AI Career Roadmap** — Powered by Cohere AI; suggests careers, skill gaps, and a step-by-step learning path
- 🔐 **Authentication** — Secure login/signup with JWT tokens used
- 🕒 **History** — View your last 20 resume analyses with score
- 🔑 **Password Reset** — Forgot password flow with token-based reset

---

## 🛠️ Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React.js, Axios                     |
| Backend   | FastAPI (Python)                    |
| Database  | MongoDB                             |
| AI        | Cohere API (`command-a-03-2025`)    |
| Auth      | JWT (python-jose), bcrypt (passlib) |
| File Parse| PyMuPDF, python-docx                |

---

## 📁 Project Structure

```
wt pro1/
├── backend/
│   ├── main.py              # FastAPI app — all routes and logic
│   ├── requirements.txt     # Python dependencies
│   └── uploads/             # Uploaded resume files (auto-created)
└── frontend/
    ├── public/
    └── src/
        ├── App.js           # Main React app
        ├── App.css          # Styles
        └── index.js         # Entry point
```

---

## ⚙️ Setup & Installation

### Prerequisites

- Python 3.10+
- Node.js 16+
- MongoDB (running locally on port `27017`)
- Cohere API Key — get one free at [cohere.com](https://cohere.com)

---

### 🔧 Backend Setup

```bash
# Navigate to backend folder
cd "wt pro1/backend"

# Install dependencies
pip install -r requirements.txt

# Set environment variables
set COHERE_API_KEY=your_cohere_api_key_here       # Windows
export COHERE_API_KEY=your_cohere_api_key_here    # Mac/Linux

# Start the server
uvicorn main:app --reload --port 8001
```

Backend runs at: `http://127.0.0.1:8001`

---

### 💻 Frontend Setup

```bash
# Navigate to frontend folder
cd "wt pro1/frontend"

# Install dependencies
npm install

# Start the app
npm start
```

Frontend runs at: `http://localhost:3000`

---

## 🔑 Environment Variables

| Variable         | Description                            | Default                    |
|-----------------|----------------------------------------|----------------------------|
| `COHERE_API_KEY` | Your Cohere API key                   | *(set this before running)* |
| `SECRET_KEY`     | JWT signing secret                    | `change-me-in-production`  |

> ⚠️ **Important:** Never commit your real API keys to GitHub. Use environment variables or a `.env` file.

---

## 📡 API Endpoints

| Method | Endpoint           | Description                        | Auth Required |
|--------|--------------------|------------------------------------|---------------|
| POST   | `/register`        | Create a new user account          | ❌            |
| POST   | `/login`           | Login and get JWT token            | ❌            |
| POST   | `/forgot-password` | Request password reset link        | ❌            |
| POST   | `/reset-password`  | Reset password using token         | ❌            |
| POST   | `/analyze`         | Upload and analyze a resume        | ✅            |
| POST   | `/roadmap`         | Generate AI career roadmap         | ✅            |
| GET    | `/analyses`        | Get user's resume analysis history | ✅            |
| DELETE | `/me`              | Delete user account                | ✅            |

---

## 📊 How ATS Scoring Works

The score (out of 100) is calculated based on:

| Criteria                  | Max Points |
|--------------------------|------------|
| Important sections found  | 25         |
| Technical skills detected | 30         |
| Resume length             | 15         |
| Contact info present      | 10         |
| Action verbs used         | 10         |
| Quantified achievements   | 10         |
| Filler phrase penalty     | −10        |

---



---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
