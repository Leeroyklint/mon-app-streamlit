import streamlit as st
import requests
import os
# -- CSS amélioré pour un design conversationnel --
chat_css = """
<style>
body {
    background-color: #f0f2f6;
    font-family: 'Helvetica', 'Arial', sans-serif;
}

/* Conteneur global du chat */
.chat-container {
    width: 100%;
    max-width: 700px;
    margin: auto;
    padding: 20px;
}

/* Style commun aux bulles de messages */
.chat-bubble {
    padding: 12px 16px;
    margin: 10px 0;
    max-width: 80%;
    border-radius: 15px;
    position: relative;
    font-size: 15px;
    line-height: 1.4;
}

/* Bulle pour l'assistant (alignée à gauche) */
.assistant-msg {
    background: #ffffff;
    border: 1px solid #e0e0e0;
    margin-right: auto;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.assistant-msg::before {
    content: "";
    position: absolute;
    top: 10px;
    left: -10px;
    border-width: 10px;
    border-style: solid;
    border-color: transparent #ffffff transparent transparent;
}

/* Bulle pour l'utilisateur (alignée à droite) */
.user-msg {
    background: #0066FF;
    color: white;
    margin-left: auto;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.user-msg::after {
    content: "";
    position: absolute;
    top: 10px;
    right: -10px;
    border-width: 10px;
    border-style: solid;
    border-color: transparent transparent transparent #0066FF;
}

/* Conteneur du champ de saisie */
.input-container {
    width: 100%;
    max-width: 700px;
    margin: auto;
    margin-top: 20px;
    display: flex;
    align-items: center;
    background-color: #ffffff;
    border: 1px solid #e0e0e0;
    border-radius: 30px;
    padding: 10px 15px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Champ texte personnalisé */
.input-container input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 15px;
}

/* Bouton icône "paper plane" placé à droite */
.send-button {
    border: none;
    background: none;
    cursor: pointer;
    margin-left: 10px;
    display: flex;
    align-items: center;
}
.send-button:hover svg path {
    fill: #0044BB;
}

/* Masquer le bouton submit par défaut de Streamlit */
button[data-baseweb="button"] {
    display: none !important;
}
</style>
"""

st.markdown(chat_css, unsafe_allow_html=True)

import dotenv

dotenv.load_dotenv()

API_KEY = os.getenv("AZ_OPENAI_API")
AZURE_ENDPOINT = os.getenv("AZ_OPENAI_ENDPOINT")

def azure_llm_chat(messages):
    headers = {"Content-Type": "application/json", "api-key": API_KEY}
    data = {"messages": messages, "max_tokens": 2048}
    response = requests.post(AZURE_ENDPOINT, headers=headers, json=data)
    if response.status_code == 200:
        result = response.json()
        return result["choices"][0]["message"]["content"]
    else:
        return f"Erreur {response.status_code}: {response.text}"

def page_chat():
    st.title("💬 Chat AzureOpenAI")

    # Initialisation de l'historique de conversation dans la session
    if "chat_history" not in st.session_state:
        st.session_state["chat_history"] = [
            {"role": "system", "content": "Tu es un assistant IA utile."}
        ]

    # Affichage de la conversation dans un conteneur stylé
    st.markdown("<div class='chat-container'>", unsafe_allow_html=True)
    for msg in st.session_state["chat_history"]:
        if msg["role"] == "user":
            st.markdown(
                f"<div class='chat-bubble user-msg'>{msg['content']}</div>",
                unsafe_allow_html=True
            )
        elif msg["role"] == "assistant":
            st.markdown(
                f"<div class='chat-bubble assistant-msg'>{msg['content']}</div>",
                unsafe_allow_html=True
            )
    st.markdown("</div>", unsafe_allow_html=True)

    # Zone de saisie avec formulaire
    with st.form("chat_form", clear_on_submit=True):
        # On utilise deux colonnes pour placer le champ de saisie et l'icône sur la même ligne
        col1, col2 = st.columns([9, 1])
        with col1:
            user_input = st.text_input(
                label="",
                placeholder="Tapez votre message ici...",
                key="user_input"
            )
        with col2:
            st.markdown(
                """
                <button class="send-button" type="submit">
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <path fill="#0066FF" d="M2.01 21L23 12 2.01 3v7l15 2-15 2z"/>
                    </svg>
                </button>
                """,
                unsafe_allow_html=True
            )
        # Le bouton submit par défaut est nécessaire pour la soumission via Enter, il est masqué grâce au CSS
        submit = st.form_submit_button("")

    if submit and user_input.strip():
        # Ajout du message utilisateur à l'historique
        st.session_state["chat_history"].append({"role": "user", "content": user_input})
        # Appel de l'API pour obtenir la réponse
        with st.spinner("Azure OpenAI réfléchit..."):
            response = azure_llm_chat(st.session_state["chat_history"])
        # Ajout de la réponse dans l'historique
        st.session_state["chat_history"].append({"role": "assistant", "content": response})
        st.rerun()

if __name__ == "__main__":
    page_chat()
