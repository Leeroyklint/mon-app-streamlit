import streamlit as st
import requests
import os
import docx2txt
import pandas as pd
from PyPDF2 import PdfReader
from langchain_openai.embeddings.azure import AzureOpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import CharacterTextSplitter
import json

from db import create_conversation, get_conversation, update_conversation

def azure_llm_chat(messages, model="GPT 4o-mini"):
    if model == "GPT 4o-mini":
        API_KEY = os.getenv("AZ_OPENAI_API_4o_mini_ada_002")
        AZURE_ENDPOINT = os.getenv("AZ_OPENAI_ENDPOINT_4o_mini")
    elif model == "GPT 4o":
        API_KEY = os.getenv("AZ_OPENAI_API_4o")
        AZURE_ENDPOINT = os.getenv("AZ_OPENAI_ENDPOINT_4o")
    elif model == "GPT o1-mini - Maintenance":
        API_KEY = os.getenv("AZ_OPENAI_API_o1_mini")
        AZURE_ENDPOINT = os.getenv("AZ_OPENAI_ENDPOINT_o1_mini")
    
    headers = {"Content-Type": "application/json", "api-key": API_KEY}
    data = {
        "messages": messages,
        "max_tokens": 2048,
        "model": model
    }
    response = requests.post(AZURE_ENDPOINT, headers=headers, json=data)
    if response.status_code == 200:
        result = response.json()
        return result["choices"][0]["message"]["content"]
    else:
        return f"Erreur {response.status_code}: {response.text}"

# Fonctions de parsing

def parse_pdf(file) -> str:
    pdf_reader = PdfReader(file)
    text = ""
    for page in pdf_reader.pages:
        page_text = page.extract_text() or ""
        text += page_text
    return text

def parse_docx(file) -> str:
    return docx2txt.process(file)

def parse_txt(file) -> str:
    return file.read().decode("utf-8", errors="ignore")

def parse_excel(file) -> str:
    try:
        df = pd.read_excel(file)
    except Exception:
        file.seek(0)
        df = pd.read_csv(file)
    return df.to_csv(index=False)

def parse_uploaded_file(file) -> str:
    filename = file.name.lower()
    if filename.endswith(".pdf"):
        return parse_pdf(file)
    elif filename.endswith(".docx"):
        return parse_docx(file)
    elif filename.endswith(".txt"):
        return parse_txt(file)
    elif filename.endswith(".csv"):
        return parse_excel(file)
    else:
        return ""

# Embeddings et vectorisation

def get_text_chunks(text: str, chunk_size=1000, overlap=200):
    text_splitter = CharacterTextSplitter(
        separator="\n",
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        length_function=len
    )
    return text_splitter.split_text(text)

def build_vectorstore_from_texts(texts):
    embedding = AzureOpenAIEmbeddings(
        api_key=os.getenv("AZ_OPENAI_API_4o_mini_ada_002"),
        azure_endpoint=os.getenv("AZURE_OPENAI_EMBEDDINGS_ENDPOINT"),
        model="text-embedding-ada-002",
        openai_api_version="2023-05-15",
    )
    vectorstore = FAISS.from_texts(texts=texts, embedding=embedding)
    return vectorstore

def docs_page(user_id, selected_model):
    st.markdown("<h1 style='text-align: center;'>💬 Chat Azure OpenAI</h1>", unsafe_allow_html=True)
    st.sidebar.markdown("---")

    # 1) Upload de documents
    uploaded_files = st.sidebar.file_uploader(
        "Importer",
        type=["pdf", "docx", "txt", "csv"],
        accept_multiple_files=True
    )
    if uploaded_files:
        uploaded_docs = st.session_state.get("uploaded_docs", [])
        for file in uploaded_files:
            doc_name = file.name
            if not any(doc["name"] == doc_name for doc in uploaded_docs):
                file_text = parse_uploaded_file(file)
                uploaded_docs.append({"name": doc_name, "content": file_text})
        st.session_state.uploaded_docs = uploaded_docs

    # 2) Reconstitution du vectorstore
    if not st.session_state.get("doc_vectorstore"):
        docs_text = ""
        if "selected_docs_conversation" in st.session_state:
            conversation_data = get_conversation(user_id, st.session_state["selected_docs_conversation"])
            if conversation_data and "documents" in conversation_data and isinstance(conversation_data["documents"], str):
                try:
                    conversation_data["documents"] = json.loads(conversation_data["documents"])
                except json.JSONDecodeError:
                    st.error("Erreur de décodage des documents enregistrés.")
                    conversation_data["documents"] = []
            if conversation_data and "documents" in conversation_data:
                docs_text = "\n".join(doc["content"] for doc in conversation_data["documents"])
        if not docs_text and st.session_state.get("uploaded_docs"):
            docs_text = "\n".join(doc["content"] for doc in st.session_state.uploaded_docs)
        if docs_text:
            text_chunks = get_text_chunks(docs_text)
            vectorstore = build_vectorstore_from_texts(text_chunks)
            st.session_state.doc_vectorstore = vectorstore

    # 3) Récupération de la conversation existante
    conversation_data = None
    if "selected_docs_conversation" in st.session_state:
        conversation_data = get_conversation(user_id, st.session_state["selected_docs_conversation"])
        if conversation_data and "documents" in conversation_data and isinstance(conversation_data["documents"], str):
            try:
                conversation_data["documents"] = json.loads(conversation_data["documents"])
            except json.JSONDecodeError:
                st.error("Erreur de décodage des documents enregistrés.")
                conversation_data["documents"] = []

    # 4) Affichage des documents importés
    if conversation_data and "documents" in conversation_data and conversation_data["documents"]:
        doc_names = [doc["name"] for doc in conversation_data["documents"]]
        if doc_names:
            st.info("Documents en mémoire : " + ", ".join(doc_names))
    elif st.session_state.get("uploaded_docs"):
        doc_names = [doc["name"] for doc in st.session_state.uploaded_docs]
        if doc_names:
            st.info("Documents en mémoire : " + ", ".join(doc_names))

    # 5) Affichage de l'historique de la conversation
    if conversation_data:
        for msg in conversation_data["messages"]:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])

    # 6) Gestion des messages utilisateur
    user_input = st.chat_input("Posez votre question sur vos documents...")
    if user_input:
        if not conversation_data:
            conversation_data = create_conversation(user_id, initial_message=user_input, conversation_type="doc")
            if st.session_state.get("uploaded_docs"):
                conversation_data["documents"] = st.session_state.uploaded_docs
                st.session_state.pop("uploaded_docs")
            st.session_state["selected_docs_conversation"] = conversation_data["id"]
        else:
            conversation_data["messages"].append({"role": "user", "content": user_input})
            conversation_data["type"] = "doc"
        update_conversation(conversation_data)

        with st.chat_message("user"):
            st.markdown(user_input)

        context = ""
        if st.session_state.get("doc_vectorstore"):
            retrieved_docs = st.session_state.doc_vectorstore.similarity_search(user_input, k=4)
            context = "\n\n".join([doc.page_content for doc in retrieved_docs])

        messages = [
            {"role": "system", "content": "Contexte des documents:\n" + context},
            {"role": "user", "content": user_input}
        ]
        with st.spinner("Azure OpenAI réfléchit..."):
            response = azure_llm_chat(messages, model=selected_model)
        
        conversation_data["messages"].append({"role": "assistant", "content": response})
        with st.chat_message("assistant"):
            st.markdown(response)
        
        update_conversation(conversation_data)
        st.rerun()
