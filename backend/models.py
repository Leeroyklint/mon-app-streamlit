import io
import pandas as pd
import docx2txt
from PyPDF2 import PdfReader
from langchain.text_splitter import CharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_openai.embeddings.azure import AzureOpenAIEmbeddings
import os

def parse_pdf(file_bytes: bytes) -> str:
    file_obj = io.BytesIO(file_bytes)
    pdf_reader = PdfReader(file_obj)
    text = ""
    for page in pdf_reader.pages:
        page_text = page.extract_text() or ""
        text += page_text
    return text

def parse_docx(file_bytes: bytes) -> str:
    file_obj = io.BytesIO(file_bytes)
    return docx2txt.process(file_obj)

def parse_txt(file_bytes: bytes) -> str:
    return file_bytes.decode("utf-8", errors="ignore")

def parse_excel(file_bytes: bytes) -> str:
    file_obj = io.BytesIO(file_bytes)
    try:
        df = pd.read_excel(file_obj)
    except Exception:
        file_obj.seek(0)
        df = pd.read_csv(file_obj)
    return df.to_csv(index=False)

def get_text_chunks(text: str, chunk_size: int = 1000, overlap: int = 200) -> list:
    splitter = CharacterTextSplitter(separator="\n", chunk_size=chunk_size, chunk_overlap=overlap)
    return splitter.split_text(text)

def build_vectorstore_from_texts(texts: list) -> FAISS:
    # Vérification : si la liste texts est vide, on la remplace par une liste contenant une chaîne vide.
    if not texts or len(texts) == 0:
        texts = [""]
    embedding = AzureOpenAIEmbeddings(
        api_key=os.getenv("AZ_OPENAI_API_4o_mini_ada_002"),
        azure_endpoint=os.getenv("AZURE_OPENAI_EMBEDDINGS_ENDPOINT"),
        model="text-embedding-ada-002",
        openai_api_version="2023-05-15",
    )
    vectorstore = FAISS.from_texts(texts=texts, embedding=embedding)
    return vectorstore

def search_documents(vectorstore: FAISS, query: str, k: int = 4) -> list:
    results = vectorstore.similarity_search(query, k=k)
    return [doc.page_content for doc in results]
