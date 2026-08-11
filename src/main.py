from fastapi import FastAPI, Depends, HTTPException, status ,UploadFile, File , Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from google.genai import types
import typing_extensions as typing
import sys
import io
import traceback
import json
import hashlib
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import jwt
from datetime import datetime, timedelta
import csv
import random
import string
import models
from database import engine, get_db
import os
from dotenv import load_dotenv
from google import genai

models.Base.metadata.create_all(bind=engine)
load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# 3. Safety check so the server crashes immediately if it can't find the key
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is missing!")

# 4. Initialize the client securely
client = genai.Client(api_key=GEMINI_API_KEY)
student_cache = {}

SECRET_KEY = "super_secret_key"
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "student"

class PasswordUpdate(BaseModel):
    username: str
    new_password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class StudentSubmission(BaseModel):
    current_topic: str
    student_code: str

class TutorResponse(typing.TypedDict):
    feedback_message: str
    concept_to_review: str
    next_coding_challenge: str
    difficulty_level: int

def generate_cache_key(topic: str, code: str) -> str:
    unique_string = f"{topic}:::{code.strip()}"
    return hashlib.md5(unique_string.encode()).hexdigest()

def run_python_code(code: str) -> dict:
    old_stdout = sys.stdout
    redirected_output = sys.stdout = io.StringIO()
    try:
        local_vars = {}
        exec(code, {"__builtins__": __builtins__}, local_vars)
        sys.stdout = old_stdout
        return {"success": True, "output": redirected_output.getvalue()}
    except Exception as e:
        sys.stdout = old_stdout
        error_lines = traceback.format_exception(*sys.exc_info())
        clean_error = "".join(error_lines[-2:])
        return {"success": False, "output": clean_error.strip()}

