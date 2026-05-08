from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, EmailStr
from pymongo import MongoClient
import shutil
import os
import json
import cohere

# ───────── APP ─────────
app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ───────── DATABASE ─────────
client = MongoClient("mongodb://localhost:27017/")
db = client["mydb"]
users_collection = db["users"]
analysis_collection = db["analyses"]

# ───────── SECURITY ─────────
SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# ───────── COHERE ─────────
# Set your key: set COHERE_API_KEY=your-key-here (in terminal before uvicorn)
# Or replace the default below with your actual key for development
COHERE_API_KEY = os.environ.get("COHERE_API_KEY", "you key")
co = cohere.Client(COHERE_API_KEY)

def hash_pw(pw):
    return pwd_ctx.hash(pw)

def verify_pw(p, h):
    return pwd_ctx.verify(p, h)

def create_token(email: str, expires_delta: timedelta = timedelta(hours=2)):
    expire = datetime.now(timezone.utc) + expires_delta
    return jwt.encode({"sub": email, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user = users_collection.find_one({"email": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

# ───────── MODELS ─────────
class Register(BaseModel):
    name: str
    email: EmailStr
    password: str

class ForgotPassword(BaseModel):
    email: EmailStr

class ResetPassword(BaseModel):
    token: str
    password: str

class RoadmapRequest(BaseModel):
    missing_skills: list[str]
    score: int
    filename: str

# ───────── ROUTES ─────────

@app.get("/")
def home():
    return {"message": "Backend running 🚀"}

# ✅ SIGNUP
@app.post("/register")
def register(data: Register):
    if users_collection.find_one({"email": data.email}):
        raise HTTPException(status_code=400, detail="User already exists")
    users_collection.insert_one({
        "name": data.name,
        "email": data.email,
        "password": hash_pw(data.password)
    })
    return {"message": "User registered successfully"}

# ✅ LOGIN
@app.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    user = users_collection.find_one({"email": form.username})
    if not user or not verify_pw(form.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user["email"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "name": user["name"],
        "email": user["email"]
    }

# ✅ FORGOT PASSWORD
@app.post("/forgot-password")
def forgot_password(data: ForgotPassword):
    user = users_collection.find_one({"email": data.email})
    if not user:
        return {"message": "If that email exists, a reset link has been sent."}
    reset_token = create_token(data.email, expires_delta=timedelta(hours=1))
    # TODO: Send reset_token via email (SendGrid / SMTP)
    return {"message": "Reset link sent!", "reset_token": reset_token}

# ✅ RESET PASSWORD
@app.post("/reset-password")
def reset_password(data: ResetPassword):
    try:
        payload = jwt.decode(data.token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload["sub"]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    users_collection.update_one(
        {"email": email},
        {"$set": {"password": hash_pw(data.password)}}
    )
    return {"message": "Password updated successfully"}

# ✅ VERIFY EMAIL
@app.get("/verify-email")
def verify_email(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload["sub"]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    users_collection.update_one({"email": email}, {"$set": {"verified": True}})
    return {"message": "Email verified successfully"}

# ✅ GOOGLE AUTH
@app.post("/auth/google")
def google_auth(payload: dict):
    credential = payload.get("credential")
    if not credential:
        raise HTTPException(status_code=400, detail="Missing Google credential")
    raise HTTPException(status_code=501, detail="Google auth not fully configured")

# ───────── RESUME ANALYSIS HELPERS ─────────

TECH_SKILLS = [
    "python", "java", "javascript", "typescript", "c++", "c#", "go", "rust", "kotlin", "swift",
    "react", "angular", "vue", "node.js", "nodejs", "express", "django", "flask", "fastapi",
    "spring", "html", "css", "sql", "mysql", "postgresql", "mongodb", "redis", "firebase",
    "aws", "azure", "gcp", "docker", "kubernetes", "git", "linux", "bash", "rest", "graphql",
    "machine learning", "deep learning", "tensorflow", "pytorch", "pandas", "numpy", "scikit",
    "data analysis", "power bi", "tableau", "excel", "spark", "hadoop", "kafka",
]

IMPORTANT_SECTIONS = ["experience", "education", "skills", "projects", "summary", "objective",
                       "certifications", "achievements", "contact", "profile"]

FILLER_PHRASES = ["responsible for", "worked on", "helped with", "assisted in", "was involved in",
                   "duties included", "tasked with"]

def extract_text_from_pdf(path: str) -> str:
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(path)
        return "\n".join(page.get_text() for page in doc).lower()
    except Exception:
        return ""

def extract_text_from_docx(path: str) -> str:
    try:
        from docx import Document
        doc = Document(path)
        return "\n".join(p.text for p in doc.paragraphs).lower()
    except Exception:
        return ""

def analyze_resume(file_path: str, filename: str) -> dict:
    # Extract text
    ext = filename.lower().split(".")[-1]
    if ext == "pdf":
        text = extract_text_from_pdf(file_path)
    elif ext in ("docx", "doc"):
        text = extract_text_from_docx(file_path)
    else:
        text = ""

    if not text.strip():
        return {
            "score": 30,
            "message": "Could not extract text from resume. Make sure it's not a scanned image.",
            "missing_skills": ["Unable to parse file"],
            "grammar_issues": ["File could not be read"],
            "format_issues": ["Use a text-based PDF or DOCX"]
        }

    score = 0
    missing_skills = []
    grammar_issues = []
    format_issues = []
    words = text.split()
    word_count = len(words)

    # ── 1. Sections present (25 pts) ──
    sections_found = [s for s in IMPORTANT_SECTIONS if s in text]
    section_score = min(25, len(sections_found) * 4)
    score += section_score
    if "skills" not in sections_found:
        format_issues.append("No 'Skills' section found — ATS scanners rely on this")
    if "experience" not in sections_found and "projects" not in sections_found:
        format_issues.append("No 'Experience' or 'Projects' section found")
    if "education" not in sections_found:
        format_issues.append("No 'Education' section found")
    if "summary" not in sections_found and "objective" not in sections_found:
        format_issues.append("Consider adding a Summary or Objective section")

    # ── 2. Skills detected (30 pts) ──
    found_skills = [s for s in TECH_SKILLS if s in text]
    skill_score = min(30, len(found_skills) * 3)
    score += skill_score
    # Find missing common skills
    common = ["python", "sql", "git", "javascript", "react", "aws", "docker", "excel"]
    missing_skills = [s.title() for s in common if s not in text][:5]

    # ── 3. Resume length (15 pts) ──
    if word_count < 100:
        format_issues.append("Resume is too short — add more details")
        score += 3
    elif word_count < 250:
        format_issues.append("Resume is brief — consider expanding experience/projects")
        score += 8
    elif word_count <= 800:
        score += 15  # ideal length
    elif word_count <= 1200:
        score += 10
    else:
        format_issues.append("Resume may be too long — keep it to 1-2 pages")
        score += 7

    # ── 4. Contact info (10 pts) ──
    contact_score = 0
    if "@" in text: contact_score += 4       # email present
    if any(c.isdigit() for c in text): contact_score += 3  # phone number likely
    if "linkedin" in text or "github" in text: contact_score += 3
    else: format_issues.append("Add LinkedIn or GitHub profile link")
    score += contact_score

    # ── 5. Action verbs / impact (10 pts) ──
    action_verbs = ["developed", "built", "designed", "implemented", "led", "managed",
                    "improved", "increased", "reduced", "created", "launched", "optimized",
                    "architected", "delivered", "achieved", "automated", "deployed"]
    verbs_found = [v for v in action_verbs if v in text]
    verb_score = min(10, len(verbs_found) * 2)
    score += verb_score
    if len(verbs_found) < 3:
        grammar_issues.append("Use more action verbs (e.g. 'Built', 'Led', 'Improved')")

    # ── 6. Filler phrase penalty (−10 pts max) ──
    filler_found = [f for f in FILLER_PHRASES if f in text]
    penalty = min(10, len(filler_found) * 3)
    score -= penalty
    if filler_found:
        grammar_issues.append(f"Avoid weak phrases like: {', '.join(filler_found[:2])}")

    # ── 7. Quantified achievements (10 pts) ──
    import re
    numbers = re.findall(r'\b\d+[%x]?\b', text)
    quant_score = min(10, len(numbers) * 1)
    score += quant_score
    if len(numbers) < 3:
        grammar_issues.append("Add quantified achievements (e.g. 'Improved speed by 40%')")

    # Final clamp and message
    score = max(10, min(100, score))
    if score >= 85:
        message = "Excellent resume! 🌟 Strong ATS compatibility."
    elif score >= 70:
        message = "Good resume 👍 A few improvements will make it great."
    elif score >= 55:
        message = "Average resume ⚠️ Needs notable improvements."
    elif score >= 40:
        message = "Weak resume 😟 Significant improvements needed."
    else:
        message = "Poor ATS compatibility ❌ Major revision required."

    return {
        "score": score,
        "message": message,
        "missing_skills": missing_skills,
        "grammar_issues": grammar_issues[:4],
        "format_issues": format_issues[:4],
    }

# ✅ ANALYZE RESUME
@app.post("/analyze")
def analyze(file: UploadFile = File(...), user=Depends(get_current_user)):
    os.makedirs("uploads", exist_ok=True)
    file_path = f"uploads/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = analyze_resume(file_path, file.filename)

    analysis_collection.insert_one({
        "email": user["email"],
        "filename": file.filename,
        "score": result["score"],
        "message": result["message"],
        "analyzed_at": datetime.now(timezone.utc)
    })
    return result

# ✅ CAREER ROADMAP — powered by Cohere AI
@app.post("/roadmap")
def get_roadmap(data: RoadmapRequest, user=Depends(get_current_user)):
    missing = ", ".join(data.missing_skills) if data.missing_skills else "none identified"

    prompt = f"""You are a career advisor AI. A user uploaded their resume and received an ATS score of {data.score}/100.
Resume filename: {data.filename}
Missing skills: {missing}

Respond ONLY with a valid JSON object in exactly this structure (no markdown, no explanation):
{{
  "suggested_careers": [
    {{"title": "Career Title", "match": "85%", "reason": "Why this fits the candidate"}}
  ],
  "top_career": "Single best matching career title",
  "skill_gaps": [
    {{"skill": "Skill Name", "priority": "High", "why": "Why this skill matters for the career"}}
  ],
  "learning_roadmap": [
    {{"step": 1, "title": "Step Title", "duration": "2 weeks", "description": "What to learn or do in this step"}}
  ],
  "recommended_resources": [
    {{"name": "Resource Name", "type": "Course", "url": "https://example.com", "free": true}}
  ]
}}"""

    try:
        response = co.chat(
            model="command-a-03-2025",
            message=prompt,
            temperature=0.4,
        )
        raw = response.text.strip()

        # Strip markdown code fences if Cohere wraps response in them
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else raw
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        roadmap_data = json.loads(raw)
        return roadmap_data

    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Cohere returned invalid JSON. Try again.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cohere API error: {str(e)}")

# ✅ GET HISTORY
@app.get("/analyses")
def get_history(user=Depends(get_current_user)):
    data = list(
        analysis_collection.find(
            {"email": user["email"]},
            {"_id": 0}
        ).sort("analyzed_at", -1).limit(20)
    )
    return {"analyses": data}

# ✅ DELETE ACCOUNT
@app.delete("/me")
def delete_account(user=Depends(get_current_user)):
    users_collection.delete_one({"email": user["email"]})
    analysis_collection.delete_many({"email": user["email"]})
    return {"message": "Account deleted"}
