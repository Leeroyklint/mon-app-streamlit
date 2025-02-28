import streamlit as st
import requests
import os

def azure_llm_chat(messages):
    API_KEY = st.secrets["Clé secrète"]
    AZURE_ENDPOINT = st.secrets["Lien connexion"]
    # API_KEY = os.getenv("AZ_OPENAI_API")
    # AZURE_ENDPOINT = os.getenv("AZ_OPENAI_ENDPOINT")
    headers = {"Content-Type": "application/json", "api-key": API_KEY}
    data = {"messages": messages, "max_tokens": 2048}
    response = requests.post(AZURE_ENDPOINT, headers=headers, json=data)
    if response.status_code == 200:
        result = response.json()
        return result["choices"][0]["message"]["content"]
    else:
        return f"Erreur {response.status_code}: {response.text}"

def page_chat():
    st.set_page_config(page_title="Chat Conversationnel", page_icon="💬", layout="centered")
    
    # Initialisation de l'historique de conversation dans la session
    if "chat_history" not in st.session_state:
        st.session_state["chat_history"] = [
            {"role": "assistant", "content": "Bonjour, comment puis-je vous aider ?"}
        ]
    
    # Affichage du header
    st.markdown("<h2 style='text-align: center;'>💬 Chat Azure OpenAI</h2>", unsafe_allow_html=True)
    
    # Affichage de la conversation avec la nouvelle interface de chat
    for msg in st.session_state.chat_history:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
    
    # Zone de saisie du message utilisateur
    user_input = st.chat_input("Tapez votre message ici...")
    
    if user_input:
        # Ajout du message de l'utilisateur à l'historique
        st.session_state.chat_history.append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.markdown(user_input)
        
        # Appel de l'API Azure OpenAI pour obtenir la réponse
        with st.spinner("Azure OpenAI réfléchit..."):
            response = azure_llm_chat(st.session_state.chat_history)
        
        # Ajout de la réponse de l'assistant à l'historique et affichage
        st.session_state.chat_history.append({"role": "assistant", "content": response})
        with st.chat_message("assistant"):
            st.markdown(response)
