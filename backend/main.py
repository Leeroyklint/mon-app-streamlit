from fastapi import FastAPI
from api import router
from fastapi.middleware.cors import CORSMiddleware
from model import azure_llm_chat

app = FastAPI()

origins = [
    "http://localhost:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api", tags=["api"])

@app.get("/")
def read_root():
    question = "Test"
    messages = [{"role": "user", "content": question}]
    answer = azure_llm_chat(messages)
    return {"question": question, "answer": answer}
