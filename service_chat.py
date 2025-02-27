import streamlit as st
import requests

# -- Feuille de style CSS pour un design façon ChatGPT + icône "paper plane" --
chat_css = """
<style>
/* Conteneur global pour le chat */
.chat-container {
    display: flex;
    flex-direction: column;
    margin-top: 20px;
    margin-bottom: 20px;
}

/* Style commun aux bulles de messages */
.chat-bubble {
    padding: 12px 16px;
    border-radius: 10px;
    margin: 5px 0;
    max-width: 70%;
    line-height: 1.4;
    font-family: "Helvetica", "Arial", sans-serif;
    font-size: 15px;
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

/* Masquer le bouton "Envoyer" de Streamlit (st.form_submit_button) */
button[kind="primary"] {
    display: none !important;
}

/* Container autour du champ de saisie et de l'icône */
.input-row {
    display: flex;
    align-items: center;
    background-color: #F9F9F9;
    border: 1px solid #DDD;
    border-radius: 6px;
    padding: 6px 10px;
}

/* Champ texte custom */
.input-row input[type="text"] {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 15px;
}

/* Bouton icône "paper plane" */
.send-button {
    border: none;
    background: none;
    cursor: pointer;
    padding: 0;
    margin: 0 0 0 8px;
    display: flex;
    align-items: center;
}
.send-button:hover svg path {
    fill: #0044BB; /* Couleur au survol */
}
</style>
"""

st.markdown(chat_css, unsafe_allow_html=True)

# -- Configuration de l'API Azure OpenAI (adapte à tes secrets) --
API_KEY = st.secrets["Clé secrète chat"]
AZURE_ENDPOINT = st.secrets["Lien connexion chat"]

def azure_llm_chat(messages):
    """
    Envoie les messages à Azure OpenAI et retourne la réponse de l'assistant.
    """
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

    # -- Formulaire pour gérer l'envoi du message (Enter + icône) --
    with st.form("chat_form", clear_on_submit=True):
        # On met un champ texte + bouton icône dans un même conteneur
        st.markdown("<div class='input-row'>", unsafe_allow_html=True)
        user_input = st.text_input(
            label="",
            placeholder="Tapez votre message ici et appuyez sur Entrée...",
            key="user_input"
        )
        # Bouton masqué de Streamlit (nécessaire pour que 'Enter' soumette le formulaire)
        submit = st.form_submit_button("Envoyer")

        # Bouton HTML (icône) placé à droite, type="submit" pour déclencher la soumission
        st.markdown(
            """
            <button class="send-button" type="submit">
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <path fill="#0066FF" d="M2.01 21l20.99-9L2.01 3v7l15 2-15 2z"/>
                </svg>
            </button>
            """,
            unsafe_allow_html=True
        )
        st.markdown("</div>", unsafe_allow_html=True)

    # -- Lorsque le formulaire est soumis (Entrée ou clic sur l'icône) --
    if submit and user_input.strip():
        # 1) Ajouter le message utilisateur à l'historique
        st.session_state["chat_history"].append({"role": "user", "content": user_input})

        # 2) Obtenir la réponse de l'assistant
        with st.spinner("Azure OpenAI réfléchit..."):
            response = azure_llm_chat(st.session_state["chat_history"])

        # 3) Ajouter la réponse de l'assistant à l'historique
        st.session_state["chat_history"].append({"role": "assistant", "content": response})

        # 4) Rafraîchir la page pour afficher le nouveau message
        st.rerun()

# -- Lancement de la page de chat --
if __name__ == "__main__":
    page_chat()
