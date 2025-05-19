import io, os
import pandas as pd
import docx2txt
from PyPDF2 import PdfReader

from langchain.text_splitter import CharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_openai.embeddings.azure import AzureOpenAIEmbeddings
from backend.model import azure_llm_chat     # ⬅️ appel à ton wrapper

# ---------------------------------------------------------------------------
#  PARSING fichiers ----------------------------------------------------------
# ---------------------------------------------------------------------------

def parse_pdf(file_bytes: bytes) -> str:
    pdf_reader = PdfReader(io.BytesIO(file_bytes))
    return "\n".join(page.extract_text() or "" for page in pdf_reader.pages)

def parse_docx(file_bytes: bytes) -> str:
    return docx2txt.process(io.BytesIO(file_bytes))

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

# ---------------------------------------------------------------------------
#  VECTORIZING / RAG ---------------------------------------------------------
# ---------------------------------------------------------------------------

def get_text_chunks(text: str, chunk_size: int = 1_000, overlap: int = 200) -> list[str]:
    splitter = CharacterTextSplitter(separator="\n", chunk_size=chunk_size, chunk_overlap=overlap)
    return splitter.split_text(text)

def build_vectorstore_from_texts(texts: list[str]) -> FAISS:
    if not texts:
        texts = [""]
    embedding = AzureOpenAIEmbeddings(
        api_key         = os.getenv("AZ_OPENAI_API_4o_mini_ada_002"),
        azure_endpoint  = os.getenv("AZURE_OPENAI_EMBEDDINGS_ENDPOINT"),
        model           = "text-embedding-ada-002",
        openai_api_version = "2023-05-15",
    )
    return FAISS.from_texts(texts=texts, embedding=embedding)

def search_documents(vs: FAISS, query: str, k: int = 4) -> list[str]:
    return [doc.page_content for doc in vs.similarity_search(query, k=k)]

# ---------------------------------------------------------------------------
#  RÉSUMÉ automatique – utilisé dès l’upload --------------------------------
# ---------------------------------------------------------------------------

_SUM_SYS = (
    "Tu es un assistant qui produit un résumé **objectif** et **synthétique** du "
    "document fourni (200 mots max, pas d’invention)."
)

def summarize_text(text: str) -> str:
    # on tronque si vraiment énorme (évite > 130 k tokens)
    text = text[:120_000]
    return azure_llm_chat(
        [
            {"role": "system", "content": _SUM_SYS},
            {"role": "user",   "content": text},
        ],
        model="GPT o1-mini",
    )