@app.post("/api/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == req.username).first()
    if not user or not pwd_context.verify(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token_data = {"sub": user.username, "role": user.role, "exp": datetime.utcnow() + timedelta(hours=2)}
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "role": user.role}

@app.post("/api/register")
def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Assuming pwd_context is already defined in your file for login!
    hashed_pwd = pwd_context.hash(user_data.password)

    new_user = models.User(username=user_data.username, hashed_password=hashed_pwd, role=user_data.role)
    db.add(new_user)
    db.commit()

    return {"message": f"User {user_data.username} created successfully!"}

@app.put("/api/update-password")
def update_user_password(data: PasswordUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == data.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = pwd_context.hash(data.new_password)
    db.commit()

    return {"message": "Password updated successfully!"}
from pydantic import BaseModel

class CodeSubmission(BaseModel):
    current_topic: str
    student_code: str

def verify_admin(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# --- 👤 SECURITY BOUNCER FOR EVERYONE ---
def verify_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    
    token = authorization.split(" ")[1]
    try:
        # Decode the token to see who is making the request
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload 
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

import os
import uuid
import json
import subprocess
from datetime import datetime
from pydantic import BaseModel

class CodeSubmission(BaseModel):
    current_topic: str
    student_code: str

@app.post("/api/evaluate")
async def evaluate_code(
    request: CodeSubmission, 
    user_data: dict = Depends(verify_user), 
    db: Session = Depends(get_db)           
):
    username = user_data.get("sub")
    user = db.query(models.User).filter(models.User.username == username).first()

    # 1. BULLETPROOF EXECUTION: Save to a real file, run it, delete it.
    temp_filename = f"temp_{uuid.uuid4().hex}.py"
    try:
        with open(temp_filename, "w", encoding="utf-8") as f:
            f.write(request.student_code)
            
        process = subprocess.run(
            ['python', temp_filename], 
            capture_output=True, 
            text=True, 
            timeout=5
        )
        terminal_output = process.stdout
        if process.stderr:
            terminal_output += f"\nError: {process.stderr}"
        if not terminal_output.strip():
            terminal_output = "Code executed successfully with no print output."
    except Exception as e:
        terminal_output = f"Execution failed: {str(e)}"
    finally:
        # Clean up the temp file so your server doesn't get cluttered
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

    # 2. Ask Gemini for the 3-part structured feedback
    prompt = f"""
    You are an expert AI Python Tutor. The student is learning: {request.current_topic}.
    Code submitted: {request.student_code}
    Terminal Output: {terminal_output}
    
    Return a JSON object with exactly these three keys:
    "analysis": "A short paragraph explaining what the code does.",
    "concept": "A 1-sentence focus on the core concept used.",
    "objective": "A short suggestion for what to try next."
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        clean_text = response.text.strip("`").removeprefix("json").strip()
        ai_data = json.loads(clean_text)
        
        analysis_text = ai_data.get("analysis", "Great effort!")
        concept_text = ai_data.get("concept", "Keep practicing.")
        objective_text = ai_data.get("objective", "Try another problem.")
    except Exception as e:
        analysis_text = f"AI Error: Could not generate feedback. {str(e)}"
        concept_text = "N/A"
        objective_text = "N/A"

    # 3. Save to Database
    new_submission = models.Submission(
        user_id=user.id,
        topic=request.current_topic,
        code=request.student_code,
        feedback=analysis_text, 
        timestamp=datetime.utcnow() 
    )
    db.add(new_submission)
    db.commit() 

    # 4. Return EXACT keys to React
    return {
        "terminal": terminal_output,
        "analysis": analysis_text,
        "concept": concept_text,
        "objective": objective_text
    }
# --- 🔒 SECURITY BOUNCER FOR ADMINS ---


# --- 📁 THE CSV UPLOAD ENDPOINT ---
@app.post("/api/admin/bulk-upload")
async def bulk_upload_students(
    file: UploadFile = File(...), 
    admin_data: dict = Depends(verify_admin),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    # Read the file from memory
    contents = await file.read()
    decoded_contents = contents.decode('utf-8')
    csv_reader = csv.reader(io.StringIO(decoded_contents))
    
    # Skip the header row (e.g., "First Name, Last Name, Username")
    next(csv_reader, None)

    students_created = 0
    errors = []

    for row in csv_reader:
        if len(row) < 1:
            continue
            
        username = row[0].strip().lower()
        
        # Check if student already exists
        existing_user = db.query(models.User).filter(models.User.username == username).first()
        if existing_user:
            errors.append(f"Username '{username}' already exists.")
            continue

        # Generate a temporary password (e.g., python1234)
        random_digits = ''.join(random.choices(string.digits, k=4))
        temp_password = f"python{random_digits}"
        hashed_pwd = pwd_context.hash(temp_password)

        new_student = models.User(
            username=username,
            hashed_password=hashed_pwd,
            role="student"
        )
        db.add(new_student)
        students_created += 1
        
        # In a real app, you would save these temp passwords to a list 
        # and email them to the teacher. For now, we just print them.
        print(f"Created Student: {username} | Password: {temp_password}")

    db.commit()

    return {
        "message": f"Successfully created {students_created} students.",
        "errors": errors
    }
# --- 📊 FETCH ALL STUDENTS ---
@app.get("/api/admin/students")
def get_all_students(
    admin_data: dict = Depends(verify_admin), 
    db: Session = Depends(get_db)
):
    # Fetch everyone who has the role of 'student'
    students = db.query(models.User).filter(models.User.role == "student").all()
    
    # Return a clean list of their IDs and usernames
    return [{"id": s.id, "username": s.username} for s in students]
# --- 🔍 FETCH SINGLE STUDENT HISTORY ---
@app.get("/api/admin/students/{student_id}/history")
def get_student_history(
    student_id: int,
    admin_data: dict = Depends(verify_admin), 
    db: Session = Depends(get_db)
):
    # 1. Verify the student exists
    student = db.query(models.User).filter(models.User.id == student_id, models.User.role == "student").first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    # 2. Fetch all submissions belonging to this student ID
    # (Assuming you have a Submission model linked by user_id from Step 1)
    submissions = db.query(models.Submission).filter(models.Submission.user_id == student_id).order_by(models.Submission.timestamp.desc()).all()
    
    return {
        "username": student.username,
        "submissions": [
            {
                "id": sub.id,
                "topic": sub.topic,
                "code": sub.code,
                "feedback": sub.feedback,
                "timestamp": sub.timestamp
            } for sub in submissions
        ]
    }