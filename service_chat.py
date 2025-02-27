import streamlit as st
import requests

# -- Feuille de style CSS pour un design façon ChatGPT + icône "envoyer" --
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

/* Masquer le bouton par défaut de Streamlit (form_submit_button) 
   pour n'afficher que le bouton HTML personnalisé */
.css-15rv2hv.e8zbici2 {
    display: none !important;
}

/* Bouton "Envoyer" HTML personnalisé */
.send-button {
    border: none;
    background: none;
    cursor: pointer;
    font-size: 1.2em;
    color: #0066FF;
    margin-left: 8px;
}
.send-button:hover {
    color: #0044BB;
}
</style>
"""

st.markdown(chat_css, unsafe_allow_html=True)

# -- Configuration de l'API Azure OpenAI (adapter à tes secrets) --
API_KEY = st.secrets["Clé secrète"]
AZURE_ENDPOINT = st.secrets["Lien connexion"]

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

    # -- Formulaire pour gérer l'envoi du message --
    with st.form("chat_form", clear_on_submit=True):
        # On utilise un champ texte sans label visible, juste un placeholder
        user_input = st.text_input(
            label="",
            placeholder="Tapez votre message ici et appuyez sur Entrée...",
            key="user_input"
        )
        # Bouton caché de Streamlit (on l'utilise en interne)
        submit = st.form_submit_button("Envoyer")

        # Bouton HTML (icône) placé à droite
        # type="submit" pour que le clic déclenche le submit du formulaire
        st.markdown(
            """
            <div style="text-align: right;">
                <button class="send-button" type="submit">📨</button>
            </div>
            """,
            unsafe_allow_html=True
        )

    # -- Lorsque le formulaire est soumis (Entrée ou clic sur l'icône) --
    if submit and user_input.strip():
        # 1) Ajouter le message utilisateur à l'historique
        st.session_state["chat_history"].append({"role": "user", "content": user_input})

        # 2) Obtenir la réponse de l'assistant
        with st.spinner("L'assistant réfléchit..."):
            response = azure_llm_chat(st.session_state["chat_history"])

        # 3) Ajouter la réponse de l'assistant à l'historique
        st.session_state["chat_history"].append({"role": "assistant", "content": response})

        # 4) Rafraîchir la page pour afficher le nouveau message
        st.rerun()

# -- Lancement de la page de chat --
if __name__ == "__main__":
    page_chat()
