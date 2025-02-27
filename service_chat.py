import streamlit as st
import requests

# -- Feuille de style CSS pour un design façon ChatGPT --
chat_css = """
<style>
/* Conteneur global pour le chat */
.chat-container {
    display: flex;
    flex-direction: column;
    margin-top: 20px;
}

/* Style commun aux bulles de messages */
.chat-bubble {
    padding: 12px 16px;
    border-radius: 10px;
    margin: 5px 0;
    max-width: 70%;
    line-height: 1.4;
}

/* Bulle pour l'assistant (alignée à gauche) */
.assistant-msg {
    background-color: #F4F4F4;
    color: #000000;
    align-self: flex-start;
}

/* Bulle pour l'utilisateur (alignée à droite) */
.user-msg {
    background-color: #0066FF;
    color: #FFFFFF;
    align-self: flex-end;
}

/* Zone de saisie et bouton d'envoi */
.input-container {
    margin-top: 20px;
    display: flex;
    gap: 10px;
}
</style>
"""

# -- Ajout du style dans la page --
st.markdown(chat_css, unsafe_allow_html=True)

# -- Configuration de l'API Azure OpenAI --
API_KEY = st.secrets["Clé secrète chat"]
AZURE_ENDPOINT = st.secrets["Lien connexion chat"]

def azure_llm_chat(messages):
    """
    Fonction qui envoie les messages à Azure OpenAI et
    retourne la réponse de l'assistant.
    """
    headers = {"Content-Type": "application/json", "api-key": API_KEY}
    data = {
        "messages": messages,
        "max_tokens": 2048
    }
    response = requests.post(AZURE_ENDPOINT, headers=headers, json=data)
    if response.status_code == 200:
        result = response.json()
        return result["choices"][0]["message"]["content"]
    else:
        return f"Erreur {response.status_code}: {response.text}"

def page_chat():
    st.title("💬 Mon Chat IA (style ChatGPT)")

    # -- Initialisation de l'historique de conversation dans la session --
    if "chat_history" not in st.session_state:
        st.session_state["chat_history"] = [
            {"role": "system", "content": "Tu es un assistant IA utile."}
        ]

    # -- Affichage de la conversation existante --
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

    # -- Zone de saisie du message utilisateur --
    with st.container():
        user_input = st.text_input("Tapez votre message ici :", key="user_input")
        if st.button("Envoyer"):
            if user_input.strip():
                # 1) Ajouter le message utilisateur à l'historique
                st.session_state["chat_history"].append({
                    "role": "user",
                    "content": user_input
                })
                # 2) Obtenir la réponse de l'assistant
                with st.spinner("L'assistant réfléchit..."):
                    response = azure_llm_chat(st.session_state["chat_history"])
                # 3) Ajouter la réponse de l'assistant à l'historique
                st.session_state["chat_history"].append({
                    "role": "assistant",
                    "content": response
                })
                # 4) Forcer le rafraîchissement pour afficher le nouveau message
                st.rerun()
            else:
                st.warning("Veuillez entrer un message avant d'envoyer.")

# -- Lancement de la page de chat --
if __name__ == "__main__":
    page_chat()
